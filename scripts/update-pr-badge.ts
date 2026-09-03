import * as dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function updatePrBadge() {
  const branchName = 'add-x402-scraper-1788439052539';
  console.log(`Fetching README.md on branch ${branchName}...`);

  const res = await fetch(`https://api.github.com/repos/ami-guru/awesome-mcp-servers/contents/README.md?ref=${branchName}`, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'x402-PR-Updater'
    }
  });

  const data = await res.json();
  const currentContent = Buffer.from(data.content, 'base64').toString('utf-8');

  // Updated listing with Glama badge
  const updatedLine = `- [x402 Scraper & Deep Search](https://github.com/ami-guru/x402-scraper-engine) [![ami-guru/x402-scraper-engine MCP server](https://glama.ai/mcp/servers/ami-guru/x402-scraper-engine/badges/score.svg)](https://glama.ai/mcp/servers/ami-guru/x402-scraper-engine) - Production HTTP 402 pay-per-call web scraper ($0.02 USDC) and deep search engine ($0.05 USDC) for AI agents on Base L2.`;

  const oldLine = `- [x402 Scraper & Deep Search](https://github.com/ami-guru/x402-scraper-engine) - Production HTTP 402 pay-per-call web scraper ($0.02 USDC) and deep search engine ($0.05 USDC) for AI agents on Base L2.`;

  const newContent = currentContent.replace(oldLine, updatedLine);

  console.log('Committing badge update to PR branch...');
  const putRes = await fetch(`https://api.github.com/repos/ami-guru/awesome-mcp-servers/contents/README.md`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'x402-PR-Updater'
    },
    body: JSON.stringify({
      message: 'docs: add Glama verification badge to x402-scraper-engine listing',
      content: Buffer.from(newContent).toString('base64'),
      sha: data.sha,
      branch: branchName
    })
  });

  if (putRes.ok) {
    console.log('✅ PR #13560 updated with Glama badge!');
  } else {
    console.error('Failed to update PR:', await putRes.text());
  }
}

updatePrBadge();
