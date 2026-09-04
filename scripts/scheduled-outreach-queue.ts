import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ScannedLead } from './lead-audit-scanner';
import { verifyEmail } from './verify-email';
dotenv.config();

const QUEUE_FILE = path.join(__dirname, '..', 'queue', 'outreach-history.json');

export interface OutreachRecord {
  businessName: string;
  category: string;
  location: string;
  email: string;
  dateSent: string;
  timeSent: string;
  messageId: string;
  status: 'DELIVERED' | 'BOUNCED' | 'REPLIED';
}

function ensureQueueDir() {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ sentRecords: [], queuedLeads: [] }, null, 2));
  }
}

export function isWithinSendingWindow(): { allowed: boolean; reason: string } {
  const now = new Date();
  // Trinidad & Tobago is UTC-4 (Atlantic Standard Time)
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const astHours = (utcHours - 4 + 24) % 24;
  const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 6 is Saturday

  // Check Monday (1) to Friday (5)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { allowed: false, reason: `Today is a weekend (Day ${dayOfWeek}). Outreach is scheduled Monday to Friday.` };
  }

  // Check 9:00 AM (9) to 3:30 PM (15:30)
  const currentMinutesTotal = astHours * 60 + utcMinutes;
  const startMinutes = 9 * 60; // 09:00 AM
  const endMinutes = 15 * 60 + 30; // 03:30 PM

  if (currentMinutesTotal < startMinutes || currentMinutesTotal > endMinutes) {
    return {
      allowed: false,
      reason: `Current time is ${astHours}:${String(utcMinutes).padStart(2, '0')} AST. Allowed window is 9:00 AM to 3:30 PM AST.`
    };
  }

  return { allowed: true, reason: `Within window (${astHours}:${String(utcMinutes).padStart(2, '0')} AST, Mon-Fri)` };
}

export function loadHistory(): { sentRecords: OutreachRecord[]; queuedLeads: ScannedLead[] } {
  ensureQueueDir();
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
  } catch (e) {
    return { sentRecords: [], queuedLeads: [] };
  }
}

export function saveHistory(data: { sentRecords: OutreachRecord[]; queuedLeads: ScannedLead[] }) {
  ensureQueueDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));
}

export async function processDailyBatch(maxBatchSize: number = 5, enforceWindow: boolean = true) {
  console.log('======================================================');
  console.log('📬 AMI REPUTATION-PROTECTED DAILY OUTREACH ENGINE');
  console.log('======================================================\n');

  const windowCheck = isWithinSendingWindow();
  console.log(`🕒 Window Status: ${windowCheck.reason}`);

  if (enforceWindow && !windowCheck.allowed) {
    console.log('⏸️ Dispatch paused until next active 9:00 AM – 3:30 PM window.');
    return;
  }

  const history = loadHistory();
  const alreadySentEmails = new Set(history.sentRecords.map(r => r.email.toLowerCase()));

  // Count how many sent today
  const todayStr = new Date().toISOString().split('T')[0];
  const sentToday = history.sentRecords.filter(r => r.dateSent === todayStr).length;

  console.log(`📊 Sent Today: ${sentToday} / ${maxBatchSize} max daily limit`);

  if (sentToday >= maxBatchSize) {
    console.log('✅ Daily outreach quota reached. Protecting sender reputation.');
    return;
  }

  const remainingQuota = maxBatchSize - sentToday;
  const availableQueue = history.queuedLeads.filter(
    lead => lead.verifiedEmail && !alreadySentEmails.has(lead.verifiedEmail.toLowerCase())
  );

  console.log(`📋 Verified Qualified Leads in Queue: ${availableQueue.length}`);

  if (availableQueue.length === 0) {
    console.log('ℹ️ No new verified leads waiting in queue.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || 'sterlingtraveltech@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'cjvouofrlknxnkqx'
    }
  });

  const batch = availableQueue.slice(0, remainingQuota);

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i];
    const targetEmail = lead.verifiedEmail!;

    // Re-verify before sending
    const v = await verifyEmail(targetEmail);
    if (v.status !== 'VALID') {
      console.log(`⚠️ Skipping ${targetEmail} — Failed re-verification: ${v.reason}`);
      continue;
    }

    const emailBody = `Hi ${lead.businessName} Team,

Came across your ${lead.category} services in ${lead.location} today. Love the quality of work you guys are delivering.

${lead.customHook}

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
      to: targetEmail,
      replyTo: 'ami@getguruautomations.com',
      bcc: 'asotmarketingandinvestments@gmail.com',
      subject: `Diagnostic check for ${lead.businessName}'s Google presence in ${lead.location}`,
      text: emailBody
    };

    try {
      console.log(`\n📤 [${i + 1}/${batch.length}] Dispatching to ${lead.businessName} (${targetEmail})...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`   🎯 DELIVERED! Message ID: ${info.messageId}`);

      history.sentRecords.push({
        businessName: lead.businessName,
        category: lead.category,
        location: lead.location,
        email: targetEmail,
        dateSent: todayStr,
        timeSent: new Date().toLocaleTimeString(),
        messageId: info.messageId,
        status: 'DELIVERED'
      });

      // Remove from queued list
      history.queuedLeads = history.queuedLeads.filter(q => q.verifiedEmail !== targetEmail);
      saveHistory(history);

      // Random delay between sends (e.g. 5-15s in test, 15-30m in background scheduler)
      if (i < batch.length - 1) {
        console.log(`   ⏳ Pacing pause before next pitch...`);
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (err: any) {
      console.error(`   ❌ Failed sending:`, err.message);
    }
  }

  console.log('\n======================================================');
  console.log('🎯 DAILY BATCH CYCLE COMPLETE');
  console.log('======================================================\n');
}

if (require.main === module) {
  processDailyBatch(5, false); // Run batch check
}
