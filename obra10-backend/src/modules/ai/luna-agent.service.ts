import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { LunaAuth, LunaToolsService } from './luna-tools.service';

const OPENAI_MODEL = process.env.OPENAI_LUNA_MODEL || 'gpt-4o';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const MAX_ROUNDS = 8;
const MAX_OUTPUT_TOKENS = 2048;

export const LUNA_SYSTEM_PROMPT = `Você é a Luna, assessora do Obra 10 (gestão de obras da Lunardeli).
Fale em português brasileiro, natural e prestativa — como uma secretária que conhece a empresa e o sistema.

Como trabalhar:
- Use as ferramentas para buscar fatos. Não invente número, nome de obra, status de RDO nem cláusula de norma.
- Para um fato específico (quando algo aconteceu, quem fez, o que está escrito no diário), chame buscar_no_aplicativo. Cite a obra, a data e o trecho. Se a busca voltar vazia, diga que não achou.
- O padrão é a EMPRESA INTEIRA: se o usuário citar outro empreendimento, busque pelo nome (listar_obras → buscar_no_aplicativo / ver_rdo). A obra da tela atual é só contexto, não uma prisão.
- Dúvida de uso (“onde clico”, “como aprovo”, “PDF com fotos”, Relatórios): chame ajuda_obra10 e explique o caminho.
- Para ajustar diário, equipe ou catálogo, chame propor_ajuste e espere a pessoa confirmar. Você não grava nada sozinha. Não apague empresa, não troque senha e não mexa em cobrança.
- Se faltar permissão, diga e indique quem pode (gestor / Equipe).
- Separe o que veio do banco Obra 10 vs. fonte aberta.
- Responda completo, como um bom ChatGPT: parágrafos claros, listas quando ajudar, e um próximo passo. Não entregue um parágrafo engessado de uma linha se houver dado.

Se as tools voltarem vazio, diga o período/obra que consultou e peça ajuste.`;

