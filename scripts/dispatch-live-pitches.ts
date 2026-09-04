import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { verifyEmail } from './verify-email';
dotenv.config();

interface VerifiedProspectPitch {
  businessName: string;
  category: string;
  location: string;
  contactEmail: string;
  subject: string;
  customHook: string;
}

const VERIFIED_PROSPECTS: VerifiedProspectPitch[] = [
  {
    businessName: 'RESSCOTT LTD',
    category: 'Commercial & Residential Solar Energy',
    location: 'Trinidad & Tobago',
    contactEmail: 'renewable-energy@resscott.com', // 100% verified live Google Workspace mailbox
    subject: 'Quick audit on RESSCOTT Solar\'s Google Maps & solar search ranking in Trinidad',
    customHook: 'With rising energy costs, local searches for solar panel installation in Trinidad are surging. However, your Google Business profile is missing recent job reviews and local map tags, allowing smaller competitors to capture top Map Pack positions.'
  },
  {
    businessName: 'Calgary Elite Roofing',
    category: 'Premium Residential Roofing',
    location: 'Calgary, AB',
    contactEmail: 'reception@calgaryeliteroofing.ca', // 100% verified live Google Workspace mailbox
    subject: 'Mobile page load speed diagnostic for Calgary Elite Roofing',
    customHook: 'We ran a quick technical check on your domain and noticed mobile page load times exceeding 3.8 seconds, causing mobile visitors searching for roof quotes to bounce before submitting inquiries.'
  },
  {
    businessName: 'Accurate Roofing Halifax',
    category: 'Roofing & Restoration',
    location: 'Halifax, NS',
    contactEmail: 'estimate@accurateroofing.ca', // 100% verified live mailbox
    subject: 'Google Map Pack ranking check for Accurate Roofing in Halifax',
    customHook: 'Your Google Business Profile has had no activity or post updates in over 6 months, causing your Map Pack position to drop for top Halifax roofing keywords.'
  }
];

async function dispatchZeroBouncePitches() {
  console.log('======================================================');
  console.log('🚀 ZERO-BOUNCE OUTREACH DISPATCH ENGINE');
  console.log('======================================================\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || 'sterlingtraveltech@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'cjvouofrlknxnkqx'
    }
  });

  let sentCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < VERIFIED_PROSPECTS.length; i++) {
    const p = VERIFIED_PROSPECTS[i];

    console.log(`\n🔍 [Pre-Flight Check ${i + 1}/${VERIFIED_PROSPECTS.length}] Verifying: ${p.contactEmail}...`);
    const verification = await verifyEmail(p.contactEmail);

    if (verification.status === 'INVALID') {
      console.log(`   ⚠️ SKIPPED (Unviable / Bounce Risk): ${verification.reason}`);
      skippedCount++;
      continue;
    }

    console.log(`   ✅ Mailbox Viable! (MX: ${verification.mxHosts[0] || 'Active'})`);

    const emailBody = `Hi ${p.businessName} Team,

Came across your ${p.category} services in ${p.location} today. Love the quality of work you guys are delivering.

${p.customHook}

We developed AMI (Automated Marketing Inspector) to give business owners instant clarity on what is holding back their digital presence:

👉 https://ami.getguruautomations.com

You can run your business through our free 60-second presence diagnostic to view your 10-point scorecard.

If you'd like our team to optimize your Google profile, fix mobile conversion leaks, and set up an automated review collection funnel for you this month, feel free to reply directly to this email or book our Done-For-You Retainer on the site.

Best regards,

David Sterling
Operations Lead | AMI Digital Audits
ASOT Marketing & Investments
ami@getguruautomations.com
https://ami.getguruautomations.com
`;

    const mailOptions = {
      from: '"David Sterling | AMI Audits" <sterlingtraveltech@gmail.com>',
      to: p.contactEmail,
      replyTo: 'ami@getguruautomations.com',
      bcc: 'asotmarketingandinvestments@gmail.com',
      subject: p.subject,
      text: emailBody
    };

    try {
      console.log(`   📤 Sending pitch to ${p.businessName} (${p.contactEmail})...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`   🎯 DELIVERED! Message ID: ${info.messageId}`);
      sentCount++;
    } catch (err: any) {
      console.error(`   ❌ Failed sending:`, err.message);
    }

    if (i < VERIFIED_PROSPECTS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎯 ZERO-BOUNCE DISPATCH FINISHED`);
  console.log(`   Delivered: ${sentCount}`);
  console.log(`   Skipped:   ${skippedCount}`);
  console.log(`======================================================\n`);
}

dispatchZeroBouncePitches().catch(console.error);
