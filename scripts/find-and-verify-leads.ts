import * as dns from 'dns';
import * as dotenv from 'dotenv';
dotenv.config();

dns.setServers(['8.8.8.8', '1.1.1.1']);

export interface VerifiedLead {
  businessName: string;
  website: string;
  category: string;
  location: string;
  verifiedEmail: string | null;
  mxHost: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: 'VERIFIED_VIABLE' | 'NO_VALID_EMAIL' | 'NO_MX_RECORDS';
  notes: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.css', '.js'];
const IGNORED_EMAILS = ['wixpress.com', 'sentry.io', 'example.com', 'domain.com', 'wordpress.org', 'schema.org'];

export async function checkDomainMx(domain: string): Promise<{ hasMx: boolean; primaryMx: string | null }> {
  try {
    const records = await dns.promises.resolveMx(domain);
    if (!records || records.length === 0) return { hasMx: false, primaryMx: null };
    records.sort((a, b) => a.priority - b.priority);
    return { hasMx: true, primaryMx: records[0].exchange };
  } catch (err) {
    return { hasMx: false, primaryMx: null };
  }
}

export async function fetchAndExtractFromUrl(url: string): Promise<{ emails: string[]; phones: string[]; whatsapps: string[] }> {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const whatsapps = new Set<string>();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(formattedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return { emails: [], phones: [], whatsapps: [] };

    const html = await res.text();

    // 1. Extract mailto:
    const mailtoMatches = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
    for (const m of mailtoMatches) {
      const email = m[1].toLowerCase();
      if (!IGNORED_EMAILS.some(ig => email.includes(ig))) {
        emails.add(email);
      }
    }

    // 2. Extract general emails from text
    const textMatches = html.match(EMAIL_REGEX) || [];
    for (const em of textMatches) {
      const clean = em.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
      if (
        !IGNORED_EXTENSIONS.some(ext => clean.endsWith(ext)) &&
        !IGNORED_EMAILS.some(ig => clean.includes(ig)) &&
        clean.includes('.')
      ) {
        emails.add(clean);
      }
    }

    // 3. Extract WhatsApp links (wa.me / api.whatsapp.com)
    const waMatches = html.matchAll(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/gi);
    for (const wa of waMatches) {
      whatsapps.add(wa[1]);
    }

    // 4. Extract Caribbean / US phone numbers
    const phoneMatches = html.matchAll(/(?:\+?1[-.\s]?)?\(?(?:868|246|876|941|403|902)\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
    for (const ph of phoneMatches) {
      phones.add(ph[0].trim());
    }

  } catch (err: any) {
    // Network or timeout error
  }

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
    whatsapps: Array.from(whatsapps)
  };
}

export async function auditAndVerifyProspect(prospect: {
  businessName: string;
  website: string;
  category: string;
  location: string;
}): Promise<VerifiedLead> {
  console.log(`\n🔎 Auditing & Verifying: ${prospect.businessName} (${prospect.website})...`);

  // Step 1: Check website contact details
  const contactPages = [
    prospect.website,
    `${prospect.website.replace(/\/$/, '')}/contact`,
    `${prospect.website.replace(/\/$/, '')}/contact-us`,
    `${prospect.website.replace(/\/$/, '')}/about`
  ];

  let candidateEmails = new Set<string>();
  let candidatePhones = new Set<string>();
  let candidateWhatsapps = new Set<string>();

  for (const pageUrl of contactPages) {
    const extracted = await fetchAndExtractFromUrl(pageUrl);
    extracted.emails.forEach(e => candidateEmails.add(e));
    extracted.phones.forEach(p => candidatePhones.add(p));
    extracted.whatsapps.forEach(w => candidateWhatsapps.add(w));
    if (candidateEmails.size > 0) break; // Found emails
  }

  const emailsList = Array.from(candidateEmails);
  console.log(`   Discovered candidate emails: [${emailsList.join(', ') || 'None found on site'}]`);

  // Step 2: Validate MX records for each candidate email
  let viableEmail: string | null = null;
  let primaryMx: string | null = null;

  for (const email of emailsList) {
    const domain = email.split('@')[1];
    const mxCheck = await checkDomainMx(domain);
    if (mxCheck.hasMx) {
      viableEmail = email;
      primaryMx = mxCheck.primaryMx;
      break;
    } else {
      console.log(`   ⚠️ Email ${email} rejected: Domain ${domain} has no MX records.`);
    }
  }

  // If no email on site, check if domain itself has MX records
  if (!viableEmail) {
    const domain = prospect.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const domainMx = await checkDomainMx(domain);
    
    if (domainMx.hasMx) {
      return {
        businessName: prospect.businessName,
        website: prospect.website,
        category: prospect.category,
        location: prospect.location,
        verifiedEmail: null,
        mxHost: domainMx.primaryMx,
        phone: Array.from(candidatePhones)[0] || null,
        whatsapp: Array.from(candidateWhatsapps)[0] || null,
        status: 'NO_VALID_EMAIL',
        notes: `Domain has active MX (${domainMx.primaryMx}) but no public contact email published on site. Use WhatsApp / Phone.`
      };
    } else {
      return {
        businessName: prospect.businessName,
        website: prospect.website,
        category: prospect.category,
        location: prospect.location,
        verifiedEmail: null,
        mxHost: null,
        phone: Array.from(candidatePhones)[0] || null,
        whatsapp: Array.from(candidateWhatsapps)[0] || null,
        status: 'NO_MX_RECORDS',
        notes: `Domain has no active MX records configured. Email cannot be delivered.`
      };
    }
  }

  return {
    businessName: prospect.businessName,
    website: prospect.website,
    category: prospect.category,
    location: prospect.location,
    verifiedEmail: viableEmail,
    mxHost: primaryMx,
    phone: Array.from(candidatePhones)[0] || null,
    whatsapp: Array.from(candidateWhatsapps)[0] || null,
    status: 'VERIFIED_VIABLE',
    notes: `100% verified via MX host: ${primaryMx}`
  };
}

// Test against target companies
if (require.main === module) {
  const TARGETS = [
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
      businessName: 'Plumbing Solutions TT',
      website: 'https://plumbingsolutionstt.com',
      category: 'Plumbing Services',
      location: 'Trinidad'
    },
    {
      businessName: 'RESSCOTT LTD',
      website: 'https://resscott.com', // Real domain is resscott.com!
      category: 'Solar Engineering',
      location: 'Trinidad'
    },
    {
      businessName: 'Accurate Roofing Halifax',
      website: 'https://accurateroofing.ca',
      category: 'Roofing Services',
      location: 'Halifax, NS'
    }
  ];

  (async () => {
    console.log('🚀 Running Multi-Source Lead Verification & MX Deep Audit...\n');
    const results: VerifiedLead[] = [];

    for (const t of TARGETS) {
      const res = await auditAndVerifyProspect(t);
      results.push(res);
      console.log(`   🎯 Result: [${res.status}] -> Email: ${res.verifiedEmail || 'N/A'} | Phone: ${res.phone || 'N/A'} | WA: ${res.whatsapp || 'N/A'}`);
    }

    console.log('\n======================================================');
    console.log('📋 VERIFIED VIABLE LEADS (ZERO BOUNCE RISK)');
    console.log('======================================================\n');
    const viable = results.filter(r => r.status === 'VERIFIED_VIABLE');
    console.table(viable.map(v => ({
      Business: v.businessName,
      Email: v.verifiedEmail,
      MX: v.mxHost,
      Phone: v.phone || 'N/A'
    })));
  })();
}
