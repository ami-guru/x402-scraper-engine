import * as tls from 'tls';
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD!;

async function inspectAllBounces() {
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
      currentStep = 'FETCH_BOUNCES';
      const start = Math.max(1, total - 7);
      activeTag = sendCommand(`FETCH ${start}:${total} (BODY[TEXT])`);
      return;
    }

    if (currentStep === 'FETCH_BOUNCES' && buffer.includes(`${activeTag} OK`)) {
      console.log('======================================================');
      console.log('📬 DETAILED BOUNCE DIAGNOSTICS:');
      console.log('======================================================\n');
      
      const parts = buffer.split(/\*\s+\d+\s+FETCH/i).slice(1);
      parts.forEach((p, idx) => {
        const target = p.match(/Your message wasn't delivered to\s+([^\s<]+)/i) || 
                       p.match(/Final-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i) ||
                       p.match(/Recipient address rejected:[^\r\n]*/i);
        const reason = p.match(/The response from the remote server was:\s*[\r\n]+([^\r\n]+)/i) ||
                       p.match(/Diagnostic-Code:[^\r\n]*/i);
        if (target) {
          console.log(`[Bounce #${idx + 1}] Target: ${target[0]}`);
          if (reason) console.log(`   Reason: ${reason[0]}`);
          console.log('---');
        }
      });

      sendCommand('LOGOUT');
      socket.end();
    }
  });
}

inspectAllBounces();
