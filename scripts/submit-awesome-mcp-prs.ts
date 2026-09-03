import * as dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const TARGET_REPOS = [
  { owner: 'wong2', repo: 'awesome-mcp-servers' },
  { owner: 'appcypher', repo: 'awesome-mcp-servers' }
];

const LISTING_LINE = `- [x402 Scraper & Deep Search](https://github.com/ami-guru/x402-scraper-engine) - Production HTTP 402 pay-per-call web scraper ($0.02 USDC) and deep search engine ($0.05 USDC) for AI agents on Base L2.`;

async function githubRequest(endpoint: string, options: any = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'x402-Awesome-MCP-Submitter',
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${errBody.message || JSON.stringify(errBody)}`);
  }

  return res.json();
}

async function submitPrToRepo(target: { owner: string; repo: string }) {
  console.log(`\n======================================================`);
  console.log(`🚀 Processing Upstream Repo: ${target.owner}/${target.repo}`);
  console.log(`======================================================`);

  // 1. Get upstream default branch
  const upstreamInfo = await githubRequest(`/repos/${target.owner}/${target.repo}`);
  const defaultBranch = upstreamInfo.default_branch || 'main';
  console.log(`[1] Detected default branch: ${defaultBranch}`);

  // 2. Fork repository to ami-guru
  console.log(`[2] Forking ${target.owner}/${target.repo} to ami-guru...`);
  try {
    await githubRequest(`/repos/${target.owner}/${target.repo}/forks`, { method: 'POST' });
    console.log(`    Fork initiated/confirmed.`);
  } catch (e: any) {
    console.log(`    Fork notice: ${e.message}`);
  }

  // Wait 4s for GitHub fork initialization
  await new Promise(r => setTimeout(r, 4000));

  // 3. Get default branch ref
  console.log(`[3] Fetching base commit SHA for branch ${defaultBranch}...`);
  const baseBranchData = await githubRequest(`/repos/${target.owner}/${target.repo}/git/ref/heads/${defaultBranch}`);
  const baseSha = baseBranchData.object.sha;

  // 3. Create a new feature branch in ami-guru's fork
  const newBranchName = `add-x402-scraper-${Date.now()}`;
  console.log(`[3] Creating feature branch: ${newBranchName}...`);
  await githubRequest(`/repos/ami-guru/${target.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha
    })
  });

  // 4. Get README.md content
  console.log(`[4] Reading README.md content...`);
  const readmeData = await githubRequest(`/repos/ami-guru/${target.repo}/contents/README.md?ref=${newBranchName}`);
  const currentContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');

  if (currentContent.includes('x402-scraper-engine')) {
    console.log(`    x402-scraper-engine is already present in this README. Skipping.`);
    return;
  }

  // Insert our tool under Scraping / Search section or at the bottom of Server list
  let updatedContent = currentContent;
  if (currentContent.includes('### Web Scraping') || currentContent.includes('## Web Scraping')) {
    updatedContent = currentContent.replace(
      /(###?\s*Web Scraping[^\n]*\n)/i,
      `$1${LISTING_LINE}\n`
    );
  } else if (currentContent.includes('### Search') || currentContent.includes('## Search')) {
    updatedContent = currentContent.replace(
      /(###?\s*Search[^\n]*\n)/i,
      `$1${LISTING_LINE}\n`
    );
  } else {
    // Append to Tools / Servers section
    updatedContent = currentContent + `\n\n### Web Scraping & Deep Search\n${LISTING_LINE}\n`;
  }

  // 5. Commit updated README.md to fork
  console.log(`[5] Committing updated README.md to branch ${newBranchName}...`);
  await githubRequest(`/repos/ami-guru/${target.repo}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'feat: add x402 Scraper & Deep Search Engine to MCP servers list',
      content: Buffer.from(updatedContent).toString('base64'),
      sha: readmeData.sha,
      branch: newBranchName
    })
  });

  // 6. Open Pull Request upstream
  console.log(`[6] Submitting Pull Request to ${target.owner}/${target.repo}...`);
  const prResult = await githubRequest(`/repos/${target.owner}/${target.repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Add x402 Scraper & Deep Search Engine (Base L2 HTTP 402)',
      head: `ami-guru:${newBranchName}`,
      base: target.branch,
      body: `## Summary\n\nAdds **x402 Scraper & Deep Search Engine** to the MCP server directory.\n\n- **Repository:** https://github.com/ami-guru/x402-scraper-engine\n- **Protocol:** Model Context Protocol (MCP) + HTTP 402 Micropayments on Base L2\n- **Tools Provided:** \n  - \`clean_web_scrape\` ($0.02 USDC) - Converts any webpage into token-efficient Markdown.\n  - \`clean_web_search\` ($0.05 USDC) - Performs multi-source web research & extraction.\n- **License:** MIT\n\nTested and compatible with Claude Desktop, Cursor, and standard MCP clients.`
    })
  });

  console.log(`\n🎉 PULL REQUEST CREATED SUCCESSFULLY!`);
  console.log(`👉 PR URL: ${prResult.html_url}\n`);
}

async function run() {
  for (const target of TARGET_REPOS) {
    try {
      await submitPrToRepo(target);
    } catch (err: any) {
      console.error(`❌ Error submitting to ${target.owner}/${target.repo}:`, err.message);
    }
  }
}

run();
