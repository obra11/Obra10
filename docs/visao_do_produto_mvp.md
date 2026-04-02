# Obra 10: Visão do Produto e Escopo do MVP

## 1. Objetivo Principal
Centralizar e padronizar a gestão operacional das obras, conectando o canteiro (campo) ao escritório em tempo real. Eliminar o papel, garantir qualidade executiva, aumentar a segurança e fornecer dados precisos para decisões, evitando retrabalhos.

## 2. Perfis de Usuário e Permissões

*   **Diretor:** Visão executiva e puramente estratégica. Acessa painéis (dashboards) com indicadores de alto nível, avanço financeiro/físico e "saúde" de todas as obras da construtora. Não atua na operação diária e não tem obrigações de aprovação (apenas visualização de métricas consolidadas).
*   **Gerência (Gerente de Obra / Coordenador):** Gestão tática de um grupo de obras ou contrato. Foca em análises cruzadas (planejado vs. realizado), prazos globais, aprovações de exceções (se existirem alçadas) e acompanhamento ativo de desvios reportados pelos Engenheiros.
*   **Engenheiro(a) de Obra:** Gestão diária ("Dono da Obra"). Responsável técnico. Aprova RDOs, avalia e finaliza as FVS (liberando etapas executivas críticas), faz upload de novas revisões de Projetos e fecha/valida o lote diário de Concretagem.
*   **Técnico (Técnico de Edificações / Qualidade / Segurança):** Braço direito no campo voltado para a burocracia técnica. Inicia e preenche listas de inspeção (FVS), acompanha ensaios de concreto na betoneira, levanta apontamentos métricos para o RDO e reporta irregularidades. Suas ações geralmente necessitam da validação final do Engenheiro.
*   **Mestre de Obras / Encarregado:** Linha de frente da execução em campo. Foco total em reportar progresso sem atritos: preenche produtividade e clima no RDO, notifica recebimento de caminhões de concreto e visualiza a revisão mais recente dos Projetos. Não detém poder de aprovação ou mudança de status final.
*   **Inspetor (Qualidade Especializado):** Atua similar à camada Técnica, focado estritamente na validação de checklists de qualidade (FVS) visando redução de patologias tecnológicas.
*   **Administrador (Admin / TI):** Setup da base de dados. Cadastra as matrículas, permissionamentos, tipologias de FVS iniciais e parametrizações do Obra 10.

## 3. Módulos Essenciais (MVP) e Seus Fluxos

### 3.1. RDO (Relatório Diário de Obra)
*   **Fluxo:** Mestre/Técnico preenche o registro diário $\rightarrow$ Envia para Aprovação $\rightarrow$ Engenheiro aprova (ou devolve para ajuste).
*   **Status:** `Em Preenchimento` $\rightarrow$ `Aguardando Aprovação` $\rightarrow$ `Aprovado` $\rightarrow$ `Devolvido`.
*   **Gatilho do MVP:**  Após aprovado pelo Engenheiro e marcado como definitivo, o sistema gera instantaneamente o "Dia Corrente" puxando o clima base e o padrão de efetivo do dia bloqueado (evita que o Mestre cadastre as mesmas 30 pessoas manualmente no dia seguinte).

### 3.2. Projetos
*   **Fluxo:** Engenheiro anexa o PDF e marca como Vigente $\rightarrow$ Sistema notifica aparelhos móveis.
*   **Status:** `Vigente` (Verde, permitindo check em obra) ou `Obsoleto` (Vermelho restritivo).
*   **Gatilho do MVP:** Um projeto antigo não desaparece para efeito de auditoria, mas é bloqueado em campo de ser associado a novas inspeções.

### 3.3. FVS (Ficha de Verificação de Serviço)
*   **Fluxo:** Técnico/Inspetor inicia ficha, insere avaliação (Sim/Não/NA) com fotos locais $\rightarrow$ Envia $\rightarrow$ Engenheiro aplica o parecer técnico.
*   **Status:** `Em Inspeção` $\rightarrow$ `Aprovada` $\rightarrow$ `Aprovada c/ Ressalva` $\rightarrow$ `Reprovada`.

### 3.4. Controle de Concreto
*   **Fluxo:** Mestre/Técnico acusa chegada do caminhão (Lacres, Nota, Volume local de descarga e medidores ex: Slump test) $\rightarrow$ Engenheiro valida as saídas macro $\rightarrow$ Fica resguardado aguardando Laboratório em N+ dias para atestar Resistência.
*   **Status:** `Em Execução` $\rightarrow$ `Aguardando Laudo (CP)` $\rightarrow$ `Concluído - Aprovado`.

## 4. Conexões Inteligentes no Sistema (As integrações lógicas)
1.  **Projetos $\rightarrow$ FVS:** Obrigatoriedade de informar de onde saiu o parâmetro técnico auditado na FVS associando isso a uma Prancha de Projeto *Vigente*. Se o Mestre tentar usar "Prancha R00" sendo que "R01" existe, ele será impedido.
2.  **FVS $\rightarrow$ Concreto:** O Módulo do Concreto confere antes se o elemento "Laje de Cobertura" possui FVS de Armadura "Aprovada" para liberar preencher os romaneios da concreteira. *Permitido ao Engenheiro o Bypass com justificativa em caso de força maior.*
3.  **FVS e Concreto $\rightarrow$ RDO:** A síntese final. O RDO puxa que hoje *Ocorreram X concretagens aprovadas e Y requisições de FVS resolvidas*, minimizando ao extremo a necessidade de entrada de texto livre pelo Mestre de Obras.
