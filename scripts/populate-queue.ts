import { scanAndDiagnoseWebsite, ScannedLead } from './lead-audit-scanner';
import { loadHistory, saveHistory } from './scheduled-outreach-queue';

const CANDIDATE_TARGETS = [
  // --- US High-Ticket Roofing & Solar (Texas, Florida, Arizona) ---
  {
    businessName: 'Austin Roofing & Construction',
    website: 'https://austinroofingandconstruction.com',
    category: 'Commercial & Residential Roofing',
    location: 'Austin, TX'
  },
  {
    businessName: 'Monarch Roofing',
    website: 'https://monarchroofing.biz',
    category: 'Roofing & Solar Contracting',
    location: 'Tampa / Sarasota, FL'
  },
  {
    businessName: 'Triangle Roofing Company',
    website: 'https://triangleroofing.com',
    category: 'Commercial Roofing Services',
    location: 'Phoenix, AZ'
  },
  {
    businessName: 'Alba Energy Solar Systems',
    website: 'https://albasolar.com',
    category: 'Commercial Solar PV Engineering',
    location: 'San Antonio / Austin, TX'
  },
  
  // --- UK High-Ticket Solar & Private Clinics (London, Manchester) ---
  {
    businessName: 'Solar UK Ltd',
    website: 'https://solaruk.com',
    category: 'Solar PV & Heat Pump Engineering',
    location: 'London & Southeast, UK'
  },
  {
    businessName: 'UK Solar Renewables',
    website: 'https://uksolarrenewables.co.uk',
    category: 'Commercial Solar Energy Systems',
    location: 'Manchester, UK'
  },
  {
    businessName: 'Harley Street Dental Clinic',
    website: 'https://harleystreetdentalclinic.co.uk',
    category: 'Specialist Cosmetic Dentistry & Orthodontics',
    location: 'London, UK'
  },
  {
    businessName: 'London Cosmetic Dental',
    website: 'https://londoncosmeticdental.co.uk',
    category: 'Private Cosmetic Dental Practice',
    location: 'London, UK'
  },

  // --- Canada Specialty Dental & Commercial Services (Toronto, Calgary) ---
  {
    businessName: 'Avenue Dental Clinic',
    website: 'https://avenuedental.ca',
    category: 'Dental Surgery & Implants',
    location: 'Toronto, ON'
  },
  {
    businessName: 'Yorkville Dental Arts',
    website: 'https://yorkvilledental.com',
    category: 'Cosmetic Dentistry & Smile Design',
    location: 'Toronto, ON'
  }
];

async function populateQueue() {
  console.log('======================================================');
  console.log('🌍 GLOBAL HIGH-TICKET LEAD SCANNER & ZERO-BOUNCE AUDIT');
  console.log('======================================================\n');

  const history = loadHistory();
  const alreadyQueued = new Set(history.queuedLeads.map(l => l.businessName.toLowerCase()));
  const alreadySent = new Set(history.sentRecords.map(s => s.businessName.toLowerCase()));

  let newQualifiedCount = 0;

  for (const target of CANDIDATE_TARGETS) {
    if (alreadySent.has(target.businessName.toLowerCase())) {
      console.log(`⏩ ${target.businessName} was already pitched. Skipping.`);
      continue;
    }
    if (alreadyQueued.has(target.businessName.toLowerCase())) {
      console.log(`ℹ️ ${target.businessName} is already in the queue.`);
      continue;
    }

    console.log(`\n🔎 Scanning: ${target.businessName} (${target.location})...`);
    const scanned = await scanAndDiagnoseWebsite(target);
    console.log(`   Result: [${scanned.status}] | Score: ${scanned.qualificationScore} | Email: ${scanned.verifiedEmail || 'None'} | MX: ${scanned.mxHost || 'None'}`);

    if (scanned.status === 'QUALIFIED' && scanned.verifiedEmail) {
      history.queuedLeads.push(scanned);
      newQualifiedCount++;
      console.log(`   ✅ ADDED TO SCHEDULED QUEUE! (Verified: ${scanned.verifiedEmail})`);
    } else {
      console.log(`   ⚠️ Route to Direct Phone / LinkedIn / WA (Email unverified on domain).`);
    }
  }

  saveHistory(history);

  console.log('\n======================================================');
  console.log(`🎯 GLOBAL SCAN COMPLETED`);
  console.log(`   Newly Added to Queue: ${newQualifiedCount}`);
  console.log(`   Total Waiting in Queue: ${history.queuedLeads.length}`);
  console.log('======================================================\n');
}

populateQueue();
