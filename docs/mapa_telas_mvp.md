# Mapa de Telas e Navegação (Sitemap Frontend) - Obra 10 MVP

Este artefato detalha o fluxo de usuário, layout responsivo e os estados cruciais (como uso Offline) para guiar o desenvolvimento Front-end.

---

## 1 e 2. Detalhamento Exaustivo das Telas

### A. Autenticação e Setup
**1. Login**
*   **Objetivo:** Autenticação.
*   **Perfil/Device:** Todos (Web e Mobile).
*   **Ações:** Inserir credenciais, Resetar senha.
*   **Exibe:** Logo Obra 10, Form inputs.
*   **Navegação:** `Entrada` (Abertura do app) $\rightarrow$ `Saída` (Seleção de Obra).

**2. Seleção de Obra**
*   **Objetivo:** Definir o contexto da sessão (obra_id).
*   **Perfil/Device:** Todos.
*   **Ações:** Buscar nomes, Selecionar o Card da Obra.
*   **Exibe:** Grid com fotos e nomes das obras vinculadas ao usuário.
*   **Navegação:** `Entrada` (Após Login) $\rightarrow$ `Saída` (Dashboard).

### B. Visão Geral
**3. Dashboard**
*   **Objetivo:** Resumo e ponto de partida.
*   **Perfil/Device:** Eng/Diretor (Desktop) | Mestre (Mobile).
*   **Ações:** Ver gráficos, Tocar nos atalhos (RDOs pendentes).
*   **Exibe:** Gráficos (Desktop) / Cards de Acesso Rápido (Mobile).
*   **Navegação:** `Entrada` (Seleção de Obra) $\rightarrow$ `Saída` (Qualquer módulo).

### C. Módulo RDO
**4. Lista de RDO**
*   **Objetivo:** Histórico de apontamentos.
*   **Perfil/Device:** Todos (Mobile/Desktop).
*   **Ações:** Filtrar data, Criar Novo [+].
*   **Exibe:** Lista de RDOs com ícones de status (Aprovado/Pendente).
*   **Navegação:** `Entrada` (Menu principal) $\rightarrow$ `Saída` (Criação ou Detalhe do RDO).

**5. Criação/Edição de RDO**
*   **Objetivo:** Apontar o dia da obra.
*   **Perfil/Device:** Mestre/Técnico (Mobile).
*   **Ações:** Seleção de clima (Chips), Input de Efetivo, Adicionar Atividades, Bater Fotos.
*   **Exibe:** Formulário fluido / seções expansíveis.
*   **Navegação:** `Entrada` (Lista de RDO $\rightarrow$ FAB) $\rightarrow$ `Saída` (Volta à Lista após 'Salvar').

**6. Detalhe / Aprovação de RDO**
*   **Objetivo:** Engenheiro validar o apontamento.
*   **Perfil/Device:** Engenheiro (Desktop).
*   **Ações:** Botões grandes: Aprovar, Devolver, Editar.
*   **Exibe:** Resumo read-only de equipe, atividades e fotos explodidas.
*   **Navegação:** `Entrada` (Lista RDO) $\rightarrow$ `Saída` (Mesma tela / Próximo da lista).

### D. Módulo FVS
**7. Lista de FVS**
*   **Objetivo:** Visão de qualidade.
*   **Perfil/Device:** Todos.
*   **Ações:** Filtrar Status, Buscar por 'Pilar' (Local).
*   **Exibe:** Lista com cores (Verde/Amarelo/Vermelho).
*   **Navegação:** `Entrada` (Menu Nav) $\rightarrow$ `Saída` (Execução ou Detalhe).

**8. Execução de Checklist FVS**
*   **Objetivo:** Fiscalização tática.
*   **Perfil/Device:** Inspetor/Mestre (Mobile).
*   **Ações:** Marcar Sim/Não/NA. Tirar foto (Obrigatória se NÃO).
*   **Exibe:** Cabeçalho do FVS, Lista de Itens gigntes tipo Card.
*   **Navegação:** `Entrada` (Lista FVS $\rightarrow$ FAB) $\rightarrow$ `Saída` (Lista FVS).

**9. Detalhe / Aprovação FVS**
*   **Objetivo:** Parecer final.
*   **Perfil/Device:** Engenheiro (Desktop).
*   **Ações:** Aprovar ou Reter.
*   **Exibe:** Timeline de horários de preenchimento, fotos da não conformidade.
*   **Navegação:** `Entrada` (Lista FVS) $\rightarrow$ `Saída` (Volta à Lista).

### E. Módulo Projetos
**10. Lista de Projetos**
*   **Objetivo:** Repositório.
*   **Perfil/Device:** Todos. Desktop (Manager) adiciona; Mobile (Field) visualiza.
*   **Ações:** Upload (Desktop), Buscar por nome, Clicar para ler.
*   **Exibe:** Cards de PDF com Tag gigante [VIGENTE]/[OBSOLETO].
*   **Navegação:** `Entrada` (Menu Nav) $\rightarrow$ `Saída` (Visualizador).

