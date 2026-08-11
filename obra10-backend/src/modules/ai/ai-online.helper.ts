/** Consulta online em fontes públicas/confiáveis (DDG, Wikipedia, allowlist). */

export interface ResultadoOnline {
  ok: boolean;
  resumo: string;
  fonte?: string;
}

const DOMINIOS_CONFIAVEIS = [
  'wikipedia.org',
  'wikimedia.org',
  'gov.br',
  'abnt.org.br',
  'abntcatalogo.com.br',
  'inmetro.gov.br',
  'ibge.gov.br',
  'planalto.gov.br',
  'bcb.gov.br',
  'caixa.gov.br',
  'ipea.gov.br',
  'duckduckgo.com',
];

/** Resumos públicos conhecidos (sem inventar cláusulas da norma). */
const NBR_RESUMO_PUBLICO: Record<string, string> = {
  '6118':
    'A NBR 6118 é a norma da ABNT que estabelece os requisitos para o projeto de estruturas de concreto (concreto armado e protendido). É a referência principal no Brasil para dimensionamento, detalhamento e critérios de desempenho dessas estruturas. O texto completo oficial fica no catálogo da ABNT (acesso pago).',
  '6120':
    'A NBR 6120 trata das ações para o cálculo de estruturas de edificações (cargas). O texto completo oficial está no catálogo da ABNT.',
  '6122':
    'A NBR 6122 trata de projeto e execução de fundações. O texto completo oficial está no catálogo da ABNT.',
  '5682':
    'A NBR 5682 aborda controle tecnológico do concreto. Consulte o catálogo da ABNT para o texto oficial.',
  '12655':
    'A NBR 12655 trata de concreto de cimento Portland — preparo, controle, recebimento e aceitação. Texto oficial no catálogo da ABNT.',
  '15575':
    'A NBR 15575 (desempenho de edificações habitacionais) define requisitos e critérios de desempenho para edificações. Texto oficial no catálogo da ABNT.',
};

function hostnameDeUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function urlEhConfiavel(url: string): boolean {
  const host = hostnameDeUrl(url);
  if (!host) return false;
  return DOMINIOS_CONFIAVEIS.some(
    (d) => host === d || host.endsWith(`.${d}`),
  );
}

