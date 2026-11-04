/**
 * Zero-dependency, Edge-compatible HTML Sanitizer and Markdown Converter
 * Designed for token-efficient LLM context ingestion.
 */

import puppeteer from '@cloudflare/puppeteer';
import { Env } from './types';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  markdownSummary?: string;
}

export interface SearchAndScrapeResult {
  query: string;
  results: SearchResultItem[];
  tokensEstimated: number;
}

// SSRF Protection: Block private IP ranges and internal hostnames
export function validateUrl(inputUrl: string): { valid: boolean; error?: string; url?: URL } {
  try {
    const parsed = new URL(inputUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only http and https are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for loopback and local hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      return { valid: false, error: 'Access to localhost/loopback addresses is prohibited for security.' };
    }

    // Block AWS / GCP / Cloud metadata endpoint
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: false, error: 'Access to cloud instance metadata is prohibited.' };
    }

    // IPv4 private subnet ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [_, o1, o2] = match.map(Number);
      if (
        o1 === 10 || // 10.0.0.0/8
        (o1 === 172 && o2 >= 16 && o2 <= 31) || // 172.16.0.0/12
        (o1 === 192 && o2 === 168) || // 192.168.0.0/16
        o1 === 127 || // 127.0.0.0/8
        o1 === 0 // 0.0.0.0/8
      ) {
        return { valid: false, error: 'Access to private internal IPv4 subnets is prohibited.' };
      }
    }

    return { valid: true, url: parsed };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Stealth modern browser headers for bot defense evasion
 */
export function getStealthHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1'
  };
}

/**
 * Extracts and formats clean Markdown from a PDF ArrayBuffer
 */
export async function extractPdfToMarkdown(
  arrayBuffer: ArrayBuffer,
  fallbackTitle?: string
): Promise<{
  title: string;
  markdown: string;
  totalPages: number;
  tokensEstimated: number;
}> {
  // Polyfill DOMMatrix for PDF.js inside Cloudflare Workers edge V8 isolates
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(init?: number[] | string) {
        if (Array.isArray(init)) {
          if (init.length === 6) {
            this.a = this.m11 = init[0]; this.b = this.m12 = init[1];
            this.c = this.m21 = init[2]; this.d = this.m22 = init[3];
            this.e = this.m41 = init[4]; this.f = this.m42 = init[5];
          }
        }
      }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      inverse() { return this; }
    };
  }

  // Pre-load the inline PDF worker handler to activate fake-worker mode without workerSrc
  try {
    // @ts-ignore
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  } catch (e) {
    // ignore
  }

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true
  });

  const result = await parser.getText();
  const pagesArray = result.pages || [];
  const totalPages = result.total || pagesArray.length || 1;

  let fullMarkdown = '';
  let docTitle = fallbackTitle || 'PDF Document';

  for (let i = 0; i < pagesArray.length; i++) {
    const pageText = (pagesArray[i]?.text || '').trim();
    if (!pageText) continue;

    if (i === 0 && (!fallbackTitle || fallbackTitle === 'document.pdf')) {
      const firstLine = pageText.split('\n').map((l: string) => l.trim()).find((l: string) => l.length > 3 && l.length < 120);
      if (firstLine) {
        docTitle = firstLine;
      }
    }

    fullMarkdown += `\n\n---\n*Page ${i + 1} of ${totalPages}*\n\n` + pageText;
  }

  const cleanMd = `# ${docTitle}\n` + fullMarkdown.trim();
  return {
    title: docTitle,
    markdown: cleanMd,
    totalPages,
    tokensEstimated: estimateTokens(cleanMd)
  };
}

/**
 * Fetch and extract clean Markdown from a target URL with multi-tier anti-bot evasion
 */
