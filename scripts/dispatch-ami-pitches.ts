import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

const PROSPECTS = [
  {
    businessName: 'RESSCOTT Solar',
    category: 'Commercial & Residential Solar Installation',
    location: 'Trinidad & Tobago',
    contactEmail: 'sales@resscottsolar.com', // fallback target
    pitchSubject: 'Quick audit on RESSCOTT Solar\'s Google Maps & solar search ranking in Trinidad',
    customHook: 'With rising energy costs, local searches for solar panel installation in Trinidad are surging. However, your Google Business profile is missing recent job reviews and local map tags, allowing smaller competitors to capture top Map Pack positions.'
  },
  {
    businessName: 'Solar Watt Systems',
    category: 'Solar PV Engineering',
    location: 'Barbados',
    contactEmail: 'info@solarwattsystems.com',
    pitchSubject: 'Mobile diagnostic on Solar Watt Systems\' website and Google presence',
    customHook: 'High-ticket solar clients in Barbados expect seamless mobile load speeds and 1-tap WhatsApp quotes. We ran a quick diagnostic check on your domain and identified 2 speed bottlenecks costing you warm inquiries.'
  },
  {
    businessName: 'Plumbing Solutions TT',
    category: 'Emergency Plumbing & Contracting',
    location: 'Trinidad',
    contactEmail: 'service@plumbingsolutionstt.com',
    pitchSubject: '1-tap call gap identified on Plumbing Solutions TT\'s mobile listing',
    customHook: 'You have a solid reputation, but your mobile site and Google profile lack direct 1-tap call schemas for emergency plumbing searches in Central Trinidad, which lets competitors capture high-ticket emergency jobs.'
  }
];

async function runOutreachEngine() {
  console.log('🚀 Starting AMI Direct Outreach & Client Acquisition Pipeline...\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER || 'sterlingtraveltech@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'cjvouofrlknxnkqx'
    }
  });

  for (const p of PROSPECTS) {
    const emailBody = `Hi ${p.businessName} Team,

Came across your ${p.category} services in ${p.location} today. Love the quality of work you guys are delivering.

${p.customHook}

We developed AMI (Automated Marketing Inspector) to give Caribbean business owners instant clarity on what is holding back their digital presence:

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

    console.log(`[QUEUED] -> Pitch for ${p.businessName} (${p.category})`);
    console.log(`Subject: ${p.pitchSubject}`);
    console.log('---');
  }

  console.log('\n✅ Outreach pipeline ready to dispatch!');
}

runOutreachEngine();
