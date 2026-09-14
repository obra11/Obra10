/** Mapa curado do Obra 10 — a Luna usa isto para tirar dúvida de uso, sem chutar tela. */

export const AJUDA_OBRA10 = `
# Mapa do Obra 10 (como usar o programa)

Você é a assessora do sistema. Oriente o caminho na tela. Não invente botão que não existe.
Módulos como FVS, estoque, planejamento, segurança etc. só existem se o plano da empresa contratou e se a tela já estiver no ar. Se não houver tela, diga isso com clareza.

## Onde cada coisa fica

- **Suas obras (início):** /dashboard — lista os canteiros. No topo: Relatórios, Cadastro Base, Equipe (se gestor), Meu Plano, Suporte, Perfil.
- **Relatórios de todas as obras:** /relatorios — lista cronológica dos diários. Clique abre o RDO daquela obra.
- **Dentro de uma obra:** /obras/:obraId/dashboard (Painel Geral), /rdos (lista), /rdos/novo (criar), /rdos/:id (abrir), /rdos/dashboard (gráficos), /efetivo, /configuracoes.
- **Cadastro Base (catálogo da empresa):** /catalogo — materiais, equipamentos e mão de obra padronizados.
- **Equipe:** /gestor/usuarios
- **Plano / cobranças:** /assinatura
- **Perfil:** /perfil
- **Suporte:** /suporte (FAQ + chamados)

## Diário de obra (RDO)

1. Entre na obra → Diários / RDOs → Novo.
2. Escolha **Relatório do dia** (uma data, clima manhã/tarde/noite) ou **Relatório de período** (data início e fim, informe quantos dias choveu).
3. As 10 seções abrem **recolhidas**. Expanda o que for preencher, ou use Expandir todos.
4. Seções: 1 Informações gerais, 2 Clima, 3 Presentes na vistoria, 4 Efetivo, 5 Materiais e equipamentos, 6 Atividades executadas, 7 Observações, 8 Pendentes, 9 Mídias e anexos, 10 Validação.
5. Rascunho salva sozinho. **Submeter** manda para aprovação. Quem tem permissão **Aprovar** / **Reprovar** na seção 10.
6. PDF: na barra do RDO, baixar sem fotos ou **com fotos** (fotos JPEG/PNG impressas 2 por página). Vídeo não entra no PDF, só como anexo.
7. Foto: até 15 MB. Vídeo/documento: até 100 MB.
8. Quem tem visão só de aprovados (VIEW_APPROVED) não vê rascunho nem submetido.

## Outras tarefas comuns

- **Trocar de obra:** volte a /dashboard e escolha outro canteiro. Dá para perguntar à Luna sobre outra obra pelo nome, mesmo estando em um canteiro.
- **Efetivo da obra:** /obras/:id/efetivo — colaboradores do canteiro (diferente do efetivo lançado no RDO do dia).
- **Importar catálogo:** Cadastro Base → Importar Excel/JSON.
- **Usuário sem acesso:** Equipe → conferir se está ativo, se tem o módulo RDO e se está vinculado à obra.
- **Luna:** balão vermelho no canto. Pergunte dados (chuva, efetivo, outro empreendimento) ou “como faço X no Obra 10”. Ela não cria nem aprova no seu lugar — ela orienta.

## MCP (ChatGPT, Claude, Gemini)

Endpoint remoto: POST https://obra10.app.br/mcp
Auth: Bearer obtido em POST /auth/token { email, senha }.
As mesmas consultas de leitura da Luna (obras, relatórios, catálogo, ajuda). Sem WhatsApp.
`.trim();

export function buscarAjuda(tema?: string): string {
  const t = String(tema || '').trim();
  if (!t) return AJUDA_OBRA10;
  const n = t.toLowerCase();
  const blocos = AJUDA_OBRA10.split('\n## ');
  const hit = blocos.filter((b) => b.toLowerCase().includes(n));
  if (hit.length) {
    return hit
      .map((b, i) => (b.startsWith('#') ? b : `## ${b}`))
      .join('\n\n');
  }
  return `${AJUDA_OBRA10}\n\n(Tema pedido: "${t}" — use o mapa acima e responda só o que existir.)`;
}
