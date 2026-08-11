/** Consulta leve à internet quando o usuário pede (DDG + Wikipedia). */

export interface ResultadoOnline {
  ok: boolean;
  resumo: string;
  fonte?: string;
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
  return {
    ok: true,
    resumo: texto.slice(0, 1200),
    fonte: fonte ? String(fonte) : undefined,
  };
}

async function buscarWikipedia(
  pergunta: string,
  timeoutMs: number,
): Promise<ResultadoOnline | null> {
  const nbr = pergunta.match(/nbr\s*\d+[-\d]*/i)?.[0];
  const limpa = pergunta
    .replace(
      /pesquise|pesquisar|online|na internet|busca na web|buscar na web|o que [eé]/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Normas NBR: Wikipedia costuma não ter página — evita falso positivo (ex.: NGC 6118)
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
          t.toLowerCase().includes(termoNbr.toLowerCase().replace(/\s+/g, '')),
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

    return {
      ok: true,
      resumo:
        `${termoNbr} é uma norma técnica da ABNT (Associação Brasileira de Normas Técnicas). ` +
        `Não encontrei um resumo enciclopédico confiável na Wikipedia para o texto completo da norma. ` +
        `Para o conteúdo oficial, consulte o catálogo da ABNT ou a publicação técnica correspondente. ` +
        `(A Luna não mistura isso com dados de outras empresas do Obra 10.)`,
      fonte: 'https://www.abntcatalogo.com.br/',
    };
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
  timeoutMs = 8000,
): Promise<ResultadoOnline> {
  const q = (pergunta || '').trim();
  if (!q) {
    return { ok: false, resumo: 'Pergunta vazia para busca online.' };
  }

  const ddg = await buscarDuckDuckGo(q, timeoutMs);
  if (ddg?.ok) return ddg;

  const wiki = await buscarWikipedia(q, timeoutMs);
  if (wiki?.ok) return wiki;

  return {
    ok: false,
    resumo:
      'Consultei a internet, mas não encontrei um resumo direto para essa pergunta. Tente reformular (ex.: nome da norma, material ou conceito).',
  };
}

export function formatarRespostaOnline(r: ResultadoOnline): string {
  if (!r.ok) return r.resumo;
  return (
    `Consulta online:\n${r.resumo}` +
    (r.fonte ? `\n\nFonte: ${r.fonte}` : '')
  );
}
