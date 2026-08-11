/** Helpers de agregação e intenções factuais para Luna / Relatório IA. */

export type EscopoConsulta = 'obra' | 'empresa';

export type IntencaoFactual =
  | 'chuva_clima'
  | 'efetivo'
  | 'atividades'
  | 'pendencias'
  | 'status_rdos'
  | 'obras'
  | null;

export interface PeriodoInferido {
  dataInicio: Date;
  dataFim: Date;
  label: string;
}

export interface DiaRdoResumo {
  data: string;
  obraId: string;
  obraNome: string;
  status: string;
  clima: string;
  climaManha?: string;
  climaTarde?: string;
  climaNoite?: string;
  teveChuva: boolean;
  efetivoTotal: number;
  profissionais: Array<{ nome: string; quantidade: number }>;
  atividades: string[];
  pendencias: string[];
  observacoes: string;
}

export interface ContextoAgregado {
  escopo: EscopoConsulta;
  obraId?: string;
  obraNome?: string;
  dataInicio: string;
  dataFim: string;
  periodoLabel: string;
  totalRdos: number;
  aprovados: number;
  submetidos: number;
  rascunhos: number;
  rejeitados: number;
  porStatus: Record<string, number>;
  diasChuva: number;
  datasChuva: string[];
  diasSol: number;
  diasNublado: number;
  diasOutros: number;
  mediaEfetivo: number;
  totalEfetivoAcumulado: number;
  profissionaisMap: Record<string, number>;
  topAtividades: Array<{ item: string; count: number }>;
  topPendencias: Array<{ item: string; count: number }>;
  dias: DiaRdoResumo[];
  obrasNomes: string[];
}

const MESES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const CHUVA_TOKENS = [
  'chuva',
  'chuvoso',
  'chuvosa',
  'tempestade',
  'garoa',
  '🌧️',
  '⛈️',
  '🌦️',
  '☔',
];

const SOL_TOKENS = ['sol', 'ensolarado', 'ensolarada', '☀️', 'claro'];
const NUBLADO_TOKENS = ['nublado', 'nublada', '☁️', '⛅', 'parcialmente nublado'];

export function normalizarTexto(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function capitalizarPrimeiraLetra(texto: string): string {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function extrairLinhasDeTexto(texto: any): string[] {
  if (!texto) return [];
  if (Array.isArray(texto)) {
    return texto
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          if (typeof item.descricao === 'string') return item.descricao.trim();
          if (typeof item.texto === 'string') return item.texto.trim();
          if (typeof item.nome === 'string') return item.nome.trim();
        }
        return '';
      })
      .filter((line) => line.length > 0);
  }
  if (typeof texto !== 'string') return [];
  return texto
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
    .filter((line) => line.length > 0);
}

export function formatarDataISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Inferir período a partir da pergunta; padrão = últimos 30 dias. */
export function inferirPeriodo(pergunta: string, agora = new Date()): PeriodoInferido {
  const n = normalizarTexto(pergunta);
  const hoje = fimDoDia(agora);

  if (/\bhoje\b/.test(n)) {
    const ini = inicioDoDia(agora);
    return { dataInicio: ini, dataFim: hoje, label: 'hoje' };
  }

  if (/\bontem\b/.test(n)) {
    const d = new Date(agora);
    d.setDate(d.getDate() - 1);
    return {
      dataInicio: inicioDoDia(d),
      dataFim: fimDoDia(d),
      label: 'ontem',
    };
  }

  if (/este mes|mes atual|neste mes|do mes/.test(n) && !/mes passado/.test(n)) {
    const ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return {
      dataInicio: inicioDoDia(ini),
      dataFim: hoje,
      label: 'este mês',
    };
  }

  if (/mes passado|ultimo mes/.test(n)) {
    const ini = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth(), 0);
    return {
      dataInicio: inicioDoDia(ini),
      dataFim: fimDoDia(fim),
      label: 'mês passado',
    };
  }

  const matchDias = n.match(/ultimos?\s+(\d+)\s+dias?/);
  if (matchDias) {
    const qtd = Math.min(Math.max(parseInt(matchDias[1], 10) || 30, 1), 365);
    const ini = new Date(agora);
    ini.setDate(ini.getDate() - (qtd - 1));
    return {
      dataInicio: inicioDoDia(ini),
      dataFim: hoje,
      label: `últimos ${qtd} dias`,
    };
  }

  for (const [nome, mes] of Object.entries(MESES)) {
    if (n.includes(normalizarTexto(nome))) {
      const anoMatch = n.match(/\b(20\d{2})\b/);
      const ano = anoMatch
        ? parseInt(anoMatch[1], 10)
        : agora.getMonth() >= mes
          ? agora.getFullYear()
          : agora.getFullYear() - 1;
      const ini = new Date(ano, mes, 1);
      const fim = new Date(ano, mes + 1, 0);
      const fimClamped = fim > agora ? hoje : fimDoDia(fim);
      return {
        dataInicio: inicioDoDia(ini),
        dataFim: fimClamped,
        label: `${capitalizarPrimeiraLetra(nome)}/${ano}`,
      };
    }
  }

  // Padrão: últimos 30 dias
  const ini = new Date(agora);
  ini.setDate(ini.getDate() - 29);
  return {
    dataInicio: inicioDoDia(ini),
    dataFim: hoje,
    label: 'últimos 30 dias',
  };
}

