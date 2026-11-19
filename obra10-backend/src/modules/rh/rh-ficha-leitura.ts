export const FICHA_CAMPOS = [
  'nome', 'cpf', 'rg', 'rgOrgao', 'rgUf', 'dataNascimento', 'sexo', 'estadoCivil',
  'nacionalidade', 'naturalidade', 'nomeMae', 'nomePai', 'pis', 'ctpsNumero',
  'ctpsSerie', 'ctpsUf', 'escolaridade', 'telefone', 'email', 'cep', 'logradouro',
  'numero', 'complemento', 'bairro', 'cidade', 'uf', 'funcao', 'cbo', 'matricula',
  'dataAdmissao', 'tipoContrato', 'salario', 'jornada', 'banco', 'agencia', 'conta',
  'tipoConta', 'pix',
] as const;

export type FichaLida = Record<(typeof FICHA_CAMPOS)[number], string>;

export const FICHA_SYSTEM = `Você é a Luna, lendo uma ficha de registro de empregado (CTPS, ficha de admissão, cadastro de funcionário ou documento pessoal) para o Obra 10.
Responda só JSON. Não invente dado ilegível — use string vazia.
Datas em YYYY-MM-DD. CPF e PIS só com dígitos visíveis. UF com 2 letras.
sexo: FEMININO|MASCULINO|NAO_INFORMADO
estadoCivil: SOLTEIRO|CASADO|UNIAO_ESTAVEL|DIVORCIADO|SEPARADO|VIUVO
escolaridade: FUNDAMENTAL_INCOMPLETO|FUNDAMENTAL|MEDIO_INCOMPLETO|MEDIO|TECNICO|SUPERIOR_INCOMPLETO|SUPERIOR|POS_GRADUACAO
tipoContrato: CLT|TEMPORARIO|ESTAGIO|APRENDIZ|AUTONOMO|TERCEIRIZADO
tipoConta: CORRENTE|POUPANCA|SALARIO
salario só número, ponto decimal.`;

export function pedidoFicha() {
  return `Extraia a ficha neste formato:
${JSON.stringify(fichaVazia())}
Preencha só o que estiver legível na foto. Se houver mais de uma imagem, junte os dados.`;
}

export function fichaVazia(): FichaLida {
  return Object.fromEntries(FICHA_CAMPOS.map((campo) => [campo, ''])) as FichaLida;
}

export function parsearFichaExtraida(bruto: unknown): { ficha: FichaLida; preenchidos: string[] } {
  const origem = objeto(bruto);
  const ficha = fichaVazia();
  ficha.nome = nomeDe(origem.nome || origem.nomeCompleto);
  ficha.cpf = formatarCpf(origem.cpf);
  ficha.rg = texto(origem.rg, 20);
  ficha.rgOrgao = texto(origem.rgOrgao || origem.orgaoEmissor, 20);
  ficha.rgUf = ufDe(origem.rgUf);
  ficha.dataNascimento = dataIso(origem.dataNascimento || origem.nascimento);
  ficha.sexo = mapear(origem.sexo, SEXO);
  ficha.estadoCivil = mapear(origem.estadoCivil, ESTADO_CIVIL);
  ficha.nacionalidade = texto(origem.nacionalidade, 40);
  ficha.naturalidade = texto(origem.naturalidade, 80);
  ficha.nomeMae = nomeDe(origem.nomeMae || origem.mae);
  ficha.nomePai = nomeDe(origem.nomePai || origem.pai);
  ficha.pis = formatarPis(origem.pis || origem.pasep || origem.nit);
  ficha.ctpsNumero = texto(origem.ctpsNumero || origem.ctps, 20);
  ficha.ctpsSerie = texto(origem.ctpsSerie, 10);
  ficha.ctpsUf = ufDe(origem.ctpsUf);
  ficha.escolaridade = mapear(origem.escolaridade, ESCOLARIDADE);
  ficha.telefone = formatarTelefone(origem.telefone || origem.celular);
  ficha.email = emailDe(origem.email);
  ficha.cep = formatarCep(origem.cep);
  ficha.logradouro = texto(origem.logradouro || origem.endereco, 120);
  ficha.numero = texto(origem.numero, 20);
  ficha.complemento = texto(origem.complemento, 80);
  ficha.bairro = texto(origem.bairro, 80);
  ficha.cidade = texto(origem.cidade || origem.municipio, 80);
  ficha.uf = ufDe(origem.uf);
  ficha.funcao = texto(origem.funcao || origem.cargo, 80);
  ficha.cbo = cboDe(origem.cbo);
  ficha.matricula = texto(origem.matricula, 30);
  ficha.dataAdmissao = dataIso(origem.dataAdmissao || origem.admissao);
  ficha.tipoContrato = mapear(origem.tipoContrato || origem.contrato, CONTRATO);
  ficha.salario = salarioDe(origem.salario);
  ficha.jornada = texto(origem.jornada, 80);
  ficha.banco = texto(origem.banco, 60);
  ficha.agencia = contaDe(origem.agencia, 10);
  ficha.conta = contaDe(origem.conta, 20);
  ficha.tipoConta = mapear(origem.tipoConta, CONTA);
  ficha.pix = texto(origem.pix, 120);

  const preenchidos = FICHA_CAMPOS.filter((campo) => ficha[campo]);
  return { ficha, preenchidos };
}

