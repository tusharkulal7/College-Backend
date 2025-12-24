require('dotenv').config();
const axios = require('axios');

async function check() {
  const { CLERK_SECRET_KEY } = process.env;

  if (!CLERK_SECRET_KEY) {
    console.error('Missing Clerk secret key. Set CLERK_SECRET_KEY in .env');
    process.exit(1);
  }

  try {
    console.log('Checking Clerk API access...');
    const res = await axios.get('https://api.clerk.dev/v1/users?limit=1', {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      },
      timeout: 10000,
    });
    if (res.status === 200) {
      console.log('✅ Clerk secret key is valid (able to query /v1/users).');
      process.exit(0);
    }
    console.log('Received unexpected response from Clerk:', res.status);
    process.exit(1);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.error('❌ Clerk authentication failed (401 Unauthorized) — check CLERK_SECRET_KEY');
    } else if (err.response) {
      console.error(`❌ Clerk API returned status ${err.response.status}:`, err.response.data || err.response.statusText);
    } else {
      console.error('❌ Clerk check failed:', err.message);
    }
    process.exit(1);
  }
}

check();