/** Detecta se a pergunta pede consolidação da empresa. */
export function detectarEscopo(
  pergunta: string,
  obraIdHeader?: string | null,
): EscopoConsulta {
  const n = normalizarTexto(pergunta);
  const querEmpresa =
    /todas as obras|todas obras|na empresa|da empresa|em todas|geral da empresa|consolidado/.test(
      n,
    );
  if (querEmpresa) return 'empresa';
  if (obraIdHeader) return 'obra';
  return 'empresa';
}

export function detectarIntencaoFactual(pergunta: string): IntencaoFactual {
  const n = normalizarTexto(pergunta);

  if (
    /chuva|choveu|chovendo|clima|tempo|tempestade|garoa|ensolarado|nublado/.test(
      n,
    )
  ) {
    return 'chuva_clima';
  }
  if (
    /efetivo|profissional|pedreiro|servente|trabalhou|pessoas|equipe|mao de obra|funcionario|colaborador/.test(
      n,
    )
  ) {
    return 'efetivo';
  }
  if (
    /quantos rdo|qtd de rdo|quantidade de rdo|status dos rdo|rdos? pendente|aguardando aprovacao|aprovados|submetidos/.test(
      n,
    ) ||
    (/rdo/.test(n) && /pendente|aprovad|submetid|rascunho|total/.test(n))
  ) {
    return 'status_rdos';
  }
  if (/pendenc|atrasad|nao feito|cobranca|atividades pendentes/.test(n)) {
    return 'pendencias';
  }
  if (
    /atividade|servico|feito|executad|andamento|o que foi feito|trabalhos realizados/.test(
      n,
    )
  ) {
    return 'atividades';
  }
  if (/obras? ativa|quais obras|lista de obras|canteiros/.test(n)) {
    return 'obras';
  }
  return null;
}

export function textoClimaDeExtras(d: any): {
  climaStr: string;
  climaManha?: string;
  climaTarde?: string;
  climaNoite?: string;
  textLower: string;
} {
  const climaManha = d?.climaManha ? String(d.climaManha) : undefined;
  const climaTarde = d?.climaTarde ? String(d.climaTarde) : undefined;
  const climaNoite = d?.climaNoite ? String(d.climaNoite) : undefined;

  let climaStr = '';
  if (d?.clima) {
    climaStr = String(d.clima);
  } else if (climaManha || climaTarde || climaNoite) {
    climaStr = `Manhã: ${climaManha ?? '—'}, Tarde: ${climaTarde ?? '—'}, Noite: ${climaNoite ?? '—'}`;
  } else if (d?.condicoesClimaticas) {
    climaStr = String(d.condicoesClimaticas);
  } else {
    climaStr = 'Não informado';
  }

  const textLower = [climaManha, climaTarde, climaNoite, d?.clima, d?.condicoesClimaticas]
    .filter(Boolean)
    .map((c) => String(c).toLowerCase())
    .join(' ');

  return { climaStr, climaManha, climaTarde, climaNoite, textLower };
}

export function classificarClima(textLower: string): {
  teveChuva: boolean;
  categoria: 'chuva' | 'sol' | 'nublado' | 'outros';
} {
  const t = textLower || '';
  if (CHUVA_TOKENS.some((tok) => t.includes(tok))) {
    return { teveChuva: true, categoria: 'chuva' };
  }
  if (SOL_TOKENS.some((tok) => t.includes(tok))) {
    return { teveChuva: false, categoria: 'sol' };
  }
  if (NUBLADO_TOKENS.some((tok) => t.includes(tok))) {
    return { teveChuva: false, categoria: 'nublado' };
  }
  return { teveChuva: false, categoria: 'outros' };
}

