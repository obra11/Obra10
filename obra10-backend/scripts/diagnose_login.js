const { Client } = require('pg');
const bcrypt = require('bcrypt');
const axios = require('axios');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:lcQwRkZtmuYioMDalLMCALrECEdszTgP@centerbeam.proxy.rlwy.net:19827/railway',
  });
  await c.connect();

  // 1. Get current hash
  const uRes = await c.query("SELECT id, email, senha_hash, empresa_id FROM usuarios WHERE email = 'engenharia@lunardeli.com.br'");
  if (uRes.rows.length === 0) {
    console.log('User not found!');
    await c.end();
    return;
  }
  const user = uRes.rows[0];
  console.log('User:', user);
  const originalHash = user.senha_hash;

  // 2. Set temporary password 'diagnose123'
  const tempPassword = 'diagnose123';
  const tempHash = await bcrypt.hash(tempPassword, 12);
  await c.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [tempHash, user.id]);
  console.log('Set temporary password successfully.');

  try {
    // 3. Perform login against the production URL
    const loginRes = await axios.post('https://obra10.app.br/api/auth/login', {
      email: 'engenharia@lunardeli.com.br',
      senha: tempPassword
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('=== LOGIN RESPONSE ===');
    console.log(loginRes.data);
    const cookies = loginRes.headers['set-cookie'];
    console.log('Cookies returned:', cookies);

    if (cookies && cookies.length > 0) {
      // 4. Get users list using the cookie
      const tokenCookie = cookies.find(c => c.startsWith('obra10_token='));
      if (tokenCookie) {
        const tokenVal = tokenCookie.split(';')[0];
        console.log('Using cookie:', tokenVal);

        const usersRes = await axios.get('https://obra10.app.br/api/usuarios', {
          headers: {
            'Cookie': tokenVal
          }
        });
        console.log('=== USERS RESPONSE ===');
        console.log(usersRes.data);
      }
    }
  } catch (err) {
    console.error('Error during login / users fetch:', err.response ? err.response.data : err.message);
  } finally {
    // 5. Restore original hash
    await c.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [originalHash, user.id]);
    console.log('Restored original password hash.');
    await c.end();
  }
}

main().catch(console.error);
