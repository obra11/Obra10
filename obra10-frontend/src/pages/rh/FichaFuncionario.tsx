import React, { useState } from 'react';

export type FichaValores = {
  nome: string;
  cpf: string;
  rg: string;
  rgOrgao: string;
  rgUf: string;
  dataNascimento: string;
  sexo: string;
  estadoCivil: string;
  nacionalidade: string;
  naturalidade: string;
  nomeMae: string;
  nomePai: string;
  pis: string;
  ctpsNumero: string;
  ctpsSerie: string;
  ctpsUf: string;
  escolaridade: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  funcao: string;
  cbo: string;
  matricula: string;
  dataAdmissao: string;
  tipoContrato: string;
  salario: string;
  jornada: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix: string;
};

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

const SEXOS = [
  ['FEMININO', 'Feminino'],
  ['MASCULINO', 'Masculino'],
  ['NAO_INFORMADO', 'Não informado'],
] as const;

const ESTADOS = [
  ['SOLTEIRO', 'Solteiro'],
  ['CASADO', 'Casado'],
  ['UNIAO_ESTAVEL', 'União estável'],
  ['DIVORCIADO', 'Divorciado'],
  ['SEPARADO', 'Separado'],
  ['VIUVO', 'Viúvo'],
] as const;

const ESCOLAS = [
  ['FUNDAMENTAL_INCOMPLETO', 'Fundamental incompleto'],
  ['FUNDAMENTAL', 'Fundamental'],
  ['MEDIO_INCOMPLETO', 'Médio incompleto'],
  ['MEDIO', 'Médio'],
  ['TECNICO', 'Técnico'],
  ['SUPERIOR_INCOMPLETO', 'Superior incompleto'],
  ['SUPERIOR', 'Superior'],
  ['POS_GRADUACAO', 'Pós-graduação'],
] as const;

const CONTRATOS = [
  ['CLT', 'CLT'],
  ['TEMPORARIO', 'Temporário'],
  ['ESTAGIO', 'Estágio'],
  ['APRENDIZ', 'Aprendiz'],
  ['AUTONOMO', 'Autônomo'],
  ['TERCEIRIZADO', 'Terceirizado'],
] as const;

const CONTAS = [
  ['CORRENTE', 'Corrente'],
  ['POUPANCA', 'Poupança'],
  ['SALARIO', 'Salário'],
] as const;

const campo = 'w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white';

export function fichaVazia(): FichaValores {
  return {
    nome: '',
    cpf: '',
    rg: '',
    rgOrgao: '',
    rgUf: '',
    dataNascimento: '',
    sexo: '',
    estadoCivil: '',
    nacionalidade: '',
    naturalidade: '',
    nomeMae: '',
    nomePai: '',
    pis: '',
    ctpsNumero: '',
    ctpsSerie: '',
    ctpsUf: '',
    escolaridade: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    funcao: '',
    cbo: '',
    matricula: '',
    dataAdmissao: '',
    tipoContrato: '',
    salario: '',
    jornada: '',
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: '',
    pix: '',
  };
}

export function fichaDe(data: Partial<FichaValores> | null | undefined): FichaValores {
  const base = fichaVazia();
  if (!data) return base;
  (Object.keys(base) as (keyof FichaValores)[]).forEach((chave) => {
    const valor = data[chave];
    if (typeof valor === 'string') base[chave] = valor;
  });
  return base;
}

export function mesclarFicha(atual: FichaValores, extraida: Partial<FichaValores> | null | undefined): FichaValores {
  const next = { ...atual };
  if (!extraida) return next;
  (Object.keys(next) as (keyof FichaValores)[]).forEach((chave) => {
    const novo = extraida[chave];
    if (typeof novo === 'string' && novo.trim() && !String(atual[chave] || '').trim()) {
      next[chave] = novo;
    }
  });
  return next;
}

export function pendenciaFicha(valores: FichaValores) {
  if (valores.nome.trim().length < 3) return 'Informe o nome completo.';
  const cpf = valores.cpf.replace(/\D/g, '');
  if (!cpf) return 'Informe o CPF.';
  if (!cpfValido(cpf)) return 'CPF inválido.';
  return '';
}

function mascaraCpf(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraPis(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 8) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 10) return `${digitos.slice(0, 3)}.${digitos.slice(3, 8)}.${digitos.slice(8)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 8)}.${digitos.slice(8, 10)}-${digitos.slice(10)}`;
}

function mascaraCep(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.replace(/(\d{5})(\d)/, '$1-$2');
}

