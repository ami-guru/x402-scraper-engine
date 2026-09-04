import * as dotenv from 'dotenv';
dotenv.config();

async function checkAndAcceptInvites() {
  const token = process.env.GITHUB_TOKEN;
  console.log('Checking repository invitations for ami-guru...');

  const res = await fetch('https://api.github.com/user/repository_invitations', {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'ASOT-Agent',
      Accept: 'application/vnd.github.v3+json'
    }
  });

  const invites = await res.json();
  console.log('Invites found:', JSON.stringify(invites, null, 2));

  if (Array.isArray(invites) && invites.length > 0) {
    for (const inv of invites) {
      console.log(`Accepting invitation ID: ${inv.id} for repo: ${inv.repository?.full_name}...`);
      const acceptRes = await fetch(`https://api.github.com/user/repository_invitations/${inv.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'ASOT-Agent',
          Accept: 'application/vnd.github.v3+json'
        }
      });
      console.log(`Accept status: HTTP ${acceptRes.status} (${acceptRes.ok ? 'ACCEPTED SUCCESS ✅' : 'FAILED ❌'})`);
    }
  }
}

checkAndAcceptInvites();
