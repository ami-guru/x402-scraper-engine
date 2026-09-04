import * as dotenv from 'dotenv';
dotenv.config();

async function listRepos() {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'ASOT-Agent'
    }
  });

  const data = await res.json();
  if (Array.isArray(data)) {
    console.log(
      JSON.stringify(
        data.map((r: any) => ({
          name: r.name,
          url: r.html_url,
          private: r.private
        })),
        null,
        2
      )
    );
  } else {
    console.error(data);
  }
}

listRepos();