export function jsonDaLuna(raw: string): unknown {
  const texto = String(raw || '').trim();
  if (!texto) return {};
  const bloco = texto.match(/\{[\s\S]*\}/);
  if (!bloco) return {};
  try {
    return JSON.parse(bloco[0]);
  } catch {
    return {};
  }
}

function objeto(bruto: unknown): Record<string, unknown> {
  return bruto && typeof bruto === 'object' && !Array.isArray(bruto)
    ? (bruto as Record<string, unknown>)
    : {};
}

function texto(valor: unknown, max: number) {
  if (valor === undefined || valor === null) return '';
  const limpo = String(valor).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo.slice(0, max);
}

function nomeDe(valor: unknown) {
  const limpo = texto(valor, 120);
  return limpo.length >= 3 ? limpo : '';
}

function chave(valor: unknown) {
  return texto(valor, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapear(valor: unknown, tabela: Array<[string, string]>) {
  const direto = texto(valor, 40).toUpperCase().replace(/[\s-]+/g, '_');
  for (const [, codigo] of tabela) {
    if (direto === codigo) return codigo;
  }
  const n = chave(valor);
  if (!n) return '';
  for (const [rotulo, codigo] of tabela) {
    if (n === rotulo || n.includes(rotulo)) return codigo;
  }
  return '';
}

function ufDe(valor: unknown) {
  const limpo = texto(valor, 2).toUpperCase();
  return UFS.includes(limpo) ? limpo : '';
}

function dataIso(valor: unknown) {
  const bruto = texto(valor, 20);
  let iso = '';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto);
  const br = /^(\d{2})[/.+-](\d{2})[/.+-](\d{4})$/.exec(bruto);
  if (isoMatch) iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  else if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  if (!iso) return '';
  const data = new Date(`${iso}T12:00:00.000-03:00`);
  if (Number.isNaN(data.getTime())) return '';
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (ano < 1900 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';
  return iso;
}

function emailDe(valor: unknown) {
  const limpo = texto(valor, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo : '';
}

function cboDe(valor: unknown) {
  const limpo = texto(valor, 7).replace(/\s/g, '');
  if (/^\d{6}$/.test(limpo)) return limpo;
  if (/^\d{4}-\d{2}$/.test(limpo)) return limpo;
  return '';
}

function contaDe(valor: unknown, max: number) {
  const limpo = texto(valor, max);
  return /^[\d-]+$/.test(limpo) ? limpo : '';
}

function salarioDe(valor: unknown) {
  if (valor === undefined || valor === null || valor === '') return '';
  let bruto = typeof valor === 'number' && Number.isFinite(valor)
    ? valor.toFixed(2)
    : String(valor).trim();
  bruto = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return '';
  const numero = Number(bruto);
  if (numero <= 0 || numero > 9_999_999) return '';
  return numero.toFixed(2);
}

function formatarCpf(valor: unknown) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (!cpfValido(limpo)) return '';
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

function formatarPis(valor: unknown) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (!pisValido(limpo)) return '';
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 8)}.${limpo.slice(8, 10)}-${limpo.slice(10)}`;
}

function formatarCep(valor: unknown) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (limpo.length !== 8) return '';
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
}

function formatarTelefone(valor: unknown) {
  const limpo = String(valor ?? '').replace(/\D/g, '');
  if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return '';
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, fator: number) => {
    let soma = 0;
    for (const char of base) {
      soma += Number(char) * fator;
      fator -= 1;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function pisValido(pis: string) {
  if (!/^\d{11}$/.test(pis) || /^(\d)\1{10}$/.test(pis)) return false;
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(pis[i]) * pesos[i];
  const resto = soma % 11;
  const digito = resto < 2 ? 0 : 11 - resto;
  return digito === Number(pis[10]);
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

const SEXO: Array<[string, string]> = [
  ['masculino', 'MASCULINO'],
  ['homem', 'MASCULINO'],
  ['feminino', 'FEMININO'],
  ['mulher', 'FEMININO'],
  ['nao informado', 'NAO_INFORMADO'],
];

const ESTADO_CIVIL: Array<[string, string]> = [
  ['solteiro', 'SOLTEIRO'],
  ['casado', 'CASADO'],
  ['uniao estavel', 'UNIAO_ESTAVEL'],
  ['divorciado', 'DIVORCIADO'],
  ['separado', 'SEPARADO'],
  ['viuvo', 'VIUVO'],
];

const ESCOLARIDADE: Array<[string, string]> = [
  ['fundamental incompleto', 'FUNDAMENTAL_INCOMPLETO'],
  ['medio incompleto', 'MEDIO_INCOMPLETO'],
  ['superior incompleto', 'SUPERIOR_INCOMPLETO'],
  ['pos graduacao', 'POS_GRADUACAO'],
  ['pos', 'POS_GRADUACAO'],
  ['tecnico', 'TECNICO'],
  ['superior', 'SUPERIOR'],
  ['medio', 'MEDIO'],
  ['fundamental', 'FUNDAMENTAL'],
];

const CONTRATO: Array<[string, string]> = [
  ['temporario', 'TEMPORARIO'],
  ['terceirizado', 'TERCEIRIZADO'],
  ['autonomo', 'AUTONOMO'],
  ['aprendiz', 'APRENDIZ'],
  ['estagio', 'ESTAGIO'],
  ['clt', 'CLT'],
];

const CONTA: Array<[string, string]> = [
  ['corrente', 'CORRENTE'],
  ['poupanca', 'POUPANCA'],
  ['salario', 'SALARIO'],
];
