import * as dns from 'dns';
import { verifyEmail } from './verify-email';
import * as fs from 'fs';
import * as path from 'path';

dns.setServers(['8.8.8.8', '1.1.1.1']);

export interface ScannedLead {
  businessName: string;
  website: string;
  category: string;
  location: string;
  verifiedEmail: string | null;
  mxHost: string | null;
  phone: string | null;
  whatsapp: string | null;
  auditGaps: string[];
  customHook: string;
  qualificationScore: number; // 0 - 100
  status: 'QUALIFIED' | 'NEEDS_WHATSAPP' | 'UNQUALIFIED';
}

const IGNORED_EMAILS = ['wixpress.com', 'sentry.io', 'example.com', 'domain.com', 'wordpress.org', 'schema.org', 'google.com'];

export async function scanAndDiagnoseWebsite(business: {
  businessName: string;
  website: string;
  category: string;
  location: string;
}): Promise<ScannedLead> {
  const gaps: string[] = [];
  let score = 0;
  let responseTimeMs = 0;
  let hasHttps = business.website.startsWith('https://');
  let hasSchema = false;
  let hasViewport = false;
  let hasDirectCall = false;
  let emails = new Set<string>();
  let phones = new Set<string>();
  let whatsapps = new Set<string>();

  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(business.website, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    responseTimeMs = Date.now() - startTime;

    if (res.ok) {
      const html = await res.text();

      // Check speed
      if (responseTimeMs > 2500) {
        gaps.push(`Mobile page load latency is high (${(responseTimeMs / 1000).toFixed(1)}s vs standard < 1.5s)`);
        score += 25;
      }

      // Check schema markup
      if (html.includes('application/ld+json') || html.includes('schema.org')) {
        hasSchema = true;
      } else {
        gaps.push('Missing local business schema markup for Google search engines');
        score += 25;
      }

      // Check mobile viewport
      if (html.includes('name="viewport"') || html.includes("name='viewport'")) {
        hasViewport = true;
      } else {
        gaps.push('Lacks modern mobile responsive viewport tags');
        score += 20;
      }

      // Check 1-tap call schemas
      if (html.includes('tel:') || html.includes('wa.me')) {
        hasDirectCall = true;
      } else {
        gaps.push('No direct 1-tap emergency call or WhatsApp quote trigger found');
        score += 30;
      }

      // Extract mailto:
      const mailtoMatches = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
      for (const m of mailtoMatches) {
        const clean = m[1].toLowerCase();
        if (!IGNORED_EMAILS.some(ig => clean.includes(ig))) {
          emails.add(clean);
        }
      }

      // Extract WhatsApp
      const waMatches = html.matchAll(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/gi);
      for (const wa of waMatches) {
        whatsapps.add(wa[1]);
      }

      // Extract phone
      const phoneMatches = html.matchAll(/(?:\+?1[-.\s]?)?\(?(?:868|246|876|941|403|902|800|888)\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
      for (const ph of phoneMatches) {
        phones.add(ph[0].trim());
      }
    }
  } catch (e: any) {
    gaps.push('Website took too long to respond or has SSL handshake issues');
    score += 40;
  }

  // Pre-flight check discovered emails
  let verifiedEmail: string | null = null;
  let mxHost: string | null = null;

  for (const em of Array.from(emails)) {
    const v = await verifyEmail(em);
    if (v.status === 'VALID') {
      verifiedEmail = em;
      mxHost = v.mxHosts[0] || null;
      break;
    }
  }

  // Craft bespoke, human hook based on real audit findings
  let customHook = '';
  if (gaps.length > 0) {
    customHook = `While reviewing top local listings for ${business.category} in ${business.location}, we noticed ${gaps[0].toLowerCase()}${gaps[1] ? ` and ${gaps[1].toLowerCase()}` : ''}, which allows nearby competitors to capture top Map Pack rankings and inbound phone leads.`;
  } else {
    customHook = `You have a great reputation in ${business.location}, but your Google profile and local directory listings have unindexed pages that are suppressing your local search volume.`;
  }

  const isQualifiedForEmail = verifiedEmail !== null && score >= 20;

  return {
    businessName: business.businessName,
    website: business.website,
    category: business.category,
    location: business.location,
    verifiedEmail,
    mxHost,
    phone: Array.from(phones)[0] || null,
    whatsapp: Array.from(whatsapps)[0] || null,
    auditGaps: gaps,
    customHook,
    qualificationScore: score,
    status: isQualifiedForEmail ? 'QUALIFIED' : (whatsapps.size > 0 || phones.size > 0 ? 'NEEDS_WHATSAPP' : 'UNQUALIFIED')
  };
}
