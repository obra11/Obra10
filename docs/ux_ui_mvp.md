# User Experience (UX) e UI - Obra 10 (MVP)

A adoção do sistema no canteiro de obras depende unicamente da usabilidade. O Mestre de Obras tem dedos grossos, sol batendo na tela e pressa. O Engenheiro tem dezenas de e-mails para ler. A UX precisa ser extrema.

---

## 1. O Fluxo de Navegação (Jornada do Usuário)

Todos os perfis compartilham a mesma espinha dorsal de navegação, mas os botões disponíveis mudam:
1.  **Login Dinâmico:** Se for Mestre (mobile), apenas \`CPF e PIN de 4 dígitos\` num teclado numérico grande (estilo banco). Se for Engenheiro (web), Email e Senha.
2.  **Seleção de Obra:** O usuário entra numa tela com "Cards" grandes contendo a foto das obras onde ele atua. Ao clicar, o sistema injeta a `obra_id` no contexto geral do app.
3.  **Home / Área de Trabalho:**
    *   *Mobile (Mestre):* Tela focada em AÇÃO. Quatro botões quadrados grandes (RDO, Qualidade, Projetos, Concreto). E um sino de notificações de Projetos novos.
    *   *Desktop (Eng.):* Tela focada em FILA DE ESPERA. "Você tem 2 RDOs para aprovar hoje e 1 FVS aguardando liberação".
4.  **Botão Central (O Coração Mobile):** Um Floating Action Button (FAB) `[+]` fixo na barra inferior do celular. Clicou nele, sobe o menu: `[Tirar Foto para RDO]`, `[Registrar Caminhão de Concreto]`, `[Iniciar Checklist]`.

---

## 2. Telas Principais por Perfil (Design System)

*   **Mestre / Inspetor (App Mobile First):**
    *   **Padrão Dark/High Contrast:** Útil para ver a tela sob a luz do sol de meio dia na laje.
    *   **Inputs:** Trocar caixas de digitação (`<input type="text">`) por Chips clicáveis e Botões `[-] Número [+]` sempre que possível.
*   **Engenheiro (Desktop WebView / Tablet Horizontal):**
    *   **Padrão Split-Screen:** Lado esquerdo lista todos os RDOs recebidos. Clicando em um, o RDO abre do lado direito (igual email do Outlook). Perfeito para aprovação em massa.
*   **Diretor / Viewer (Dashboard Web):**
    *   Apenas cards de métricas (Gráficos em Pizza de FVS Aprovada vs Reprovada, Status Financeiro). Ausência total de botões de edição.

---

## 3. O Módulo RDO (A rotina de matar Leões)

**O Fluxo do Mestre (Fim do dia):**
1.  **Condições Climáticas em 1 clique:** Ao invés de escrever "Choveu de tarde", 4 ícones gigantes (Sol, Nublado, Chuva Fina, Tempestade) para a Manhã e 4 para Tarde. O Mestre toca neles.
2.  **Efetivo (Anti-Digitação):** O sistema já preenche a equipe do dia anterior. Se hoje entraram mais 2 pedreiros, ele clica duas vezes no botão `[+]` na linha dos pedreiros. Zero digitação de teclado da tela inteligente.
3.  **Atividades e Fotos Integradas:** Clica no botão `[Nova Atividade]`. O App abre a câmera na hora. O mestre tira 2 fotos da laje. O App pede um áudio ou poucas palavras: *"Concretagem da laje finalizada"*.
4.  **O "Envio Blindado":** Botão gigante verde `[Enviar para o Engenheiro]`. Ao clicar, uma tela de confirmação ("Este RDO não poderá mais ser editado"). Se ele dar "Sim", as fotos sobem comprimidas pro S3 em background via PWA/App nativo.

---

## 4. O Módulo FVS (Caminho da Qualidade)

*   **O Checklist de Ouro:** Tela contendo a lista rolável das perguntas. Na frente de cada item, as bolinhas virtuais: `[✓ SIM]` `[X NÃO]` `[- N/A]`.
*   **Fluxo Anti-Falha (UX):** Se o Inspetor clicar no `[X NÃO]` (Ex: A forma não está limpa?), o celular **obriga** a abertura da câmera. Ele tira a foto da sujeira. Sem a foto, o App não deixa prosseguir para o próximo item do checklist. Isso garante a prova para dar ordem de reparo.
*   **O Histórico em Timeline:** Para o Engenheiro, a FVS aparece não como tabela morta, mas como uma linha do tempo vertical (Instagram-style): *10:00 - FVS Aberta | 10:15 - Item X Reprovado (Ver Foto) | 16:00 - Reparo efetuado (Nova Foto) | 16:30 - Eng Aprovou*.

---

## 5. Módulo de Projetos (Sem desculpas que não viu a planta)

*   **Lista de Documentos:** Formato Card tipo Netflix. Apenas Capa (A miniatura do PDF renderizada). Escrito gigante *"Projeto Estrutural Revisão 02"*.
*   **O Selo de Vida:** Uma tarja diagional `VERDE (Vigente)` nos projetos atuais. Projetos obsoletos ficam ocultos numa pasta separada escrita *"ARQUIVO MORTO"*, e se ele abrir, tem um carimbo d'água vermelho enorme em cima de toda planta *"OBSOLETO - NÃO CONSTRUIR"*.
*   **Visualização Nativa:** Pinça para dar zoom (*Pinch-to-zoom*) é mandatória. Navegação arrastando com 1 dedo.

---

## 6. Controle de Concreto (Lançamento a Jato)

A betoneira não para, o tempo ruge. O fluxo precisa secar em 3 passos:
1.  **Entrada:** Clica em `[+ Chegou Betoneira]`.
2.  **Documento e Volumes:** A câmera abre e obriga a focar a Nota Fiscal ou Ticket do Lacre. A foto e salva OCR no futuro. Ele digita os números grandes na tela: *Volume (ex. 8,0)* e o *Slump test (ex. 12)*.
3.  **Local:** Dropdown gigante (que ele digita 'Pilar' e já filtra 'Pilar 1 a 10'). Fecha e manda o sinal.

---

## 7. Melhores Práticas de Canteiro (Regras Intransponíveis do App)

1.  **Touch Targets de Titan:** Todos os botões interagíveis DEVEM ter no mínimo 48 x 48 pixels físicos (CSS padronizado). O encarregado estará usando luvas muitas vezes.
2.  **Cores como Feedback:** Status de RDO e Projetos não devem depender de ler a palavra. RDO Aprovado = Ícone Verde. Rascunho = Cinza. Devolvido (com erro) = Fogo/Vermelho vibrante. O reconhecimento é 80% visual.
3.  **Offline Tolerance:** Como a internet da garagem no subsolo (obra em fundação) não pega nada, o App registra as FVS ou Fotos `Em Cache`. Assim que ele subir para a rua e pegar 3G, o ícone de nuvem sincroniza em background. A UX de "Tentando conectar" que bloqueia a tela é proibida.
