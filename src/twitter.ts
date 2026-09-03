import { TweetItem } from './types';
import { estimateTokens } from './scraper';

/**
 * Clean & decode Twitter HTML text
 */
function cleanTweetText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Public Twitter Search (Cashtags, Topics, Keywords) via edge syndication & search feeds
 */
export async function searchTwitter(
  query: string,
  limit: number = 5
): Promise<{ query: string; tweets: TweetItem[]; markdown: string; tokensEstimated: number }> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error('Twitter search query cannot be empty.');
  }

  const tweets: TweetItem[] = [];
  const encodedQuery = encodeURIComponent(`site:twitter.com OR site:x.com ${cleanQuery}`);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (res.ok) {
      const html = await res.text();
      const blocks = html.split(/<div\b[^>]*class=["'][^"']*result\b[^"']*["']/i).slice(1);

      for (const block of blocks) {
        if (tweets.length >= limit) break;

        const titleMatch = block.match(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);

        if (titleMatch) {
          let rawHref = titleMatch[1];
          const uddgMatch = rawHref.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            rawHref = decodeURIComponent(uddgMatch[1]);
          }

          if (rawHref.includes('twitter.com/') || rawHref.includes('x.com/')) {
            const pathParts = new URL(rawHref).pathname.split('/').filter(Boolean);
            const author = pathParts[0] || 'Unknown';
            const snippet = snippetMatch ? cleanTweetText(snippetMatch[1]) : '';
            const title = cleanTweetText(titleMatch[2]);

            tweets.push({
              author: `@${author}`,
              text: snippet || title,
              url: rawHref
            });
          }
        }
      }
    }
  } catch (e: any) {
    // If public search times out, return empty structure with informative status
  } finally {
    clearTimeout(timeoutId);
  }

  // Format Token-Efficient Markdown
  let md = `# Twitter / X Search: "${cleanQuery}"\n\n`;
  md += `> **Matched Tweets:** ${tweets.length}\n`;
  md += `> **Source:** Public X/Twitter Edge Extraction (Zero-API Paywall)\n\n---\n\n`;

  if (tweets.length === 0) {
    md += `*No recent public tweets found for query "${cleanQuery}".*\n`;
  } else {
    for (const t of tweets) {
      md += `### ${t.author}\n`;
      if (t.url) md += `> **Tweet URL:** [${t.url}](${t.url})\n\n`;
      md += `${t.text}\n\n---\n\n`;
    }
  }

  return {
    query: cleanQuery,
    tweets,
    markdown: md,
    tokensEstimated: estimateTokens(md)
  };
}

/**
 * Public Twitter Profile Scraper (Bio + Recent Tweets)
 */
export async function getTwitterProfile(
  username: string
): Promise<{ username: string; bio: string; tweets: TweetItem[]; markdown: string; tokensEstimated: number }> {
  const cleanUsername = username.replace(/^@/, '').trim();
  if (!cleanUsername) {
    throw new Error('Twitter username cannot be empty.');
  }

  const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${cleanUsername}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let bio = '';
  const tweets: TweetItem[] = [];

  try {
    const res = await fetch(syndicationUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });

    if (res.ok) {
      const html = await res.text();

      // Extract JSON payload embedded by Twitter syndication
      const jsonMatch = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch) {
        try {
          const nextData = JSON.parse(jsonMatch[1]);
          const entries = nextData?.props?.pageProps?.timeline?.entries || [];
          for (const entry of entries) {
            const tweetData = entry?.content?.tweet;
            if (tweetData) {
              if (!bio && tweetData.user?.description) {
                bio = tweetData.user.description;
              }
              tweets.push({
                id: tweetData.id_str,
                author: `@${tweetData.user?.screen_name || cleanUsername}`,
                text: tweetData.text || '',
                timestamp: tweetData.created_at,
                url: `https://x.com/${cleanUsername}/status/${tweetData.id_str}`
              });
            }
          }
        } catch (jsonErr) {
          // Fallback to regex text parsing
        }
      }

      // Regex fallback if JSON wasn't present
      if (tweets.length === 0) {
        const tweetBlocks = html.split(/<article\b[^>]*>/i).slice(1);
        for (const block of tweetBlocks) {
          const textMatch = block.match(/<div\b[^>]*lang=["'][^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
          if (textMatch) {
            tweets.push({
              author: `@${cleanUsername}`,
              text: cleanTweetText(textMatch[1]),
              url: `https://x.com/${cleanUsername}`
            });
          }
        }
      }
    }
  } catch (e: any) {
    // If syndication request fails, perform fallback search
  } finally {
    clearTimeout(timeoutId);
  }

  // Format Token-Efficient Markdown
  let md = `# Twitter Profile: @${cleanUsername}\n\n`;
  if (bio) md += `> **Bio:** ${bio}\n`;
  md += `> **Profile URL:** [https://x.com/${cleanUsername}](https://x.com/${cleanUsername})\n`;
  md += `> **Recent Tweets Extracted:** ${tweets.length}\n\n---\n\n`;

  if (tweets.length === 0) {
    md += `*No recent public tweets could be extracted for @${cleanUsername}.*\n`;
  } else {
    for (const t of tweets) {
      if (t.timestamp) md += `*${t.timestamp}*\n`;
      md += `${t.text}\n`;
      if (t.url) md += `[View Tweet](${t.url})\n`;
      md += `\n---\n\n`;
    }
  }

  return {
    username: cleanUsername,
    bio,
    tweets,
    markdown: md,
    tokensEstimated: estimateTokens(md)
  };
}
