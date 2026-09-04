import * as dns from 'dns';
import * as dotenv from 'dotenv';
import { auditAndVerifyProspect, VerifiedLead } from './find-and-verify-leads';
dotenv.config();

dns.setServers(['8.8.8.8', '1.1.1.1']);

const CANDIDATE_COMPANIES = [
  {
    businessName: 'RESSCOTT LTD (Solar)',
    website: 'https://resscott.com',
    category: 'Renewable Energy & Solar',
    location: 'Trinidad & Tobago'
  },
  {
    businessName: 'Solar Watt Systems Inc',
    website: 'https://solarwattsystems.com',
    category: 'Solar Engineering',
    location: 'Barbados'
  },
  {
    businessName: 'Sutter Roofing Company',
    website: 'https://sutterroofing.com',
    category: 'Commercial Roofing',
    location: 'Sarasota, FL'
  },
  {
    businessName: 'Accurate Roofing Halifax',
    website: 'https://accurateroofing.ca',
    category: 'Roofing Services',
    location: 'Halifax, NS'
  },
  {
    businessName: 'Calgary Elite Roofing',
    website: 'https://calgaryeliteroofing.com',
    category: 'Residential Roofing',
    location: 'Calgary, AB'
  },
  {
    businessName: 'The Orthodontic Centre Ltd',
    website: 'https://orthodonticcentrett.com',
    category: 'Orthodontics & Dental Clinic',
    location: 'Trinidad & Tobago'
  },
  {
    businessName: 'Professional Interior Designs Ltd',
    website: 'https://pidl.co.tt',
    category: 'Interior Design',
    location: 'Trinidad & Tobago'
  },
  {
    businessName: 'Caribbean Smile Makers',
    website: 'https://caribbeansmilemakers.com',
    category: 'Orthodontics & Invisalign',
    location: 'Barbados'
  },
  {
    businessName: 'Plumbing Solutions TT',
    website: 'https://plumbingsolutionstt.com',
    category: 'Plumbing Services',
    location: 'Trinidad'
  }
];

async function runComprehensiveVerification() {
  console.log('======================================================');
  console.log('🔬 RUNNING DEEP ZERO-BOUNCE LEAD VERIFICATION PIPELINE');
  console.log('======================================================\n');

  const verifiedList: VerifiedLead[] = [];

  for (const comp of CANDIDATE_COMPANIES) {
    const res = await auditAndVerifyProspect(comp);
    verifiedList.push(res);
  }

  console.log('\n======================================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('======================================================\n');

  for (const item of verifiedList) {
    console.log(`🏢 ${item.businessName} (${item.location})`);
    console.log(`   Status:   [${item.status}]`);
    console.log(`   Email:    ${item.verifiedEmail || 'None (Use WhatsApp/Phone)'}`);
    console.log(`   MX Host:  ${item.mxHost || 'None'}`);
    console.log(`   Phone:    ${item.phone || 'N/A'}`);
    console.log(`   WhatsApp: ${item.whatsapp || 'N/A'}`);
    console.log(`   Notes:    ${item.notes}`);
    console.log('------------------------------------------------------');
  }
}

runComprehensiveVerification();
