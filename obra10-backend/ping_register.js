function generateValidCNPJ() {
  const checkCNPJ = (cnpj) => {
    const d = cnpj.replace(/\D/g, '');
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (n, weights) =>
      11 -
      (n
        .split('')
        .slice(0, weights.length)
        .reduce((s, c, i) => s + +c * weights[i], 0) %
        11);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(d, w1) >= 10 ? 0 : calc(d, w1);
    const d2 = calc(d, w2) >= 10 ? 0 : calc(d, w2);
    return +d[12] === d1 && +d[13] === d2;
  };

  while (true) {
    const base = Math.floor(100000000000 + Math.random() * 900000000000).toString() + '0001';
    for (let i = 0; i <= 99; i++) {
      const suffix = i.toString().padStart(2, '0');
      const candidate = base.slice(0, 12) + suffix;
      if (checkCNPJ(candidate)) {
        return candidate;
      }
    }
  }
}

async function run() {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const email = `test_${randomSuffix}@example.com`;
  const cnpj = generateValidCNPJ();
  console.log(`Using email: ${email} and CNPJ: ${cnpj}`);
  
  const payload = {
    tipoPessoa: 'JURIDICA',
    cpfCnpj: cnpj,
    razaoSocial: `Empresa Teste ${randomSuffix}`,
    nomeFantasia: 'Fantasia Teste',
    email: email,
    telefone: '11999999999',
    cep: '01310-100',
    numero: '1000',
    nome: 'Gestor Teste',
    senha: 'Password123!'
  };

  try {
    const res = await fetch('https://obra10.app.br/tenants/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
