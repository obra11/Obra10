/**
 * Bateria de perguntas comuns para Luna (extração documental, tenant + online).
 * Uso: node scripts/test-luna-questions.js
 */
const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || 'http://localhost:3000';
const EMAIL = process.env.TEST_EMAIL || 'tarcisio@lunardeli.com.br';
const SENHA = process.env.TEST_SENHA || 'Senha123';
const EMPRESA_ID = process.env.TEST_EMPRESA_ID || '95abdcb5-bad5-45b5-9d96-1302e82d04ef';
const OBRA_NOME = process.env.TEST_OBRA_NOME || 'VICTORIA';

const PERGUNTAS = [
  'quantos relatórios foram executados até hoje',
  'quantos RDOs temos no total?',
  'quantos dias de chuva nos últimos 30 dias?',
  'quantos dias de chuva desde o início?',
  'qual o efetivo médio da obra?',
  'quais atividades foram executadas?',
  'há pendências registradas?',
  'quais obras ativas?',
  'quantos RDOs hoje',
  'quantos diários este mês',
  'desde o início, quantos diários aprovados?',
  'em todas as obras, quantos RDOs até hoje?',
  'pesquise online o que é NBR 6118',
];

/** Pergunta de isolamento: obra de outra empresa não deve vazar dados. */
const OBRA_OUTRA_EMPRESA = 'bbb22222-2222-4222-a222-222222222222'; // Acme

function parseSetCookie(setCookie) {
  if (!setCookie) return {};
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  const jar = {};
  for (const c of parts) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  return jar;
}

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, senha: SENHA, empresaId: EMPRESA_ID }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login falhou', loginRes.status, loginBody);
    process.exit(1);
  }

  const setCookie = loginRes.headers.getSetCookie?.() || [];
  const jar = parseSetCookie(setCookie.length ? setCookie : loginRes.headers.get('set-cookie'));
  const token = jar['obra10_token'];
  let xsrf = jar['XSRF-TOKEN'];

  // Garantir XSRF via GET se necessário
  if (!xsrf) {
    const ping = await fetch(`${API}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `obra10_token=${token}`,
      },
    });
    const pingJar = parseSetCookie(ping.headers.getSetCookie?.() || ping.headers.get('set-cookie'));
    xsrf = pingJar['XSRF-TOKEN'] || ping.headers.get('x-xsrf-token');
  }

  const obra =
    (loginBody.obrasPermitidas || []).find((o) =>
      new RegExp(OBRA_NOME, 'i').test(o.nome || ''),
    ) || (loginBody.obrasPermitidas || [])[0];

  if (!obra) {
    console.error('Nenhuma obra disponível para o usuário');
    process.exit(1);
  }

  console.log(
    `Empresa: ${loginBody.empresa?.razaoSocial} (${loginBody.usuario?.empresaId})`,
  );
  console.log(`Obra: ${obra.nome} (${obra.id})`);
  console.log('---');

  async function ask(message, obraId, history = []) {
    const res = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-obra-id': obraId || '',
        'x-xsrf-token': xsrf || '',
        Cookie: `obra10_token=${token}; XSRF-TOKEN=${xsrf || ''}`,
      },
      body: JSON.stringify({ message, history }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, statusCode: res.status, reply: data.reply || JSON.stringify(data) };
  }

  const results = [];
  for (const message of PERGUNTAS) {
    const { ok, reply } = await ask(message, obra.id);
    let status = ok ? 'OK' : 'ERR';

    if (
      /até hoje|no total|desde o início/i.test(message) &&
      /\(hoje\)/.test(reply) &&
      !/desde o início até hoje/.test(reply)
    ) {
      status = 'FAIL';
    }
    if (
      /até hoje/i.test(message) &&
      /Não (encontrei|achei) diários/i.test(reply) &&
      /\(hoje\)/.test(reply)
    ) {
      status = 'FAIL';
    }
    if (
      /até hoje/i.test(message) &&
      /VICTORIA/i.test(obra.nome) &&
      /Total de diários:\s*0|Não (encontrei|achei)/i.test(reply)
    ) {
      status = 'FAIL';
    }
    if (/obras ativas/i.test(message) && /Acme|Drunn|Complexo Comercial Delta/i.test(reply)) {
      status = 'FAIL';
    }

    const short = reply.length > 280 ? `${reply.slice(0, 280)}…` : reply;
    console.log(`\n[${status}] ${message}`);
    console.log(short);
    results.push({ status, message, reply: short });
  }

  // Sequência ABNT: follow-up NÃO pode virar resumo de diários
  {
    const q1 = 'pesquise online o que é NBR 6118';
    const a1 = await ask(q1, obra.id);
    const q2 = 'Ok poderia me extrair desse catálogo da ABNT as informações';
    const history = [
      { role: 'user', content: q1 },
      { role: 'assistant', content: a1.reply },
    ];
    const a2 = await ask(q2, obra.id, history);
    let status = a2.ok ? 'OK' : 'ERR';
    if (/Consultei os diários/i.test(a2.reply)) status = 'FAIL';
    if (/VICTORIA RESIDENCE.*chuva|média de \d+ profissional/i.test(a2.reply)) {
      status = 'FAIL';
    }
    if (!/abnt|norma|6118|catálogo|catalogo|pago|restrito|oficial/i.test(a2.reply)) {
      status = 'FAIL';
    }
    const short = a2.reply.length > 320 ? `${a2.reply.slice(0, 320)}…` : a2.reply;
    console.log(`\n[${status}] [follow-up ABNT] ${q2}`);
    console.log(short);
    results.push({ status, message: `[follow-up ABNT] ${q2}`, reply: short });
  }

  // Isolamento: obra de outra empresa com x-obra-id estranho
  {
    const message = 'quantos RDOs até hoje?';
    const { reply } = await ask(message, OBRA_OUTRA_EMPRESA);
    let status = 'OK';
    if (/Acme|Complexo Comercial Delta|MVP Lumière/i.test(reply)) status = 'FAIL';
    const short = reply.length > 280 ? `${reply.slice(0, 280)}…` : reply;
    console.log(`\n[${status}] [tenant] obra de outra empresa → ${message}`);
    console.log(short);
    results.push({ status, message: `[tenant] ${message}`, reply: short });
  }

  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\n==== RESUMO ====');
  console.log(summary);

  const outPath = path.join(__dirname, 'luna-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Salvo em ${outPath}`);
  if (summary.FAIL || summary.ERR) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
