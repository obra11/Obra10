async function run() {
  try {
    const res = await fetch('https://obra10-production.up.railway.app/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', senha: 'password' })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
