import * as dotenv from 'dotenv';
dotenv.config();

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

async function testTwitterBearer() {
  if (!BEARER_TOKEN) {
    console.error('Missing TWITTER_BEARER_TOKEN in .env');
    return;
  }

  try {
    const res = await fetch('https://api.twitter.com/2/users/by/username/SterlingTrvTech', {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'User-Agent': 'v2UserLookupJS'
      }
    });

    console.log(`Twitter API Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Twitter User Lookup Result:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('Twitter API Request Failed:', err.message);
  }
}

testTwitterBearer();
