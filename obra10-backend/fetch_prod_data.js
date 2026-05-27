const axios = require('axios');

async function main() {
  console.log('Logging in to production...');
  
  // Set up an axios instance that persists cookies
  const instance = axios.create({
    baseURL: 'https://obra10-production.up.railway.app',
    withCredentials: true,
  });

  try {
    const loginRes = await instance.post('/auth/login', {
      email: 'superadmin@obra10.com',
      senha: 'Lunardeli20011978$'
    });
    
    console.log('Login successful!');
    console.log('Cookies in response headers:', loginRes.headers['set-cookie']);
    console.log('User profile:', loginRes.data.user);

    // Propagate cookies manually if axios instance didn't capture them automatically
    const cookies = loginRes.headers['set-cookie'];
    if (cookies) {
      instance.defaults.headers.Cookie = cookies.map(c => c.split(';')[0]).join('; ');
    }

    console.log('\nFetching companies from /admin/empresas...');
    const companiesRes = await instance.get('/admin/empresas');
    console.log(`Found ${companiesRes.data.length} companies:`);
    console.log(JSON.stringify(companiesRes.data, null, 2));

  } catch (error) {
    console.error('Error occurred:', error.response?.data || error.message);
  }
}

main().catch(console.error);