**11. Visualizador PDF**
*   **Objetivo:** Leitura sem sair do app.
*   **Perfil/Device:** Mobile (Field).
*   **Ações:** Pinch-to-zoom, Pan, Visualizar.
*   **Exibe:** Apenas a prancha em Fullscreen.
*   **Navegação:** `Entrada` (Lista de Projetos) $\rightarrow$ `Saída` (Botão nativo Voltar $\leftarrow$).

### F. Módulo Concreto
**12. Lista de Concreto**
*   **Objetivo:** Log de Romaneios.
*   **Perfil/Device:** Todos.
*   **Ações:** Filtrar Data. Clicar para expandir.
*   **Exibe:** Resumos da concretagem e fck.

**13. Lançamento de Concreto**
*   **Objetivo:** Rapidez na descarga da betoneira.
*   **Perfil/Device:** Mestre (Mobile).
*   **Ações:** Tirar Foto da Nota, Digitar Volume e Slump.
*   **Exibe:** Formulário ultracurto (2 campos).
*   **Navegação:** `Entrada` (FAB Concreto) $\rightarrow$ `Saída` (Volta à Lista).

### G. Transversais
**14. Visualização de Anexos / Mídias**
*   **Objetivo:** Expandir fotos/vídeos.
*   **Perfil/Device:** Todos.
*   **Ações:** Dar Zoom em fotos, Play no MP4, Botão de Download.
*   **Exibe:** Modal escuro (Lightbox) com a foto centralizada.
*   **Navegação:** Sobrepõe qualquer tela. Clicar no `X` fecha o modal.

---

## 3. Conceitos Universais de Navegação

*   **Troca de Obra Ativa:**
    *   Fica no *AppBar* (Topo). Um nome da obra com uma "Seta para baixo" (Chevron). Clicando, abre um modal para trocar de obra sem precisar fazer Logoff.
*   **Topologia Mobile:**
    *   **Bottom Navigation Bar (Navegação Inferior):** Fixa. Ícones: `[Início, RDO, FVS, Projetos]`.
    *   **FAB (Floating Action Button):** Centro da tela inferior. O `[+]` universal que abre a folha de opções (Criações).
*   **Topologia Desktop:**
    *   **Sidebar (Navegação Lateral Fixa):** Aproveita monitores Widescreen com ícones + texto explícito.
    *   **Split Screen (Visualização Mestra-Detalhe):** Lista mestre lado esquerdo $\rightarrow$ Selecionado renderiza os detalhes e botões de aprovação do lado direito.
*   **Filtros e Buscas:**
    *   Filtros sempre em Drawer (Janela lateral direita que puxa) ou Chips logo acima das listas ("Últimos 7 dias", "Reprovados").

---

## 4. O Cenário Real do Canteiro de Obra (UX de Estado)

Padrões Críticos exigidos na Programação:
1.  **Loading (Carregamento):** *Obrigatório* o uso de "Skeleton / Shimmer load". Evite a tela branca com uma rodinha no meio, isso frustra psicologicamente o tempo do usuário.
2.  **States Vazios:** Um Card desenhado com "Você não tem RDO hoje. Criar agora". Nunca mostrar tabelas vazias soltas.
3.  **Upload Em Andamento / Falha:** Se falhar (Mobile perde sinal subindo imagem pesada), o Card fica listrado de amarelo, e exibe o botão `[ 🔄 Tentar Novamente ]`. Não destrói os dados digitados na tela.

---

## 5. Política do "Offline" - Veredito do MVP

*Aviso de Arquiteto:* Construir sincronização offline total (PouchDB + CouchDB ou CRDTs) onde múltiplos aparelhos sem internet editam ao mesmo tempo e "sincronizam magicamente" depois, adicionaria 3 a 5 meses de escopo ao MVP.

**Solução Pragmática e Realista (Offline Parcial do MVP):**
*   **Leitura (Módulo Projetos/Lista):** Somente lê o que está no celular (Cache Automático via *React Query / SWR*). Se apertar F5 sem 3G, não quebra a tela, apenas mostra banner "Você está offline. Exibindo últimos resultados".
*   **Criação (O Rascunho Local Simples):**
    *   O App Mobile terá a função de *"Salvar Rascunho"* em memória local do aparelho (LocalStorage/IndexedDB).
    *   Se o usuário bater fotos do RDO na garagem sem internet, ele **consegue preencher tudo e clicar em Salvar Rascunho**. O RDO fica com ele.
    *   *O Gatilho Final:* O Botão `[Enviar para o Engenheiro]` fica estritamente bloqueado (Cinza) caso não haja internet.
    *   Assim que ele sobe na rua (Bate Wi-Fi 4G), um *Snackbar Verde* aparece: "Conexão Restabelecida". O botão habilitará. O usuário finaliza o envio e o servidor assimila com perfeição, sem nenhum conflito de Sincronização complexa rodando em background.