export function buildLunaSystemPrompt(telaObraId?: string | null) {
  const hoje = new Date().toISOString().slice(0, 10);
  const tela = telaObraId
    ? `O usuário está com a obra ${telaObraId} aberta na tela — isso é só “estou aqui agora”, não limite a busca se ele citar outro canteiro.`
    : 'O usuário não está dentro de uma obra específica; consulte a empresa (obras que o JWT enxerga).';
  return `${LUNA_SYSTEM_PROMPT}

Hoje (UTC): ${hoje}.
${tela}`;
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function acaoDeTool(output: string): { id: string; resumo: string } | undefined {
  try {
    const parsed = JSON.parse(output);
    if (parsed?.pendente && parsed.id && parsed.resumo) {
      return { id: String(parsed.id), resumo: String(parsed.resumo) };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export type LunaStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: string; acao?: { id: string; resumo: string } }
  | { type: 'acao'; acao: { id: string; resumo: string } }
  | { type: 'error'; reply: string };

@Injectable()
export class LunaAgentService {
  private readonly logger = new Logger(LunaAgentService.name);

  constructor(
    private readonly tools: LunaToolsService,
    private readonly aiService: AiService,
  ) {}

  async chat(
    auth: LunaAuth,
    message: string,
    history: ChatMsg[],
    telaObraId?: string | null,
  ): Promise<{ reply: string; acao?: { id: string; resumo: string } }> {
    let reply = '';
    let acao: { id: string; resumo: string } | undefined;
    for await (const ev of this.stream(auth, message, history, telaObraId)) {
      if (ev.type === 'acao') acao = ev.acao;
      if (ev.type === 'done' || ev.type === 'error') {
        reply = ev.reply;
        if (ev.type === 'done' && ev.acao) acao = ev.acao;
      }
    }
    return { reply, acao };
  }

  async *stream(
    auth: LunaAuth,
    message: string,
    history: ChatMsg[],
    telaObraId?: string | null,
  ): AsyncGenerator<LunaStreamEvent> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        yield* this.streamOpenAi(openaiKey, auth, message, history, telaObraId);
        return;
      } catch (err: any) {
        this.logger.error(`[Luna] OpenAI falhou: ${err?.message}`);
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const reply = await this.chatAnthropic(
          anthropicKey,
          auth,
          message,
          history,
          telaObraId,
        );
        if (reply) {
          yield { type: 'delta', text: reply };
          yield { type: 'done', reply };
          return;
        }
      } catch (err: any) {
        this.logger.error(`[Luna] Anthropic falhou: ${err?.message}`);
      }
    }

    try {
      const local = await this.aiService.chat(
        auth.empresaId,
        auth.userId,
        message,
        history,
        telaObraId,
      );
      if (local?.reply) {
        yield { type: 'delta', text: local.reply };
        yield { type: 'done', reply: local.reply };
        return;
      }
    } catch (err: any) {
      this.logger.warn(`[Luna] Fallback local falhou: ${err?.message}`);
    }

    const fallback =
      'Não consegui falar com o modelo de IA agora (falta chave OpenAI/Anthropic ou a API falhou). Posso tentar de novo em instantes — ou me pergunte de novo.';
    yield { type: 'error', reply: fallback };
  }

  private historyToOpenAi(
    history: ChatMsg[],
    message: string,
    telaObraId?: string | null,
  ) {
    const msgs: Array<{ role: string; content: any; tool_call_id?: string }> = [
      { role: 'system', content: buildLunaSystemPrompt(telaObraId) },
    ];
    for (const h of (history || []).slice(-12)) {
      if (h.role === 'user' || h.role === 'assistant') {
        msgs.push({ role: h.role, content: h.content });
      }
    }
    msgs.push({ role: 'user', content: message });
    return msgs;
  }

  private async *streamOpenAi(
    apiKey: string,
    auth: LunaAuth,
    message: string,
    history: ChatMsg[],
    telaObraId?: string | null,
  ): AsyncGenerator<LunaStreamEvent> {
    const messages = this.historyToOpenAi(history, message, telaObraId);
    const tools = this.tools.openaiTools();
    let full = '';
    let acao: { id: string; resumo: string } | undefined;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.4,
          max_tokens: MAX_OUTPUT_TOKENS,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 400)}`);
      }

      const toolCalls: Record<
        number,
        { id: string; name: string; arguments: string }
      > = {};
      let finish: string | null = null;
      let roundText = '';

      const reader = res.body?.getReader();
      if (!reader) throw new Error('OpenAI sem corpo de stream.');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          let json: any;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const choice = json.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finish = choice.finish_reason;
          const delta = choice.delta || {};
          if (delta.content) {
            roundText += delta.content;
            full += delta.content;
            yield { type: 'delta', text: delta.content };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                };
              } else {
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments) {
                  toolCalls[idx].arguments += tc.function.arguments;
                }
              }
            }
          }
        }
      }

      const calls = Object.values(toolCalls).filter((c) => c.name);
      if (!calls.length) {
        yield { type: 'done', reply: full || roundText, acao };
        return;
      }

      messages.push({
        role: 'assistant',
        content: roundText || null,
        tool_calls: calls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.arguments || '{}' },
        })),
      } as any);

      for (const call of calls) {
        let parsed: Record<string, any> = {};
        try {
          parsed = JSON.parse(call.arguments || '{}');
        } catch {
          parsed = {};
        }
        const output = await this.tools.execute(
          call.name,
          parsed,
          auth,
          telaObraId,
        );
        if (call.name === 'propor_ajuste') {
          const pendente = acaoDeTool(output);
          if (pendente) {
            acao = pendente;
            yield { type: 'acao', acao: pendente };
          }
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        });
      }

      if (finish && finish !== 'tool_calls') {
        yield { type: 'done', reply: full || roundText, acao };
        return;
      }
    }

    yield {
      type: 'done',
      reply: full || 'Consultei os dados, mas a resposta veio incompleta. Pergunte de novo com um recorte menor.',
      acao,
    };
  }

  private async chatAnthropic(
    apiKey: string,
    auth: LunaAuth,
    message: string,
    history: ChatMsg[],
    telaObraId?: string | null,
  ): Promise<string> {
    let Anthropic: any;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      return '';
    }
    const client = new Anthropic.default({ apiKey });
    const messages: any[] = [];
    for (const h of (history || []).slice(-12)) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: message });

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: buildLunaSystemPrompt(telaObraId),
        tools: this.tools.anthropicTools(),
        messages,
      });

      const toolUses = (response.content || []).filter(
        (b: any) => b.type === 'tool_use',
      );
      const texts = (response.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim();

      if (!toolUses.length) return texts;

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const output = await this.tools.execute(
          tu.name,
          tu.input || {},
          auth,
          telaObraId,
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: output,
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }
    return '';
  }
}
