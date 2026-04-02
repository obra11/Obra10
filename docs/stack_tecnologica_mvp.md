# Stack Tecnológica Oficial - Obra 10 (MVP)

A engenharia civil exige software que não dependa de hardware caro (computadores corporativos potentes ou celulares iPhone de última geração). A arquitetura técnica a seguir foca na estabilidade, performance em 4G ruim e alta velocidade de desenvolvimento (Time to Market).

---

## 1. Stack Principal Recomendada (O "Sweet Spot")

A combinação abaixo foca em usar 100% **TypeScript**, permitindo que, se necessário, o mesmo desenvolvedor atue da interface (Mestre) ao banco de dados (Infra).

*   **Front-end:** Next.js (React) + Tailwind CSS + PWA (Progressive Web App).
*   **Back-end:** Node.js (via Express ou NestJS) + Prisma ORM.
*   **Banco de Dados:** PostgreSQL.
*   **Storage de Arquivos:** AWS S3 (Bucket).
*   **Autenticação:** JWT Custom puro (Simples/Barato) ou Supabase Auth/Firebase (Segurança terceirizada).
*   **Hospedagem (MVP):** Vercel (Frontend) + Render ou Railway (Backend Node) + Supabase/Neon DB (Postgres Gerenciado). *(Custo de setup praticamente zero, escala por demanda)*.

### 2. Por que esta é a Stack Ideal para o Obra 10?
1.  **PWA (Progressive Web App):** A grande tacada do MVP. Você não precisa passar pela dor de cabeça e demora de 15 dias da validação da *Apple Store / Google Play*. O usuário acessa a URL no navegador do celular, clica em "Adicionar à Tela de Início" e ele vira um app nativo, suportando Câmera e Armazenamento Local.
2.  **Mesma Linguagem (TypeScript):** Front e Back falam a mesma língua. As tipagens (ex: `LoteConcreto`) criadas numa pasta podem ser importadas tanto pelo App quanto pela API, zerando erros de mapeamento de dados.
3.  **Prisma ORM:** Nosso modelo tem tabelas relacionais complexas (A pivô `user_obra_role` para segurança). O Prisma gera os relacionamentos SQL de forma fácil e segura.
4.  **Upload S3 Direto do PWA:** O back-end em Node é leve demais; ele nunca baixa o arquivo pesado de vídeo do canteiro. Ele só emite uma "Pre-signed URL" da AWS pro celular, e o *Front-end manda os bytes brutos do vídeo direto para o servidor da Amazon*.

---

## 3. Stack Alternativa: "Ultra-Fast & Baixo Custo" (Validação Expressa)

Se o foco da construtora for lançar em **4 a 6 semanas** com o menor orçamento de engenharia possível, usamos o poder dos BaaS (Backend as a Service).

*   **Front-end:** Vite + React (SPA Padrão App).
*   **Back-end + Auth + Storage + BD:** Supabase.
*   *Vantagem:* Você elimina a necessidade de construir ou hospedar uma API Node.js. O Supabase expõe seu banco PostgreSQL direto pro Front-end via conectores seguros. A regra de quem pode ver a Obra ("user_obra_role") é programada direto em SQL (Row Level Security - RLS).
*   *Desvantagem:* Certo nível de "Vendor Lock-in". Fica mais engessado se quiser criar automações muito mirabolantes de fundo.

---

## 4. Stack Alternativa: "Enterprise / Construtora Gigante" (V3 / Crescimento Futuro)

Se o Obra 10 crescer para operar 500 canteiros de grandes incorporadoras ao mesmo tempo, a stack ideal migra das teias web para o ecossistema robusto.

*   **Mobilidade Nativa:** Flutter (Dart). PWA é bom, mas se a obra precisar de um "Offline Completo" (baixar as plantas pesadas por inteiro para o HD do celular antes da escavação começar + banco de dados em SQLite nativo do celular), o Flutter entrega performance gráfica (C++) insuperável no Android/iOS nativo.
*   **Back-end:** C# (.NET) ou Java Spring Boot. Excelente para cálculo massivo empresarial e relatórios de BI multi-threading das finanças corporativas das obras.
*   **Infraestrutura:** Nuvem controlada via Terraform, EKS (Kubernetes na Amazon AWS para não cair mesmo com 10.000 peões acessando no mesmo horário do almoço).

---

## 5. Arquitetura Funcional das Tarefas Específicas do Obra 10

### A. Integração com Câmera e Fotos
O PWA com HTML5 invoca a câmera e a galeria do celular de forma 100% nativa sem usar pacotes perigosos.
*   **O Segredo (Código):** O botão usa a tag especial `<input type="file" accept="image/*,video/*" capture="environment" />`. O "Environment" obriga o celular a abrir direto a lente traseira da câmera do Mestre, cortando cliques.
*   **Compressão Client-Side:** Antes de bater na AWS S3, a biblioteca JavaScript \`browser-image-compression\` espreme a foto de 10MB do iPhone atual para 500kb no próprio navegador do usuário, economizando meses de custo em nuvem.

### B. Visualização de PDFs e Mídias
*   Desktop exibe PDFS usando `<embed>` ou `<object>` padrão. Se o Tablet (ex: Safari no iPad) bloquear nativamente a "rolagem" (Scroll) de iframes longos de plantas estruturais, o plano alternativo (Fall-back) da Stack usará bibliotecas baseadas na Mozilla como a `react-pdf` que converte a página em uma Imagem Canvas garantindo renderização idêntica do projeto em qualquer pedaço de vidro.

### C. Rascunho Local no PWA (Browser-based)
Como criar Rascunhos de RDO sem internet?
*   Os formulários em React usarão integração com \`IndexedDB\` (pelo encapsulador padrão, tipo a biblioteca `localforage`, ou integrando direto no Cache API).
*   O objeto JSON que seria enviado na API (`{ atividades: [], clima: '' }`) fica salvo ativamente na memória local do Chrome/Safari a cada caractere digitado.
*   Caiu a conexão? Não perde nada. Quando der *"Status=200 OK"* a API avisa, a tela dá Check e limpa o lixo local.

### D. Controle Restritivo de Acesso por Obra (O Check de API Genérico)
Ao usar Node.js ou Supabase, o modelo JWT (Json Web Token) enviado pelo Front ao Back-end de cada requisição já carregará silenciosamente a lista de `Obras_Permitidas: [X, Y]`.
Um "Middleware Genérico" global do back-end vai interceptar toda que requisição, ex: `POST /api/rdo`. Ele checa imediatamente: "Qual obra_id o malandro Front está tentando apontar? Obra 3? Essa obra_id 3 está no Array de permissões do Token? Não? Retorna Erro de Autenticação". Isso cimenta o sistema contra vazamento entre empreiteiras terceirizadas diferentes usando o Obra 10.
