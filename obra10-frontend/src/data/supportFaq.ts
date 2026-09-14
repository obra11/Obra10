export type FaqItem = {
  id: string;
  pergunta: string;
  resposta: string;
  categoria?: string;
};

/** FAQ inicial — conteúdo versionado no código (fase 1). */
export const SUPPORT_FAQ: FaqItem[] = [
  {
    id: 'cadastro',
    pergunta: 'Como cadastro minha empresa e verifico o e-mail?',
    resposta:
      'No registro você informa os dados da empresa e do gestor. Em seguida, confirme o e-mail pelo link enviado. Sem verificação, algumas ações de cobrança e acesso podem ficar bloqueadas.',
    categoria: 'Conta',
  },
  {
    id: 'modulos',
    pergunta: 'Como contrato ou altero módulos do plano?',
    resposta:
      'Acesse Meu Plano / Assinatura. Lá você vê os módulos ativos, histórico de cobranças e pode iniciar um novo pagamento (PIX ou cartão, conforme disponível).',
    categoria: 'Billing',
  },
  {
    id: 'pix',
    pergunta: 'Paguei o PIX e os módulos não liberaram. O que faço?',
    resposta:
      'A confirmação é automática via webhook do gateway. Aguarde alguns minutos na tela de pagamento. Se continuar pendente, abra um chamado em Billing com o comprovante e o horário do pagamento.',
    categoria: 'Billing',
  },
  {
    id: 'rdo',
    pergunta: 'Como criar e aprovar um RDO (Diário de Obra)?',
    resposta:
      'Entre na obra → RDOs → Novo. Preencha atividades, efetivo e ocorrências. O fluxo de aprovação depende do seu perfil na obra. Em dúvida de permissão, peça ao GESTOR para revisar o papel do usuário.',
    categoria: 'Técnico',
  },
  {
    id: 'permissoes',
    pergunta: 'Um usuário não consegue ver uma obra ou módulo. Por quê?',
    resposta:
      'Verifique: (1) o usuário está ativo; (2) tem vínculo/papel na obra; (3) a empresa tem o módulo contratado; (4) o plano não está suspenso por inadimplência.',
    categoria: 'Conta',
  },
  {
    id: 'equipe',
    pergunta: 'Como adiciono usuários na equipe?',
    resposta:
      'GESTOR com permissão de gerenciar usuários pode ir em Equipe / Gestão de Usuários, respeitando o limite do plano. Se atingir o limite, é necessário upgrade em Meu Plano.',
    categoria: 'Conta',
  },
  {
    id: 'luna',
    pergunta: 'O que a Luna (assistente) consegue fazer?',
    resposta:
      'A Luna é a assessora do Obra 10: consulta todas as suas obras (não só a tela aberta), diários, painel, catálogo, equipe (se você gerencia) e explica como usar o sistema (criar RDO, PDF com fotos, Relatórios, etc.). Ela não cria nem aprova no seu lugar. Para cobrança, acesso ou bugs, use esta Central.',
    categoria: 'Técnico',
  },
  {
    id: 'mcp',
    pergunta: 'Como ligo o Obra 10 no ChatGPT, Claude ou Gemini?',
    resposta:
      'Use o MCP remoto: POST https://obra10.app.br/mcp com Authorization Bearer. Gere o token em POST /auth/token com o mesmo e-mail e senha do Obra 10 (válido 7 dias). No ChatGPT, ative o Developer Mode e adicione a URL do conector. A Luna no app já usa as mesmas consultas.',
    categoria: 'Técnico',
  },
  {
    id: 'senha',
    pergunta: 'Esqueci minha senha. Como recupero?',
    resposta:
      'Na tela de login use “Esqueci minha senha”. Você receberá um e-mail com link para redefinir. Também é possível alterar a senha em Meu Perfil quando estiver logado.',
    categoria: 'Conta',
  },
];

export const CHAMADO_CATEGORIAS = [
  { value: 'BILLING', label: 'Billing / Cobrança' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'CONTA', label: 'Conta / Acesso' },
  { value: 'OUTRO', label: 'Outro' },
] as const;
