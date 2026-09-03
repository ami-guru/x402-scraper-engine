import * as tls from 'tls';
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD!;

function decodeMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    if (encoding.toUpperCase() === 'B') {
      return Buffer.from(text, 'base64').toString(charset.toLowerCase() === 'utf-8' ? 'utf8' : 'latin1');
    }
    if (encoding.toUpperCase() === 'Q') {
      return text.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/_/g, ' ');
    }
    return text;
  });
}

async function checkGmailInbox() {
  console.log(`\n📬 Connecting to Gmail IMAP for ${GMAIL_USER}...\n`);

  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect(
      {
        host: 'imap.gmail.com',
        port: 993,
        rejectUnauthorized: false
      },
      () => {
        // Connected
      }
    );

    let tagIndex = 1;
    let buffer = '';
    let currentStep = 'GREETING';
    let totalMessages = 0;
    let recentUids: string[] = [];

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
        if (buffer.includes(`${activeTag} OK`)) {
          buffer = '';
          currentStep = 'SELECT';
          activeTag = sendCommand('SELECT INBOX');
        } else {
          console.error('❌ IMAP Login Failed:', buffer);
          socket.end();
          return reject(new Error('IMAP Login Failed'));
        }
        return;
      }

      if (currentStep === 'SELECT' && buffer.includes(`${activeTag} `)) {
        const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
        totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;
        console.log(`📥 Total Messages in Inbox: ${totalMessages}`);

        buffer = '';
        if (totalMessages === 0) {
          console.log('\n📭 Inbox is empty.');
          socket.end();
          return resolve();
        }

        // Fetch the last 5 messages
        const startMsg = Math.max(1, totalMessages - 4);
        const fetchRange = `${startMsg}:${totalMessages}`;
        currentStep = 'FETCH';
        activeTag = sendCommand(`FETCH ${fetchRange} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)])`);
        return;
      }

      if (currentStep === 'FETCH' && buffer.includes(`${activeTag} OK`)) {
        console.log('\n======================================================');
        console.log('📨 RECENT EMAILS IN INBOX');
        console.log('======================================================\n');

        const messageBlocks = buffer.split(/\*\s+\d+\s+FETCH/i).slice(1);

        for (let i = messageBlocks.length - 1; i >= 0; i--) {
          const block = messageBlocks[i];
          const fromMatch = block.match(/From:\s*([^\r\n]+)/i);
          const subjectMatch = block.match(/Subject:\s*([^\r\n]+)/i);
          const dateMatch = block.match(/Date:\s*([^\r\n]+)/i);

          const from = fromMatch ? decodeMimeWords(fromMatch[1].trim()) : 'Unknown';
          const subject = subjectMatch ? decodeMimeWords(subjectMatch[1].trim()) : '(No Subject)';
          const date = dateMatch ? dateMatch[1].trim() : 'Unknown Date';

          console.log(`📧 [Email ${messageBlocks.length - i}]`);
          console.log(`   From:    ${from}`);
          console.log(`   Subject: ${subject}`);
          console.log(`   Date:    ${date}`);
          console.log('------------------------------------------------------');
        }

        buffer = '';
        currentStep = 'LOGOUT';
        sendCommand('LOGOUT');
        socket.end();
        return resolve();
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err.message);
      reject(err);
    });
  });
}

checkGmailInbox().catch(console.error);