export async function scrapeToMarkdown(
  targetUrl: string,
  env?: Env,
  renderJs: boolean = false
): Promise<{
  title: string;
  markdown: string;
  tokensEstimated: number;
  bypassTier?: string;
  totalPages?: number;
}> {
  const urlCheck = validateUrl(targetUrl);
  if (!urlCheck.valid || !urlCheck.url) {
    throw new Error(urlCheck.error || 'Invalid URL');
  }

  // 1. Explicit Headless Browser Mode (if requested and available)
  if (renderJs && env?.MYBROWSER) {
    try {
      const browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      );
      await page.goto(urlCheck.url.toString(), { waitUntil: 'networkidle0', timeout: 25000 });
      const html = await page.content();
      const pageTitle = await page.title();
      await browser.close();

      const { title, markdown } = htmlToMarkdown(html, urlCheck.url.origin);
      return {
        title: pageTitle || title || urlCheck.url.hostname,
        markdown,
        tokensEstimated: estimateTokens(markdown),
        bypassTier: 'headless_browser'
      };
    } catch {
      // Fall through to stealth fetch
    }
  }

  // 2. Tier 1: Stealth Client Hints & Chrome 128 Headers
  let response: Response | null = null;
  let bypassTier = 'stealth_direct';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    response = await fetch(urlCheck.url.toString(), {
      signal: controller.signal,
      headers: getStealthHeaders()
    }).finally(() => clearTimeout(timeoutId));
  } catch (err) {
    // If connection dropped or network timeout, response remains null
  }

  // 3. Tier 2: Check if blocked by Cloudflare/WAF (403, 419, 429, 503) or network failure
  let fallbackError = '';
  if (!response || !response.ok || response.status === 403 || response.status === 419 || response.status === 429 || response.status === 503) {
    // Attempt Edge Headless Browser Unblock
    if (env?.MYBROWSER) {
      try {
        const browser = await puppeteer.launch(env.MYBROWSER);
        const page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        );
        await page.goto(urlCheck.url.toString(), { waitUntil: 'networkidle0', timeout: 25000 });
        const html = await page.content();
        const pageTitle = await page.title();
        await browser.close();

        const { title, markdown } = htmlToMarkdown(html, urlCheck.url.origin);
        return {
          title: pageTitle || title || urlCheck.url.hostname,
          markdown,
          tokensEstimated: estimateTokens(markdown),
          bypassTier: 'headless_browser_unblock'
        };
      } catch (browserErr: any) {
        fallbackError = `Browser error: ${browserErr.message}`;
      }
    }

    // Attempt Mirror Fallback
    try {
      const fallbackUrl = `https://r.jina.ai/${urlCheck.url.origin}${urlCheck.url.pathname}${urlCheck.url.search}`;
      const fallbackCtrl = new AbortController();
      const fbTimeout = setTimeout(() => fallbackCtrl.abort(), 15000);

      const fbResponse = await fetch(fallbackUrl, {
        signal: fallbackCtrl.signal,
        headers: {
          'Accept': 'text/plain,text/markdown,*/*'
        }
      }).finally(() => clearTimeout(fbTimeout));

      if (fbResponse.ok) {
        const fbText = await fbResponse.text();
        if (fbText && fbText.length > 50) {
          let title = urlCheck.url.hostname;
          const titleMatch = fbText.match(/^Title:\s*(.+)$/m);
          if (titleMatch) {
            title = titleMatch[1].trim();
          }
          return {
            title,
            markdown: fbText,
            tokensEstimated: estimateTokens(fbText),
            bypassTier: 'stealth_unblock_mirror'
          };
        } else {
          fallbackError += ` Mirror empty payload (len: ${fbText?.length})`;
        }
      } else {
        fallbackError += ` Mirror HTTP ${fbResponse.status} ${fbResponse.statusText}`;
      }
    } catch (fbErr: any) {
      fallbackError += ` Mirror error: ${fbErr.message}`;
    }

    if (!response) {
      throw new Error(`Failed to reach target URL: Network error or timeout. ${fallbackError}`);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch target URL: HTTP ${response.status} ${response.statusText}. ${fallbackError}`);
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const isPdf = urlCheck.url.pathname.toLowerCase().endsWith('.pdf') || contentType.includes('application/pdf');

  if (isPdf) {
    try {
      const arrayBuffer = await response.arrayBuffer();
      const filename = urlCheck.url.pathname.split('/').pop() || 'document.pdf';
      const pdfRes = await extractPdfToMarkdown(arrayBuffer, filename);
      return {
        title: pdfRes.title,
        markdown: pdfRes.markdown,
        tokensEstimated: pdfRes.tokensEstimated,
        bypassTier: 'pdf_edge_parser',
        totalPages: pdfRes.totalPages
      };
    } catch (pdfErr: any) {
      throw new Error(`PDF extraction failed: ${pdfErr.message}`);
    }
  }

  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
    // If plaintext or json, return raw
    const text = await response.text();
    return {
      title: urlCheck.url.hostname,
      markdown: text,
      tokensEstimated: estimateTokens(text),
      bypassTier
    };
  }

  const rawHtml = await response.text();
  const { title, markdown } = htmlToMarkdown(rawHtml, urlCheck.url.origin);
  const tokensEstimated = estimateTokens(markdown);

  // If parsed markdown is virtually empty (SPA client-side rendering), also attempt Browser hydration
  if (tokensEstimated < 25 && rawHtml.includes('<script')) {
    if (env?.MYBROWSER) {
      try {
        const browser = await puppeteer.launch(env.MYBROWSER);
        const page = await browser.newPage();
        await page.goto(urlCheck.url.toString(), { waitUntil: 'networkidle0', timeout: 25000 });
        const html = await page.content();
        const pageTitle = await page.title();
        await browser.close();

        const res = htmlToMarkdown(html, urlCheck.url.origin);
        return {
          title: pageTitle || res.title || urlCheck.url.hostname,
          markdown: res.markdown,
          tokensEstimated: estimateTokens(res.markdown),
          bypassTier: 'spa_hydrated_browser'
        };
      } catch {}
    }
  }

  return {
    title,
    markdown,
    tokensEstimated,
    bypassTier
  };
}

/**
 * Convert HTML string to token-efficient Markdown
 */
export function htmlToMarkdown(html: string, baseUrl?: string): { title: string; markdown: string } {
  // 1. Extract Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

  // 2. Remove non-content tags & bloat
  let clean = html
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // <script>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // <style>
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '') // <svg>
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, '') // <canvas>
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '') // <noscript>
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // <iframe>
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '') // nav headers
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ''); // footers

  // Strip base64 data images
  clean = clean.replace(/<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi, '');

  // 3. Convert Headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 4. Convert Code Blocks & Inline Code
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n');
  clean = clean.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n');
  clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, ' `$1` ');

  // 5. Convert Blockquotes & HR
  clean = clean.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n');
  clean = clean.replace(/<hr[^>]*>/gi, '\n\n---\n\n');

  // 6. Convert Lists
  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  clean = clean.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // 7. Convert Links & Formatting
  clean = clean.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    let finalHref = href;
    if (baseUrl && href.startsWith('/')) {
      finalHref = `${baseUrl}${href}`;
    }
    return ` [${cleanText}](${finalHref}) `;
  });

  clean = clean.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, ' **$2** ');
  clean = clean.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, ' *$2* ');

  // 8. Paragraphs & Line Breaks
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/(p|div|section|article)>/gi, '\n\n');
  clean = clean.replace(/<(p|div|section|article)[^>]*>/gi, '');

  // 9. Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // 10. Decode HTML entities
  clean = decodeHtmlEntities(clean);

  // 11. Normalize Whitespace & Empty Lines
  clean = clean
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, markdown: clean };
}

/**
 * Decode common HTML entities
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Token Estimation Heuristic (Tokens are ~3.8-4 chars in English markdown)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Searches the web and scrapes top results into clean Markdown summaries
 */
export async function searchAndScrapeToMarkdown(
  query: string,
  limit: number = 3
): Promise<SearchAndScrapeResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error('Search query cannot be empty.');
  }

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let searchHtml = '';
  try {
    const searchRes = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!searchRes.ok) {
      throw new Error(`Search provider returned HTTP ${searchRes.status}`);
    }
    searchHtml = await searchRes.text();
  } catch (err: any) {
    throw new Error(`Search query execution failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse DuckDuckGo HTML results
  const results: SearchResultItem[] = [];
  const resultRegex = /<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const titleRegex = /<a\b[^>]*class=["'][^"']*result__url[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  // Extract result blocks
  const resultBlocks = searchHtml.split(/<div\b[^>]*class=["'][^"']*result\b[^"']*["']/i).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= limit) break;

    const titleMatch = block.match(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);

    if (titleMatch) {
      let rawHref = titleMatch[1];
      // DuckDuckGo redirects through /l/?uddg=...
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        rawHref = decodeURIComponent(uddgMatch[1]);
      }

      const check = validateUrl(rawHref);
      if (check.valid && check.url) {
        const itemTitle = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '').trim());
        const itemSnippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

        results.push({
          title: itemTitle || check.url.hostname,
          url: rawHref,
          snippet: itemSnippet
        });
      }
    }
  }

  // Fetch top results and scrape light markdown
  await Promise.all(
    results.map(async (item) => {
      try {
        const scraped = await scrapeToMarkdown(item.url);
        // Truncate individual scrape to first 1200 chars for token efficiency
        item.markdownSummary = scraped.markdown.slice(0, 1200) + (scraped.markdown.length > 1200 ? '\n\n*(Truncated for summary)*' : '');
      } catch (e) {
        item.markdownSummary = item.snippet;
      }
    })
  );

  const fullText = JSON.stringify(results);
  return {
    query: cleanQuery,
    results,
    tokensEstimated: estimateTokens(fullText)
  };
}

