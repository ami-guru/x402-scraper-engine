import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

async function sendTestPitch() {
  console.log('📧 Testing live outbound deliverability from sterlingtraveltech@gmail.com...\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || 'sterlingtraveltech@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'cjvouofrlknxnkqx'
    }
  });

  const targetEmail = 'sterlingtraveltech@gmail.com'; // Deliverability test recipient

  const mailOptions = {
    from: '"David Sterling | AMI Audits" <sterlingtraveltech@gmail.com>',
    to: targetEmail,
    replyTo: 'ami@getguruautomations.com',
    subject: 'Quick diagnostic on your Google Maps & mobile presence in Trinidad',
    text: `Hi Team,

Came across your services in Trinidad today. Love the quality of work you guys are delivering.

While reviewing top local listings, I noticed your Google Business profile is missing recent review triggers and local search tags, allowing smaller competitors to capture top Map pack rankings in your area.

We built AMI (Automated Marketing Inspector) to give business owners instant clarity on what is broken:

👉 https://ami.getguruautomations.com

You can run your business through our free 60-second presence diagnostic to view your 10-point scorecard.

If you'd like our team to optimize your Google profile, fix mobile conversion leaks, and set up an automated review collection funnel for you this month, feel free to reply directly to this email or book our Done-For-You Retainer on the site.

Best regards,

David Sterling
Operations Lead | AMI Digital Audits
ASOT Marketing & Investments
ami@getguruautomations.com
https://ami.getguruautomations.com
`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Deliverability Test SUCCESS! Message ID: ${info.messageId}`);
    console.log(`Preview: Sent to ${targetEmail}`);
  } catch (err: any) {
    console.error('❌ Email sending failed:', err.message);
  }
}

sendTestPitch();
