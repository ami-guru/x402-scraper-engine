import * as tls from 'tls';
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD!;

async function readGithubReply() {
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
      currentStep = 'SEARCH';
      activeTag = sendCommand(`SEARCH HEADER SUBJECT "punkpeye"`);
      return;
    }

    if (currentStep === 'SEARCH' && buffer.includes(`${activeTag} OK`)) {
      const uids = buffer.replace(/[\r\n]/g, '').replace(/.*SEARCH\s*/, '').replace(/A\d+ OK.*/, '').trim().split(/\s+/);
      console.log('Found UIDs matching punkpeye:', uids);
      const targetUid = uids[uids.length - 1];

      buffer = '';
      currentStep = 'FETCH_PUNKPEYE';
      activeTag = sendCommand(`FETCH ${targetUid} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] BODY[TEXT])`);
      return;
    }

    if (currentStep === 'FETCH_PUNKPEYE' && buffer.includes(`${activeTag} OK`)) {
      console.log('\n======================================================');
      console.log('🐙 PUNKPEYE GITHUB REPLY');
      console.log('======================================================\n');
      console.log(buffer);
      console.log('======================================================\n');

      sendCommand('LOGOUT');
      socket.end();
    }
  });
}

readGithubReply();