export function extrairEfetivoDoRdo(r: {
  dadosExtras?: any;
  efetivos?: Array<{ quantidade: number; funcaoCargo?: string }>;
}): { total: number; profissionais: Array<{ nome: string; quantidade: number }> } {
  const d = (r.dadosExtras as any) || {};
  const profissionais: Array<{ nome: string; quantidade: number }> = [];

  if (Array.isArray(d.profissionais) && d.profissionais.length > 0) {
    d.profissionais.forEach((p: any) => {
      if (p && typeof p === 'object') {
        const nome = String(p.nome || p.funcao || 'Profissional').trim();
        const quantidade = Number(p.quantidade || 0);
        if (nome) profissionais.push({ nome, quantidade });
      }
    });
  } else if (Array.isArray(r.efetivos)) {
    r.efetivos.forEach((e) => {
      profissionais.push({
        nome: e.funcaoCargo || 'Profissional',
        quantidade: e.quantidade || 0,
      });
    });
  }

  const total = profissionais.reduce((s, p) => s + (p.quantidade || 0), 0);
  return { total, profissionais };
}

export function agregarRdosParaContexto(params: {
  rdos: any[];
  escopo: EscopoConsulta;
  obraId?: string;
  obraNome?: string;
  dataInicio: Date;
  dataFim: Date;
  periodoLabel: string;
}): ContextoAgregado {
  const {
    rdos,
    escopo,
    obraId,
    obraNome,
    dataInicio,
    dataFim,
    periodoLabel,
  } = params;

  const porStatus: Record<string, number> = {};
  const frequenciaAtividades: Record<string, number> = {};
  const frequenciaPendencias: Record<string, number> = {};
  const profissionaisMap: Record<string, number> = {};
  const obrasSet = new Set<string>();
  const datasChuva: string[] = [];

  let diasChuva = 0;
  let diasSol = 0;
  let diasNublado = 0;
  let diasOutros = 0;
  let totalEfetivoAcumulado = 0;

  const dias: DiaRdoResumo[] = rdos.map((r) => {
    const d = (r.dadosExtras as any) || {};
    const data = formatarDataISO(new Date(r.dataReferencia));
    const status = String(r.status || '');
    porStatus[status] = (porStatus[status] || 0) + 1;

    const nomeObra = r.obra?.nome || obraNome || 'Obra';
    const idObra = r.obraId || r.obra?.id || obraId || '';
    obrasSet.add(nomeObra);

    const { climaStr, climaManha, climaTarde, climaNoite, textLower } =
      textoClimaDeExtras(d);
    const { teveChuva, categoria } = classificarClima(textLower);
    if (categoria === 'chuva') {
      diasChuva++;
      datasChuva.push(data);
    } else if (categoria === 'sol') diasSol++;
    else if (categoria === 'nublado') diasNublado++;
    else diasOutros++;

    const { total, profissionais } = extrairEfetivoDoRdo(r);
    totalEfetivoAcumulado += total;
    profissionais.forEach((p) => {
      profissionaisMap[p.nome] = (profissionaisMap[p.nome] || 0) + p.quantidade;
    });

    const atividades = extrairLinhasDeTexto(d.atividadesExecutadas);
    if ((!atividades || atividades.length === 0) && Array.isArray(r.atividades)) {
      r.atividades.forEach((a: any) => {
        if (a?.descricao) atividades.push(a.descricao);
      });
    }
    if (Array.isArray(r.tarefas)) {
      r.tarefas
        .filter((t: any) => t.statusExecucao === 'EXECUTADO')
        .forEach((t: any) => {
          if (t.descricao && !atividades.includes(t.descricao)) {
            atividades.push(t.descricao);
          }
        });
    }
    atividades.forEach((atv) => {
      const key = atv.toLowerCase();
      frequenciaAtividades[key] = (frequenciaAtividades[key] || 0) + 1;
    });

    const pendencias = extrairLinhasDeTexto(d.atividadesPendentes);
    if (Array.isArray(r.tarefas)) {
      r.tarefas
        .filter((t: any) => t.statusExecucao && t.statusExecucao !== 'EXECUTADO')
        .forEach((t: any) => {
          const desc = t.motivoNaoExecucao
            ? `${t.descricao} (${t.motivoNaoExecucao})`
            : t.descricao;
          if (desc && !pendencias.includes(desc)) pendencias.push(desc);
        });
    }
    pendencias.forEach((pnd) => {
      const key = pnd.toLowerCase();
      frequenciaPendencias[key] = (frequenciaPendencias[key] || 0) + 1;
    });

    const observacoes = extrairLinhasDeTexto(d.observacoes).join('\n');

    return {
      data,
      obraId: idObra,
      obraNome: nomeObra,
      status,
      clima: climaStr,
      climaManha,
      climaTarde,
      climaNoite,
      teveChuva,
      efetivoTotal: total,
      profissionais,
      atividades,
      pendencias,
      observacoes,
    };
  });

  const totalRdos = dias.length;
  const topAtividades = Object.entries(frequenciaAtividades)
    .map(([item, count]) => ({ item: capitalizarPrimeiraLetra(item), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const topPendencias = Object.entries(frequenciaPendencias)
    .map(([item, count]) => ({ item: capitalizarPrimeiraLetra(item), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    escopo,
    obraId,
    obraNome,
    dataInicio: formatarDataISO(dataInicio),
    dataFim: formatarDataISO(dataFim),
    periodoLabel,
    totalRdos,
    aprovados: porStatus['APROVADO'] || 0,
    submetidos: porStatus['SUBMETIDO'] || 0,
    rascunhos:
      (porStatus['RASCUNHO'] || 0) + (porStatus['EM_PREENCHIMENTO'] || 0),
    rejeitados: porStatus['REJEITADO'] || 0,
    porStatus,
    diasChuva,
    datasChuva,
    diasSol,
    diasNublado,
    diasOutros,
    mediaEfetivo: totalRdos > 0 ? Math.round(totalEfetivoAcumulado / totalRdos) : 0,
    totalEfetivoAcumulado,
    profissionaisMap,
    topAtividades,
    topPendencias,
    dias,
    obrasNomes: Array.from(obrasSet),
  };
}

/** Monta texto resumido do contexto para o system prompt / fallback. */
export function formatarContextoParaPrompt(ctx: ContextoAgregado): string {
  const escopoLabel =
    ctx.escopo === 'obra'
      ? `Obra: ${ctx.obraNome || ctx.obraId || 'ativa'}`
      : `Empresa (obras: ${ctx.obrasNomes.join(', ') || 'nenhuma'})`;

  const amostra = ctx.dias
    .slice(-20)
    .map((d) => {
      const atv =
        d.atividades.slice(0, 3).join('; ') || 'sem atividades registradas';
      return `- ${d.data} [${d.obraNome}] status=${d.status} clima=${d.clima} chuva=${d.teveChuva ? 'sim' : 'não'} efetivo=${d.efetivoTotal} | ${atv}`;
    })
    .join('\n');

  const profs = Object.entries(ctx.profissionaisMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, qtd]) => `${nome}: ${qtd}`)
    .join(', ');

  return `ESCOPO: ${escopoLabel}
PERÍODO: ${ctx.dataInicio} a ${ctx.dataFim} (${ctx.periodoLabel})
TOTAIS: ${ctx.totalRdos} diários | aprovados=${ctx.aprovados} | submetidos=${ctx.submetidos} | rascunhos=${ctx.rascunhos} | rejeitados=${ctx.rejeitados}
CLIMA: chuva=${ctx.diasChuva} dia(s)${ctx.datasChuva.length ? ` (${ctx.datasChuva.join(', ')})` : ''} | sol=${ctx.diasSol} | nublado=${ctx.diasNublado} | outros=${ctx.diasOutros}
EFETIVO: média diária=${ctx.mediaEfetivo} | acumulado=${ctx.totalEfetivoAcumulado}${profs ? ` | por função: ${profs}` : ''}
TOP ATIVIDADES: ${JSON.stringify(ctx.topAtividades.slice(0, 8))}
TOP PENDÊNCIAS: ${JSON.stringify(ctx.topPendencias.slice(0, 8))}
AMOSTRA DE DIÁRIOS (mais recentes):
${amostra || 'Nenhum diário no período.'}`;
}

/** Resposta factual determinística a partir do contexto agregado. */
export function responderFactual(
  intencao: IntencaoFactual,
  ctx: ContextoAgregado,
  pergunta: string,
  extras?: { obrasAtivas?: string[]; totalPendentesEmpresa?: number },
): string | null {
  if (!intencao) return null;

  const onde =
    ctx.escopo === 'obra'
      ? `na obra ${ctx.obraNome || 'ativa'}`
      : 'nas obras da empresa';
  const periodo = `no período ${ctx.dataInicio} a ${ctx.dataFim} (${ctx.periodoLabel})`;

  if (intencao === 'obras') {
    const lista =
      extras?.obrasAtivas?.length
        ? extras.obrasAtivas.map((n) => `- ${n}`).join('\n')
        : ctx.obrasNomes.map((n) => `- ${n}`).join('\n');
    return lista
      ? `Obras ativas no momento:\n${lista}`
      : 'Não há obras ativas cadastradas no momento.';
  }

  if (ctx.totalRdos === 0) {
    return `Não encontrei diários de obra ${onde} ${periodo}. Se precisar, ajuste o período ou confira se já existem RDOs registrados.`;
  }

  if (intencao === 'chuva_clima') {
    const datas =
      ctx.datasChuva.length > 0
        ? `\nDatas com chuva: ${ctx.datasChuva.join(', ')}.`
        : '';
    return (
      `${onde.charAt(0).toUpperCase() + onde.slice(1)}, ${periodo}, analisei ${ctx.totalRdos} diário(s) ` +
      `(${ctx.aprovados} aprovado(s)).\n` +
      `Chuva ou tempo instável: ${ctx.diasChuva} dia(s).${datas}\n` +
      `Sol: ${ctx.diasSol} | Nublado: ${ctx.diasNublado} | Outros/não informado: ${ctx.diasOutros}.`
    );
  }

  if (intencao === 'efetivo') {
    const lista = Object.entries(ctx.profissionaisMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, qtd]) => `- ${nome}: ${qtd} (acumulado no período)`)
      .join('\n');
    return (
      `${onde.charAt(0).toUpperCase() + onde.slice(1)}, ${periodo}:\n` +
      `- Efetivo acumulado: ${ctx.totalEfetivoAcumulado}\n` +
      `- Média diária: ${ctx.mediaEfetivo} profissional(is)\n` +
      (lista ? `Distribuição:\n${lista}` : '- Sem profissionais detalhados nos diários.')
    );
  }

  if (intencao === 'atividades') {
    if (ctx.topAtividades.length === 0) {
      return `Não há atividades executadas registradas ${onde} ${periodo}.`;
    }
    const lista = ctx.topAtividades
      .slice(0, 10)
      .map((a) => `- ${a.item} (${a.count}x)`)
      .join('\n');
    return `Principais atividades executadas ${onde} ${periodo} (${ctx.totalRdos} diários):\n${lista}`;
  }

  if (intencao === 'pendencias') {
    if (ctx.topPendencias.length === 0) {
      return `Não há pendências registradas ${onde} ${periodo}.`;
    }
    const lista = ctx.topPendencias
      .slice(0, 10)
      .map((a) => `- ${a.item} (${a.count}x)`)
      .join('\n');
    return `Pendências mais citadas ${onde} ${periodo}:\n${lista}`;
  }

  if (intencao === 'status_rdos') {
    const pendEmpresa =
      extras?.totalPendentesEmpresa != null
        ? `\nPendentes de aprovação na empresa agora: ${extras.totalPendentesEmpresa}.`
        : '';
    return (
      `${onde.charAt(0).toUpperCase() + onde.slice(1)}, ${periodo}:\n` +
      `- Total de diários: ${ctx.totalRdos}\n` +
      `- Aprovados: ${ctx.aprovados}\n` +
      `- Submetidos (aguardando): ${ctx.submetidos}\n` +
      `- Rascunhos/em preenchimento: ${ctx.rascunhos}\n` +
      `- Rejeitados: ${ctx.rejeitados}` +
      pendEmpresa
    );
  }

  // fallback genérico com fatos
  void pergunta;
  return null;
}

/** Resposta local limpa quando a API externa falha (sem mencionar chave/créditos). */
export function respostaLocalAmigavel(
  ctx: ContextoAgregado | null,
  extras?: {
    obrasAtivas?: string[];
    totalRdosMes?: number;
    totalPendentes?: number;
  },
): string {
  if (ctx && ctx.totalRdos > 0) {
    return (
      `Consultei os diários ${ctx.escopo === 'obra' ? `da obra ${ctx.obraNome || 'ativa'}` : 'da empresa'} ` +
      `(${ctx.dataInicio} a ${ctx.dataFim}): ${ctx.totalRdos} registro(s), ` +
      `${ctx.diasChuva} dia(s) com chuva, média de ${ctx.mediaEfetivo} profissional(is)/dia, ` +
      `${ctx.aprovados} aprovado(s) e ${ctx.submetidos} aguardando aprovação.\n\n` +
      `Se quiser, pergunte de forma específica (ex.: dias de chuva, efetivo ou atividades no período).`
    );
  }

  const obras = extras?.obrasAtivas?.join(', ') || 'nenhuma obra ativa';
  return (
    `Olá! Sou a Luna, sua assistente no Obra 10. Neste momento consigo te adiantar:\n` +
    `- Obras ativas: ${obras}\n` +
    `- RDOs este mês: ${extras?.totalRdosMes ?? 0}\n` +
    `- Pendentes de aprovação: ${extras?.totalPendentes ?? 0}\n\n` +
    `Pergunte sobre chuva, efetivo ou atividades da obra ativa que eu consulto os diários no banco.`
  );
}
