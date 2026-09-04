import * as dotenv from 'dotenv';
dotenv.config();

async function checkGitHubRaw() {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch('https://api.github.com/repos/guru-tt/ami-audit/contents/index.html?ref=main', {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'ASOT-Agent',
      Accept: 'application/vnd.github.v3+json'
    }
  });

  const data = await res.json();
  if (data.content) {
    const rawHtml = Buffer.from(data.content, 'base64').toString('utf8');
    console.log('GitHub main index.html length:', rawHtml.length);
    console.log('Has syncStepButtons:', rawHtml.includes('syncStepButtons'));
    console.log('updateForm code in GitHub main:');
    const start = rawHtml.indexOf('function updateForm');
    console.log(rawHtml.slice(start, start + 300));
  } else {
    console.log('Error fetching content:', data);
  }
}

checkGitHubRaw();
