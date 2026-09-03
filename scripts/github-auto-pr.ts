import * as dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function checkGithubAuth() {
  if (!GITHUB_TOKEN) {
    console.error('Missing GITHUB_TOKEN in .env');
    return;
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'x402-Automation-Bot',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  const scopes = res.headers.get('x-oauth-scopes');
  const user = await res.json();

  console.log(`\n✅ Authenticated as GitHub user: ${user.login} (${user.name || 'N/A'})`);
  console.log(`🔑 Scopes granted: ${scopes || 'none'}\n`);
}

checkGithubAuth();
