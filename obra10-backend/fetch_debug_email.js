const axios = require('axios');

async function main() {
  try {
    const timestamp = Date.now();
    const res = await axios.get(`https://obra10.app.br/debug-email?t=${timestamp}`);
    console.log('HTTP Status:', res.status);
    console.log('Response Body:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log('HTTP Status:', error.response?.status);
    console.log('Response Body:', error.response?.data || error.message);
  }
}

main().catch(console.error);
