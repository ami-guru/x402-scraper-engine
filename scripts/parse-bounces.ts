import * as tls from 'tls';
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD!;

async function parseRecentBounces() {
  const socket = tls.connect(
    {
      host: 'imap.gmail.com',
      port: 993,
      rejectUnauthorized: false
    },
    () => {}
  );

  let tagIndex = 1;
  let buffer = '';
  let currentStep = 'GREETING';

  const sendCommand = (cmd: string) => {
    const tag = `A${String(tagIndex++).padStart(3, '0')}`;
    socket.write(`${tag} ${cmd}\r\n`);
    return tag;
  };

  let activeTag = '';

  socket.on('data', (data) => {
    const chunk = data.toString('utf-8');
    buffer += chunk;

    if (currentStep === 'GREETING' && buffer.includes('* OK')) {
      buffer = '';
      currentStep = 'LOGIN';
      activeTag = sendCommand(`LOGIN ${GMAIL_USER} ${GMAIL_PASS}`);
      return;
    }

    if (currentStep === 'LOGIN' && buffer.includes(`${activeTag} `)) {
      buffer = '';
      currentStep = 'SELECT';
      activeTag = sendCommand('SELECT INBOX');
      return;
    }

    if (currentStep === 'SELECT' && buffer.includes(`${activeTag} `)) {
      const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
      const total = existsMatch ? parseInt(existsMatch[1], 10) : 0;

      buffer = '';
      currentStep = 'FETCH_RANGE';
      const start = Math.max(1, total - 7);
      activeTag = sendCommand(`FETCH ${start}:${total} (BODY[HEADER.FIELDS (SUBJECT TO FROM DATE)] BODY[TEXT])`);
      return;
    }

    if (currentStep === 'FETCH_RANGE' && buffer.includes(`${activeTag} OK`)) {
      console.log('\n======================================================');
      console.log('📬 DELIVERY REPORT ANALYSIS');
      console.log('======================================================\n');
      
      const parts = buffer.split(/\*\s+\d+\s+FETCH/i).slice(1);
      for (const p of parts) {
        const failedMatch = p.match(/Your message wasn't delivered to\s+([^\s<]+)/i) || p.match(/Final-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i);
        if (failedMatch) {
          console.log(`❌ Bounced / Not Found: ${failedMatch[1]}`);
        } else {
          const subjMatch = p.match(/Subject:\s*([^\r\n]+)/i);
          const toMatch = p.match(/To:\s*([^\r\n]+)/i);
          if (subjMatch) {
            console.log(`📧 Subject: ${subjMatch[1].trim()}`);
          }
        }
      }
      console.log('======================================================\n');

      sendCommand('LOGOUT');
      socket.end();
    }
  });
}

parseRecentBounces();