/**
 * Extracts internal same-origin links from an HTML string
 */
export function extractInternalLinks(html: string, baseUrl: string): string[] {
  try {
    const base = new URL(baseUrl);
    const links = new Set<string>();
    const hrefRegex = /href=["']([^"'#\s>]+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      if (
        !rawHref ||
        rawHref.startsWith('javascript:') ||
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:') ||
        rawHref.startsWith('data:')
      ) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, base);
        if (resolved.origin.toLowerCase() === base.origin.toLowerCase()) {
          resolved.hash = '';
          const pathLower = resolved.pathname.toLowerCase();
          const skipExtensions = [
            '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp',
            '.css', '.js', '.ico', '.zip', '.tar', '.gz',
            '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot',
            '.otf', '.xml', '.json', '.map'
          ];
          if (!skipExtensions.some(ext => pathLower.endsWith(ext))) {
            links.add(resolved.toString());
          }
        }
      } catch {
        // ignore invalid URL
      }
    }

    return Array.from(links);
  } catch {
    return [];
  }
}

/**
 * Recursively crawls a target website/documentation tree up to limit pages
 */
export async function crawlSiteToMarkdown(
  rootUrl: string,
  env?: Env,
  limit: number = 15,
  maxDepth: number = 2
): Promise<{
  rootUrl: string;
  pages: { url: string; title: string; markdown: string; tokensEstimated: number }[];
  combinedMarkdown: string;
  totalTokensEstimated: number;
}> {
  const urlCheck = validateUrl(rootUrl);
  if (!urlCheck.valid || !urlCheck.url) {
    throw new Error(urlCheck.error || 'Invalid root URL');
  }

  const maxPages = Math.min(Math.max(1, limit), 30);
  const queue: { url: string; depth: number }[] = [{ url: urlCheck.url.toString(), depth: 0 }];
  const visited = new Set<string>();
  const pages: { url: string; title: string; markdown: string; tokensEstimated: number }[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift()!;
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    try {
      const scraped = await scrapeToMarkdown(current.url, env);
      pages.push({
        url: current.url,
        title: scraped.title || current.url,
        markdown: scraped.markdown,
        tokensEstimated: scraped.tokensEstimated
      });

      // If depth allows and limit not reached, discover new internal links
      if (current.depth < maxDepth && pages.length < maxPages) {
        try {
          const res = await fetch(current.url, { headers: getStealthHeaders() });
          if (res.ok) {
            const html = await res.text();
            const discovered = extractInternalLinks(html, current.url);
            for (const link of discovered) {
              if (!visited.has(link) && !queue.some((q) => q.url === link)) {
                queue.push({ url: link, depth: current.depth + 1 });
              }
            }
          }
        } catch {
          // ignore single page link discovery error
        }
      }
    } catch {
      // ignore single page scrape failure, continue crawl
    }
  }

  if (pages.length === 0) {
    throw new Error(`Failed to crawl any valid pages from ${rootUrl}`);
  }

  // Assemble Master Markdown Document with Table of Contents
  let toc = `# Crawl Report & Knowledge Base\n\n`;
  toc += `> **Root URL:** ${rootUrl}\n`;
  toc += `> **Pages Crawled:** ${pages.length}\n\n`;
  toc += `## Table of Contents\n`;
  for (let i = 0; i < pages.length; i++) {
    toc += `${i + 1}. [${pages[i].title}](${pages[i].url})\n`;
  }
  toc += `\n---\n\n`;

  let body = '';
  for (let i = 0; i < pages.length; i++) {
    body += `\n\n# ${i + 1}. ${pages[i].title}\n`;
    body += `*Source: [${pages[i].url}](${pages[i].url})*\n\n`;
    body += pages[i].markdown + `\n\n---\n`;
  }

  const combinedMarkdown = toc + body.trim();
  const totalTokensEstimated = estimateTokens(combinedMarkdown);

  return {
    rootUrl,
    pages,
    combinedMarkdown,
    totalTokensEstimated
  };
}
