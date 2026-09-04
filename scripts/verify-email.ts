import * as dns from 'dns';
import * as net from 'net';

dns.setServers(['8.8.8.8', '1.1.1.1']);

export interface EmailVerificationResult {
  email: string;
  isValidSyntax: boolean;
  hasMxRecords: boolean;
  mxHosts: string[];
  smtpDeliverable?: boolean;
  status: 'VALID' | 'INVALID' | 'UNVERIFIABLE';
  reason: string;
}

export function validateSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

export async function getMxRecords(domain: string): Promise<string[]> {
  try {
    const records = await dns.promises.resolveMx(domain);
    if (!records || records.length === 0) return [];
    records.sort((a, b) => a.priority - b.priority);
    return records.map(r => r.exchange);
  } catch (err) {
    return [];
  }
}

export async function probeSmtpMailbox(email: string, mxHost: string, timeoutMs: number = 6000): Promise<{ deliverable: boolean; reason: string }> {
  return new Promise((resolve) => {
    let socket: net.Socket;
    let timer: NodeJS.Timeout;
    let stage = 0; // 0: connect, 1: EHLO, 2: MAIL FROM, 3: RCPT TO, 4: QUIT
    let response = '';

    const cleanup = (deliverable: boolean, reason: string) => {
      clearTimeout(timer);
      if (socket && !socket.destroyed) {
        socket.write('QUIT\r\n');
        socket.destroy();
      }
      resolve({ deliverable, reason });
    };

    timer = setTimeout(() => {
      cleanup(false, 'SMTP probe timed out (likely port 25 restricted or greylisted)');
    }, timeoutMs);

    try {
      socket = net.createConnection(25, mxHost);
    } catch (err: any) {
      return cleanup(false, `Socket connection error: ${err.message}`);
    }

    socket.setEncoding('utf-8');

    socket.on('error', (err) => {
      cleanup(false, `SMTP error on ${mxHost}: ${err.message}`);
    });

    socket.on('data', (data) => {
      response += data.toString();
      const lines = response.split('\r\n').filter(Boolean);
      const lastLine = lines[lines.length - 1];

      // Wait for complete multi-line responses (e.g. 250-... vs 250 ...)
      if (/^\d{3}\s/.test(lastLine)) {
        const code = parseInt(lastLine.substring(0, 3), 10);
        response = '';

        if (stage === 0) {
          // Greeting received
          if (code === 220) {
            stage = 1;
            socket.write('EHLO getguruautomations.com\r\n');
          } else {
            cleanup(false, `Unexpected greeting code: ${code}`);
          }
        } else if (stage === 1) {
          // EHLO response
          if (code === 250) {
            stage = 2;
            socket.write('MAIL FROM:<ami@getguruautomations.com>\r\n');
          } else {
            cleanup(false, `EHLO rejected with code: ${code}`);
          }
        } else if (stage === 2) {
          // MAIL FROM response
          if (code === 250) {
            stage = 3;
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            cleanup(false, `MAIL FROM rejected with code: ${code}`);
          }
        } else if (stage === 3) {
          // RCPT TO response - this tells us if the mailbox exists!
          if (code === 250 || code === 251) {
            cleanup(true, `Mailbox verified (SMTP code ${code} OK)`);
          } else if (code >= 500 && code < 600) {
            cleanup(false, `Recipient rejected: ${lastLine}`);
          } else if (code >= 400 && code < 500) {
            cleanup(false, `Temporary mailbox error / greylisted: ${lastLine}`);
          } else {
            cleanup(false, `Unknown RCPT response: ${lastLine}`);
          }
        }
      }
    });
  });
}

export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const trimmed = email.trim().toLowerCase();
  
  if (!validateSyntax(trimmed)) {
    return {
      email: trimmed,
      isValidSyntax: false,
      hasMxRecords: false,
      mxHosts: [],
      status: 'INVALID',
      reason: 'Malformed email syntax'
    };
  }

  const domain = trimmed.split('@')[1];
  const mxHosts = await getMxRecords(domain);

  if (mxHosts.length === 0) {
    return {
      email: trimmed,
      isValidSyntax: true,
      hasMxRecords: false,
      mxHosts: [],
      status: 'INVALID',
      reason: `Domain "${domain}" has no MX mail servers configured`
    };
  }

  // Try probing the primary MX host
  const probeResult = await probeSmtpMailbox(trimmed, mxHosts[0]);

  if (probeResult.deliverable) {
    return {
      email: trimmed,
      isValidSyntax: true,
      hasMxRecords: true,
      mxHosts,
      smtpDeliverable: true,
      status: 'VALID',
      reason: probeResult.reason
    };
  } else if (probeResult.reason.includes('rejected') || probeResult.reason.includes('Access denied') || probeResult.reason.includes('not found') || probeResult.reason.includes('does not exist')) {
    return {
      email: trimmed,
      isValidSyntax: true,
      hasMxRecords: true,
      mxHosts,
      smtpDeliverable: false,
      status: 'INVALID',
      reason: probeResult.reason
    };
  } else {
    // If SMTP probe timed out (e.g. port 25 ISP restriction), domain MX is valid but mailbox status is unverifiable via raw socket
    return {
      email: trimmed,
      isValidSyntax: true,
      hasMxRecords: true,
      mxHosts,
      status: 'UNVERIFIABLE',
      reason: probeResult.reason
    };
  }
}

// Direct test CLI
if (require.main === module) {
  const testEmails = [
    'sterlingtraveltech@gmail.com',
    'info@solarwattsystems.com',
    'info@covenantroofing.com',
    'info@accurateroofing.ca',
    'sales@resscottsolar.com',
    'service@plumbingsolutionstt.com',
    'nonexistentuser123987@gmail.com'
  ];

  (async () => {
    console.log('🔍 Running Email Verification Pre-Flight Suite...\n');
    for (const email of testEmails) {
      console.log(`Checking: ${email}...`);
      const res = await verifyEmail(email);
      console.log(`-> Status: [${res.status}] | MX: ${res.mxHosts.length > 0 ? res.mxHosts[0] : 'None'} | Reason: ${res.reason}\n`);
    }
  })();
}
