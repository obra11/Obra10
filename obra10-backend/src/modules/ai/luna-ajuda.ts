/** Mapa curado do Obra 10 — a Luna usa isto para tirar dúvida de uso, sem chutar tela. */

export const AJUDA_OBRA10 = `
# Mapa do Obra 10 (como usar o programa)

Você é a assessora do sistema. Oriente o caminho na tela. Não invente botão que não existe.
Módulos como FVS, estoque, planejamento, segurança etc. só existem se o plano da empresa contratou e se a tela já estiver no ar. Se não houver tela, diga isso com clareza.

## Onde cada coisa fica

- **Suas obras (início):** /dashboard — cards dos canteiros. No topo: Relatórios, Cadastro Base, Equipe (se gestor), Meu Plano, Suporte, Perfil.
- **Relatórios de todas as obras:** /relatorios — lista cronológica dos diários da empresa. Clique no item para abrir o RDO daquela obra. Use este caminho se perguntarem “como vejo os diários de todas as obras”.
- **Dentro de uma obra:** /obras/:obraId/dashboard (Painel Geral), /rdos (lista), /rdos/novo (criar), /rdos/:id (abrir), /rdos/dashboard (gráficos), /efetivo, /visualizador, /configuracoes.
- **Cadastro Base (catálogo da empresa):** /catalogo — materiais, equipamentos e mão de obra padronizados. Importar Excel/JSON no próprio cadastro.
- **Equipe:** /gestor/usuarios — só quem gerencia usuários.
- **Plano / cobranças:** /assinatura (também /gestor/financeiro para o gestor).
- **Perfil:** /perfil — foto, senha, tipo de usuário e permissões (somente leitura).
- **Suporte:** /suporte — FAQ, chamados e como ligar ChatGPT/Claude/Gemini (MCP).
- **Visualizador de projetos:** /obras/:obraId/visualizador — DWG/PDF/IFC se o módulo estiver no plano. Se a tela não abrir, o módulo não está contratado ou ainda não está no ar.

## Diário de obra (RDO)

1. No /dashboard escolha a obra → menu Diários / RDOs → **Novo** (ou /obras/:obraId/rdos/novo).
2. Escolha **Relatório do dia** (uma data; clima manhã/tarde/noite) ou **Relatório de período** (data início e fim; informe quantos dias choveu).
3. As 10 seções abrem **recolhidas**. Expanda o que for preencher, ou use Expandir todos.
4. Seções: 1 Informações gerais, 2 Clima, 3 Presentes na vistoria, 4 Efetivo, 5 Materiais e equipamentos, 6 Atividades executadas, 7 Observações, 8 Pendentes, 9 Mídias e anexos, 10 Validação.
5. Rascunho salva sozinho. **Submeter** (seção 10) manda para aprovação. Quem tem permissão **Aprovar** / **Reprovar** na seção 10.
6. PDF: na barra do RDO aberto, baixar sem fotos ou **com fotos** (fotos JPEG/PNG impressas 2 por página). Vídeo não entra no PDF, só como anexo.
7. Foto: até 15 MB. Vídeo/documento: até 100 MB.
8. Quem tem visão só de aprovados (VIEW_APPROVED) não vê rascunho nem submetido — nem pela Luna.

## Outras tarefas comuns

- **Trocar de obra:** volte a /dashboard e escolha outro canteiro. Dá para perguntar à Luna sobre outra obra pelo nome, mesmo estando em um canteiro.
- **Efetivo da obra:** /obras/:id/efetivo — colaboradores do canteiro (diferente do efetivo lançado no RDO do dia).
- **Importar catálogo:** Cadastro Base → Importar Excel/JSON.
- **Usuário sem acesso:** Equipe → conferir se está ativo, se tem o módulo RDO e se está vinculado à obra.
- **Luna:** balão vermelho no canto. Pergunte dados (chuva, efetivo, outro empreendimento) ou “como faço X no Obra 10”. Ela não cria nem aprova no seu lugar — ela orienta.

## MCP (ChatGPT, Claude, Gemini)

Endpoint remoto (Streamable HTTP): POST https://obra10.app.br/mcp
Token: POST https://obra10.app.br/auth/token com JSON { "email", "senha" } (e "empresaId" se o e-mail estiver em mais de uma empresa). Resposta: access_token Bearer, válido 7 dias. Tenant só do JWT — não envie empresa no MCP.
As mesmas consultas de leitura da Luna (obras, relatórios, catálogo, ajuda). Sem WhatsApp. Sem escrita. Sem perguntar_luna.

ChatGPT: ative o Developer Mode (Configurações → Apps / Conectores) e adicione a URL https://obra10.app.br/mcp com autenticação Bearer (cole o access_token). Se a tela só oferecer OAuth e recusar Bearer, use um Custom GPT com Action autenticada por API Key/Bearer, ou use Claude/Gemini/Codex.
Claude: Integrações / conector remoto com a mesma URL e header Authorization: Bearer. No Claude Desktop, mcpServers com "url" e headers.Authorization.
Gemini: conector MCP remoto (ou AI Studio) com a URL e o mesmo Bearer.
`.trim();

export function buscarAjuda(tema?: string): string {
  const t = String(tema || '').trim();
  if (!t) return AJUDA_OBRA10;
  const n = t.toLowerCase();
  const blocos = AJUDA_OBRA10.split('\n## ');
  const hit = blocos.filter((b) => b.toLowerCase().includes(n));
  if (hit.length) {
    return hit
      .map((b) => (b.startsWith('#') ? b : `## ${b}`))
      .join('\n\n');
  }
  return `${AJUDA_OBRA10}\n\n(Tema pedido: "${t}" — use o mapa acima e responda só o que existir.)`;
}
