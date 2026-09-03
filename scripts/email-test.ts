import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

async function testGmailConnection() {
  console.log(`\nConnecting to Gmail SMTP as: ${GMAIL_USER}...`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS
    }
  });

  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP Connection Verified Successfully!');
    console.log('🚀 Guru Agent is now equipped to send and automate emails from sterlingtraveltech@gmail.com.\n');
  } catch (error: any) {
    console.error('❌ Gmail SMTP Verification Failed:', error.message);
  }
}

testGmailConnection();
