export const MCP_URL = 'https://obra10.app.br/mcp';
export const MCP_TOKEN_URL = 'https://obra10.app.br/auth/token';

export const MCP_TOKEN_CURL = `curl -X POST ${MCP_TOKEN_URL} -H "Content-Type: application/json" -d '{"email":"seu@email","senha":"sua-senha"}'`;

export const MCP_CONNECT_GUIDE = `Endpoint MCP (Streamable HTTP): ${MCP_URL}
Token Bearer (7 dias): POST ${MCP_TOKEN_URL}
Corpo: { "email": "seu@email", "senha": "sua-senha", "empresaId": "(só se o e-mail estiver em mais de uma empresa)" }
Use o access_token em Authorization: Bearer. A empresa vem só do JWT — não envie empresa no MCP.
As tools são as mesmas da Luna (leitura). Sem escrita e sem WhatsApp.

ChatGPT
1. Gere o token com POST /auth/token.
2. Em Configurações, ative o Developer Mode (Apps / Conectores).
3. Adicione um conector com a URL ${MCP_URL} e autenticação Bearer (cole o access_token).
4. Se a tela só oferecer OAuth e recusar Bearer, crie um Custom GPT com Action autenticada por API Key (Bearer) ou use Claude / Gemini / Codex.

Claude
1. Gere o mesmo token.
2. Em Claude.ai: Configurações → Integrações / conectores → adicionar servidor remoto ${MCP_URL} com header Authorization: Bearer.
3. No Claude Desktop, em claude_desktop_config.json:
{
  "mcpServers": {
    "obra10": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}

Gemini
1. Gere o mesmo token.
2. No Gemini (Gem / conector MCP) ou no Google AI Studio, cadastre o servidor remoto ${MCP_URL}.
3. Envie Authorization: Bearer em todos os POSTs JSON-RPC (initialize, tools/list, tools/call).`;

export const MCP_CLIENT_STEPS = [
  {
    id: 'token',
    title: 'Token',
    body: `POST ${MCP_TOKEN_URL} com e-mail e senha do Obra 10. O JSON devolve access_token (Bearer, 7 dias). Se o e-mail existir em mais de uma empresa, envie também empresaId.`,
  },
  {
    id: 'chatgpt',
    title: 'ChatGPT',
    body: `Developer Mode → adicionar conector ${MCP_URL} com Bearer. Se só houver OAuth, use Custom GPT (Action + API Key Bearer) ou Claude/Gemini.`,
  },
  {
    id: 'claude',
    title: 'Claude',
    body: `Conector remoto em Claude.ai, ou no Desktop: mcpServers.obra10.url = ${MCP_URL} e headers.Authorization = Bearer SEU_TOKEN.`,
  },
  {
    id: 'gemini',
    title: 'Gemini',
    body: `Cadastre o MCP remoto ${MCP_URL} e envie Authorization: Bearer em initialize / tools/list / tools/call.`,
  },
] as const;