function mascaraTel(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
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

function Secao({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">{titulo}</h3>
        {texto && <p className="text-xs text-gray-500 mt-1">{texto}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Campo({
  label,
  obrigatorio,
  className,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-1 ${className || ''}`}>
      <span className="text-xs font-bold text-gray-600">{label}{obrigatorio ? ' *' : ''}</span>
      {children}
    </label>
  );
}

function Uf({ valor, onChange, obrigatorio }: { valor: string; onChange: (valor: string) => void; obrigatorio?: boolean }) {
  return (
    <select className={campo} value={valor} onChange={(e) => onChange(e.target.value)} required={obrigatorio}>
      <option value="">UF</option>
      {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
    </select>
  );
}

export function FichaFuncionario({
  valores,
  onChange,
}: {
  valores: FichaValores;
  onChange: (valores: FichaValores) => void;
}) {
  const [avisoCep, setAvisoCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const set = <K extends keyof FichaValores>(chave: K, valor: FichaValores[K]) => {
    onChange({ ...valores, [chave]: valor });
  };

  const buscarCep = async () => {
    const cep = valores.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      setAvisoCep('Informe o CEP com 8 dígitos.');
      return;
    }
    setBuscandoCep(true);
    setAvisoCep('');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!res.ok || data.erro) {
        setAvisoCep('CEP não encontrado.');
        return;
      }
      onChange({
        ...valores,
        logradouro: data.logradouro || valores.logradouro,
        bairro: data.bairro || valores.bairro,
        cidade: data.localidade || valores.cidade,
        uf: data.uf || valores.uf,
      });
    } catch {
      setAvisoCep('Não foi possível buscar o CEP.');
    } finally {
      setBuscandoCep(false);
    }
  };

  return (
    <div className="space-y-6">
      <Secao titulo="Identificação" texto="Só nome completo e CPF são obrigatórios. O restante pode ficar para depois.">
        <Campo label="Nome completo" obrigatorio className="sm:col-span-2">
          <input className={campo} value={valores.nome} autoComplete="name" onChange={(e) => set('nome', e.target.value)} />
        </Campo>
        <Campo label="CPF" obrigatorio>
          <input className={campo} inputMode="numeric" value={valores.cpf} onChange={(e) => set('cpf', mascaraCpf(e.target.value))} />
        </Campo>
        <Campo label="Data de nascimento">
          <input className={campo} type="date" value={valores.dataNascimento} autoComplete="bday" onChange={(e) => set('dataNascimento', e.target.value)} />
        </Campo>
        <Campo label="Sexo">
          <select className={campo} value={valores.sexo} onChange={(e) => set('sexo', e.target.value)}>
            <option value="">Selecione</option>
            {SEXOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="Estado civil">
          <select className={campo} value={valores.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)}>
            <option value="">Selecione</option>
            {ESTADOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="Nacionalidade">
          <input className={campo} value={valores.nacionalidade} onChange={(e) => set('nacionalidade', e.target.value)} />
        </Campo>
        <Campo label="Naturalidade">
          <input className={campo} value={valores.naturalidade} placeholder="Cidade / UF" onChange={(e) => set('naturalidade', e.target.value)} />
        </Campo>
        <Campo label="Nome da mãe" className="sm:col-span-2">
          <input className={campo} value={valores.nomeMae} onChange={(e) => set('nomeMae', e.target.value)} />
        </Campo>
        <Campo label="Nome do pai" className="sm:col-span-2">
          <input className={campo} value={valores.nomePai} onChange={(e) => set('nomePai', e.target.value)} />
        </Campo>
        <Campo label="Telefone">
          <input className={campo} inputMode="tel" autoComplete="tel" value={valores.telefone} onChange={(e) => set('telefone', mascaraTel(e.target.value))} />
        </Campo>
        <Campo label="E-mail">
          <input className={campo} type="email" autoComplete="email" value={valores.email} onChange={(e) => set('email', e.target.value)} />
        </Campo>
      </Secao>

      <Secao titulo="Documentos" texto="RG, CTPS e PIS/PASEP/NIT. A CTPS digital pode ficar só com o número.">
        <Campo label="RG">
          <input className={campo} value={valores.rg} onChange={(e) => set('rg', e.target.value)} />
        </Campo>
        <Campo label="Órgão emissor">
          <input className={campo} value={valores.rgOrgao} placeholder="SSP" onChange={(e) => set('rgOrgao', e.target.value)} />
        </Campo>
        <Campo label="UF do RG">
          <Uf valor={valores.rgUf} onChange={(valor) => set('rgUf', valor)} />
        </Campo>
        <Campo label="PIS/PASEP/NIT">
          <input className={campo} inputMode="numeric" value={valores.pis} onChange={(e) => set('pis', mascaraPis(e.target.value))} />
        </Campo>
        <Campo label="CTPS número">
          <input className={campo} value={valores.ctpsNumero} onChange={(e) => set('ctpsNumero', e.target.value)} />
        </Campo>
        <Campo label="CTPS série">
          <input className={campo} value={valores.ctpsSerie} onChange={(e) => set('ctpsSerie', e.target.value)} />
        </Campo>
        <Campo label="UF da CTPS">
          <Uf valor={valores.ctpsUf} onChange={(valor) => set('ctpsUf', valor)} />
        </Campo>
        <Campo label="Escolaridade" className="sm:col-span-2">
          <select className={campo} value={valores.escolaridade} onChange={(e) => set('escolaridade', e.target.value)}>
            <option value="">Selecione</option>
            {ESCOLAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </Campo>
      </Secao>

      <Secao titulo="Endereço" texto="Pode ficar em branco e ser completado depois.">
        <Campo label="CEP">
          <div className="flex gap-2">
            <input className={campo} inputMode="numeric" autoComplete="postal-code" value={valores.cep} onChange={(e) => set('cep', mascaraCep(e.target.value))} />
            <button type="button" onClick={() => void buscarCep()} disabled={buscandoCep} className="shrink-0 border rounded-xl px-3 text-sm font-bold text-gray-700 disabled:opacity-60">
              {buscandoCep ? '...' : 'Buscar'}
            </button>
          </div>
          {avisoCep && <span className="text-xs font-bold text-red-700">{avisoCep}</span>}
        </Campo>
        <Campo label="Número">
          <input className={campo} value={valores.numero} placeholder="S/N" onChange={(e) => set('numero', e.target.value)} />
        </Campo>
        <Campo label="Logradouro" className="sm:col-span-2">
          <input className={campo} autoComplete="address-line1" value={valores.logradouro} onChange={(e) => set('logradouro', e.target.value)} />
        </Campo>
        <Campo label="Complemento" className="sm:col-span-2">
          <input className={campo} value={valores.complemento} onChange={(e) => set('complemento', e.target.value)} />
        </Campo>
        <Campo label="Bairro">
          <input className={campo} value={valores.bairro} onChange={(e) => set('bairro', e.target.value)} />
        </Campo>
        <Campo label="Cidade">
          <input className={campo} autoComplete="address-level2" value={valores.cidade} onChange={(e) => set('cidade', e.target.value)} />
        </Campo>
        <Campo label="UF">
          <Uf valor={valores.uf} onChange={(valor) => set('uf', valor)} />
        </Campo>
      </Secao>

      <Secao titulo="Contrato" texto="Pode ficar em branco. Completa o vínculo quando tiver o dado.">
        <Campo label="Função">
          <input className={campo} value={valores.funcao} placeholder="Pedreiro, servente, encarregado" onChange={(e) => set('funcao', e.target.value)} />
        </Campo>
        <Campo label="CBO">
          <input className={campo} inputMode="numeric" value={valores.cbo} placeholder="715210" onChange={(e) => set('cbo', e.target.value)} />
        </Campo>
        <Campo label="Matrícula">
          <input className={campo} value={valores.matricula} onChange={(e) => set('matricula', e.target.value)} />
        </Campo>
        <Campo label="Data de admissão">
          <input className={campo} type="date" value={valores.dataAdmissao} onChange={(e) => set('dataAdmissao', e.target.value)} />
        </Campo>
        <Campo label="Tipo de contrato">
          <select className={campo} value={valores.tipoContrato} onChange={(e) => set('tipoContrato', e.target.value)}>
            <option value="">Selecione</option>
            {CONTRATOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="Salário">
          <input className={campo} inputMode="decimal" value={valores.salario} placeholder="0,00" onChange={(e) => set('salario', e.target.value)} />
        </Campo>
        <Campo label="Jornada" className="sm:col-span-2">
          <input className={campo} value={valores.jornada} placeholder="44 horas semanais" onChange={(e) => set('jornada', e.target.value)} />
        </Campo>
      </Secao>

      <Secao titulo="Pagamento" texto="Conta para o depósito do salário. Pode ficar em branco e ser completada depois.">
        <Campo label="Banco">
          <input className={campo} value={valores.banco} onChange={(e) => set('banco', e.target.value)} />
        </Campo>
        <Campo label="Tipo de conta">
          <select className={campo} value={valores.tipoConta} onChange={(e) => set('tipoConta', e.target.value)}>
            <option value="">Selecione</option>
            {CONTAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="Agência">
          <input className={campo} value={valores.agencia} onChange={(e) => set('agencia', e.target.value)} />
        </Campo>
        <Campo label="Conta">
          <input className={campo} value={valores.conta} onChange={(e) => set('conta', e.target.value)} />
        </Campo>
        <Campo label="Pix" className="sm:col-span-2">
          <input className={campo} value={valores.pix} onChange={(e) => set('pix', e.target.value)} />
        </Campo>
      </Secao>
    </div>
  );
}