async function fetchJson(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Obra10-Luna/1.0 (assistente-obra)',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  if (!urlEhConfiavel(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'Obra10-Luna/1.0 (assistente-obra)',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (
      !ct.includes('text/html') &&
      !ct.includes('text/plain') &&
      !ct.includes('xml')
    ) {
      return null;
    }
    const html = await res.text();
    return html.slice(0, 200_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parecePaywallOuLogin(texto: string): boolean {
  const t = texto.toLowerCase();
  return (
    /login|assinatura|comprar norma|acesso restrito|paywall|carrinho|adicione ao carrinho|faça login|cadastre-se para/.test(
      t,
    ) && texto.length < 2500
  );
}

async function buscarUrlConfiavel(
  url: string,
  timeoutMs: number,
): Promise<ResultadoOnline | null> {
  if (!urlEhConfiavel(url)) return null;
  const html = await fetchText(url, timeoutMs);
  if (!html) return null;
  const texto = htmlParaTexto(html);
  if (!texto || texto.length < 80) return null;

  const host = hostnameDeUrl(url) || '';
  if (
    host.includes('abntcatalogo') ||
    host.includes('abnt.org') ||
    parecePaywallOuLogin(texto)
  ) {
    return {
      ok: true,
      resumo:
        'Consultei o catálogo/site da ABNT, mas o texto completo das normas é conteúdo oficial pago/restrito — não consigo extrair o miolo da norma daí. ' +
        'Posso te dizer o escopo público da norma (do que ela trata) e te apontar o link oficial. ' +
        'Se quiser, me diga o número da NBR (ex.: 6118) que eu resumo o propósito conhecido publicamente — sem inventar artigos ou cláusulas.',
      fonte: url,
    };
  }

  return {
    ok: true,
    resumo: texto.slice(0, 1200),
    fonte: url,
  };
}

async function buscarDuckDuckGo(
  pergunta: string,
  timeoutMs: number,
): Promise<ResultadoOnline | null> {
  const url =
    'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' +
    encodeURIComponent(pergunta);
  const data = await fetchJson(url, timeoutMs);
  if (!data) return null;

  const abstract = String(data?.AbstractText || '').trim();
  const answer = String(data?.Answer || '').trim();
  const definition = String(data?.Definition || '').trim();
  const related = Array.isArray(data?.RelatedTopics)
    ? data.RelatedTopics.map((t: any) =>
        typeof t?.Text === 'string' ? t.Text : '',
      )
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const texto =
    abstract ||
    answer ||
    definition ||
    (related.length ? related.join('\n') : '');

  if (!texto) return null;
  const fonte =
    data?.AbstractURL || data?.DefinitionURL || data?.AnswerURL || undefined;
  if (fonte && !urlEhConfiavel(String(fonte))) {
    // Aceita abstract do DDG mesmo sem fonte allowlisted; só omite link duvidoso
    return { ok: true, resumo: texto.slice(0, 1200) };
  }
  return {
    ok: true,
    resumo: texto.slice(0, 1200),
    fonte: fonte ? String(fonte) : undefined,
  };
}

function resumoNbrPublico(pergunta: string): ResultadoOnline | null {
  const m = pergunta.match(/nbr\s*(\d+[-\d]*)/i);
  if (!m) return null;
  const num = m[1].replace(/^0+/, '');
  const base = num.split('-')[0];
  const conhecido = NBR_RESUMO_PUBLICO[base] || NBR_RESUMO_PUBLICO[num];
  if (conhecido) {
    return {
      ok: true,
      resumo:
        conhecido +
        ' Se precisar do texto normativo completo (artigos, tabelas e requisitos), a fonte oficial é o catálogo da ABNT.',
      fonte: 'https://www.abntcatalogo.com.br/',
    };
  }
  return {
    ok: true,
    resumo:
      `A NBR ${m[1]} é uma norma técnica da ABNT. Não tenho aqui o texto completo (ele é comercializado no catálogo oficial) e não vou inventar cláusulas. ` +
      `Posso ajudar com o escopo geral se você disser o tema (ex.: concreto, fundações, desempenho) ou com os dados da sua obra no Obra 10.`,
    fonte: 'https://www.abntcatalogo.com.br/',
  };
}

async function buscarWikipedia(
  pergunta: string,
  timeoutMs: number,
): Promise<ResultadoOnline | null> {
  const nbr = pergunta.match(/nbr\s*\d+[-\d]*/i)?.[0];
  const limpa = pergunta
    .replace(
      /pesquise|pesquisar|online|na internet|busca na web|buscar na web|o que [eé]|extrai|extrair|desse catalogo|da abnt/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (nbr) {
    const termoNbr = nbr.replace(/\s+/g, ' ').toUpperCase();
    const tryNbr = async (lang: 'pt' | 'en') => {
      const searchUrl =
        `https://${lang}.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&search=` +
        encodeURIComponent(termoNbr);
      const search = await fetchJson(searchUrl, timeoutMs);
      const titles: string[] = Array.isArray(search?.[1]) ? search[1] : [];
      const title = titles.find(
        (t) =>
          /nbr/i.test(t) &&
          !/^ngc\b/i.test(t) &&
          t
            .toLowerCase()
            .replace(/\s+/g, '')
            .includes(termoNbr.toLowerCase().replace(/\s+/g, '')),
      );
      if (!title) return null;
      const summary = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
          encodeURIComponent(title),
        timeoutMs,
      );
      const extract = String(summary?.extract || '').trim();
      if (!extract || /^ngc\b/i.test(String(summary?.title || ''))) return null;
      return {
        ok: true as const,
        resumo: extract.slice(0, 1200),
        fonte: summary?.content_urls?.desktop?.page || undefined,
      };
    };

    const found = (await tryNbr('pt')) || (await tryNbr('en'));
    if (found) return found;
    return resumoNbrPublico(pergunta);
  }

  const termo = (limpa || pergunta).slice(0, 120);

  const tryWiki = async (lang: 'pt' | 'en') => {
    const searchUrl =
      `https://${lang}.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=` +
      encodeURIComponent(termo);
    const search = await fetchJson(searchUrl, timeoutMs);
    const title = Array.isArray(search?.[1]) ? search[1][0] : null;
    if (!title) return null;
    const summary = await fetchJson(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
        encodeURIComponent(title),
      timeoutMs,
    );
    const extract = String(summary?.extract || '').trim();
    if (!extract) return null;
    return {
      ok: true as const,
      resumo: extract.slice(0, 1200),
      fonte: summary?.content_urls?.desktop?.page || undefined,
    };
  };

  return (await tryWiki('pt')) || (await tryWiki('en'));
}

/**
 * Busca resumo factual online. Não acessa dados de outras empresas do Obra 10 —
 * apenas informação pública na web.
 */
export async function consultarOnline(
  pergunta: string,
  opts?: { urls?: string[]; timeoutMs?: number },
): Promise<ResultadoOnline> {
  const q = (pergunta || '').trim();
  const timeoutMs = opts?.timeoutMs ?? 8000;
  if (!q) {
    return { ok: false, resumo: 'Pergunta vazia para busca online.' };
  }

  const urls = (opts?.urls || []).filter(urlEhConfiavel);
  for (const url of urls.slice(0, 3)) {
    const fromUrl = await buscarUrlConfiavel(url, timeoutMs);
    if (fromUrl?.ok) {
      // Se pediu extrair catálogo ABNT + temos resumo público da NBR, combina
      if (
        /abntcatalogo|abnt\.org/i.test(url) &&
        /nbr\s*\d+/i.test(q)
      ) {
        const publico = resumoNbrPublico(q);
        if (publico) {
          return {
            ok: true,
            resumo: `${publico.resumo}\n\nSobre extrair o catálogo: ${fromUrl.resumo}`,
            fonte: fromUrl.fonte || publico.fonte,
          };
        }
      }
      return fromUrl;
    }
  }

  // Pedido de extração ABNT sem HTML útil
  if (/abnt|catalogo/i.test(q) && /extrai|extrair|informac|texto|norma/i.test(q)) {
    const publico = resumoNbrPublico(q);
    if (publico) return publico;
    return {
      ok: true,
      resumo:
        'Entendi — você quer o conteúdo do catálogo da ABNT. O problema é que o texto completo das normas é pago/restrito, então não consigo “puxar” a norma inteira dali. ' +
        'Me diga o número da NBR (ex.: 6118) que eu te explico o propósito público dela e te passo o link oficial. Sem inventar artigos ou tabelas.',
      fonte: 'https://www.abntcatalogo.com.br/',
    };
  }

  const ddg = await buscarDuckDuckGo(q, timeoutMs);
  if (ddg?.ok) return ddg;

  const wiki = await buscarWikipedia(q, timeoutMs);
  if (wiki?.ok) return wiki;

  const publico = resumoNbrPublico(q);
  if (publico) return publico;

  return {
    ok: false,
    resumo:
      'Olhei em fontes abertas, mas não achei um resumo direto. Se puder, manda o nome da norma, o link (de site confiável) ou reformula a pergunta.',
  };
}

/** Resposta online em tom natural (sem jargão de sistema). */
export function formatarRespostaOnline(r: ResultadoOnline): string {
  if (!r.ok) return r.resumo;
  return r.fonte ? `${r.resumo}\n\nFonte: ${r.fonte}` : r.resumo;
}
