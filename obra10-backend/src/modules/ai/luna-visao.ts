const OPENAI_MODEL = process.env.OPENAI_LUNA_MODEL || 'gpt-4o';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM = `Você é a Luna, lendo uma nota para o estoque do Obra 10.
O fornecedor é o emitente da NF-e/DANFE ou o prestador da NFS-e: quem vendeu ou prestou o serviço.
Nunca use o destinatário, o tomador ou o cliente como fornecedor.
Responda só JSON. Não invente item ilegível. Quantidade com ponto decimal. Datas em YYYY-MM-DD.
CNPJ do emitente tem exatamente 14 dígitos. Se um dígito não estiver nítido, use null — não chute.
Inscrição estadual fica no quadro do emitente e não é o CEP.
Chave de acesso é a do código de barras, 44 dígitos, ou null se não estiver nítida.
Telefone e e-mail do emitente quando aparecerem.`;

type Parte = {
  type?: string;
  text?: string;
  image_url?: { url?: string; detail?: string };
  file?: { filename?: string; file_data?: string };
};

export async function lerNotaLuna(content: Parte[]): Promise<string> {
  const openai = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openai && !anthropic) throw new Error('SEM_CHAVE');

  let falhaOpenAi = '';
  if (openai) {
    try {
      return await pedirOpenAi(openai, content);
    } catch (err: any) {
      falhaOpenAi = String(err?.message || err);
      if (!anthropic) throw err;
    }
  }

  try {
    return await pedirAnthropic(anthropic as string, content);
  } catch (err: any) {
    const detalhe = falhaOpenAi ? ` OpenAI: ${falhaOpenAi}.` : '';
    throw new Error(`Anthropic: ${String(err?.message || err)}.${detalhe}`);
  }
}

async function pedirOpenAi(key: string, content: Parte[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content || '';
}

async function pedirAnthropic(key: string, content: Parte[]): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: paraAnthropic(content) as never }],
  });
  return (response.content || [])
    .filter((bloco) => bloco.type === 'text')
    .map((bloco) => (bloco.type === 'text' ? bloco.text : ''))
    .join('\n')
    .trim();
}

function paraAnthropic(content: Parte[]) {
  const blocos: Array<Record<string, unknown>> = [];
  for (const parte of content) {
    if (parte.type === 'text' && parte.text) {
      blocos.push({ type: 'text', text: parte.text });
      continue;
    }
    const dataUrl = parte.image_url?.url || parte.file?.file_data || '';
    const midia = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!midia) continue;
    const tipo = parte.type === 'file' || midia[1] === 'application/pdf' ? 'document' : 'image';
    blocos.push({
      type: tipo,
      source: { type: 'base64', media_type: midia[1], data: midia[2] },
    });
  }
  return blocos;
}
