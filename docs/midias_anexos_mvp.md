# Gestão de Mídias e Documentos (MVP) - Módulo RDO

Para que usuários de campo usem o sistema e não o WhatsApp, a experiência multimídia deve ser nativa e fluida.

---

## 1 e 2. A Estrutura de Dados (Tabela de Anexos Genérica)

A melhor arquitetura não é criar colunas "foto_1", "video_1" no RDO, nem uma tabela específica "rdo_fotos". Usaremos a tabela polimórfica **`anexos`** (já idealizada no banco de dados geral), que servirá ao RDO, FVS e Projetos, centralizando todo fluxo de arquivos do backend.

**Tabela: `anexos`**
*   **Identificação:** `id` (uuid - PK).
*   **Vínculo Mãe:** `obra_id` (FK Obrigatória - permite consultar toda galeria do canteiro rápido).
*   **Vínculo de Origem (Polimórfico):**
    *   `attachable_type`: String (Ex: 'rdo_cabecalho', 'rdo_atividade').
    *   `attachable_id`: ID numérico/uuid do registro da atividade que recebeu a foto.
*   **Auditoria de Envio:** `usuario_id` (FK - Quem disparou o upload do celular) e `created_at` (Data do upload).
*   **Metadados do Arquivo:**
    *   `tipo_arquivo`: Enum lógico (`FOTO`, `VIDEO`, `DOCUMENTO`).
    *   `mime_type`: String técnica no banco (ex: `image/jpeg`, `video/mp4`, `application/pdf`).
    *   `tamanho_bytes`: Integer.
    *   `url_s3`: Path ou URL original do bucket.
*   **Controle de Acesso (Segurança API):** A API só entrega o JSON contendo os URLs desta tabela se o Token de quem pediu tiver vínculo com a `obra_id`. Além disso, o URL original (`s3://bucket...`) é convertido dinamicamente pelo Backend em **Signed URLs** com validade curta (ex: 1 hora) para evitar que o link seja vazado em grupos externos.

---

## 3. Regras Práticas para o MVP (Prevenindo abusos técnicos)

O canteiro tem internet ruim (3G/4G instável) e o servidor (AWS/GCP) cobra por armazenamento. Logo, limites severos são necessários.

*   **Tipos Permitidos:**
    *   Fotos: `.jpg`, `.jpeg`, `.png`, `.webp`.
    *   Vídeos: `.mp4`, `.mov` (Codecs H.264 obrigatórios nativos de iOS/Android).
    *   Documentos: **Apenas `.pdf` no MVP**. (Proibir Word/Excel e forçar a pessoa do escritório a "Salvar como PDF" antes de mandar pro Mestre. Isso garante visualização nativa sem depender de download do pacote Office).
*   **Limites de Tamanho Máximo (Hard Limits API):**
    *   Fotos: **5 MB** (Atenção: O App / PWA **deve** fazer compressão da imagem e resize local \`Canvas/Web API\` para uns 800px no celular ANTES de gastar tempo fazendo upload).
    *   Documentos: **15 MB**.
    *   Vídeos: **50 MB** (Equivale a vídeos rápidos de 30 a 60 segundos com qualidade média WhatsApp).
*   **Límites de Quantidade por RDO:**
    *   Evita o "efeito rolo de câmera" (onde o Mestre joga 40 fotos não selecionadas).
    *   **Por dia/RDO:** Limite de **10 fotos**, **2 vídeos curtos** e **3 documentos**. Força curadoria visual.

---

## 4. Como Funcionará a Visualização Interna (Navegador/App)

*   **Fotos (Thumbnails e Lightbox):** A listagem de atividades do RDO mostra miniaturas (*thumbnails*) quadradas. Ao clicar, a tela escurece e abre um Modal Nativo/Lightbox permitindo passar para o lado as galerias de fotos do RDO, com zoom via toque.
*   **Vídeos (Player Nativo HTML5):** Como padronizamos para `mp4`, usamos a tag nativa HTML `<video controls width="100%">`. O celular ou desktop processa perfeitamente.
*   **Documentos / PDFs:** Se for acesso Web Desktop, um simples `<iframe src="url_assinada.pdf">` renderiza o PDF internamente sem sair do Obra 10. Em Tablets e Smartphones, forçar iframe às vezes gera bugs de rolagem (iOS), portanto, a UI do Mobile exibe o Card do PDF com um botão grande *"Abrir Visualizador"* nativo do Android/iOS.
*   **Botão de Download Externo:** Todos os cards de anexo terão um menu de "... " com a opção de forçar o download local (caso o Engenheiro precise mandar ao dono da obra).

---

## 5. MVP x Fim da Linha (V2)

**Essencial para o MVP (Foco em Entrega Rápida):**
1. Compressão local de fotos no App Móvel (salva o 4G da obra).
2. Arquitetura *Direct Upload* c/ Presigned URL (O celular faz upload direto pro Bucket S3 da Amazon. O backend Node/Python não deve processar os bytes gigantes do vídeo, ele apenas assina o passe livre temporal para o front-end mandar ao bucket).
3. Restrição extrema a vídeos MP4 e PDF apenas. HTML5 puro para ler vídeos.

**O que fica para Fase Futura (Removido do MVP para reduzir custo e tempo):**
1. *Transcoding de Vídeo:* Se no futuro vídeos passarem de 5 min (visitas técnicas inteiras), teremos que implementar *AWS MediaConvert* para fatiar o vídeo em formato ".m3u8" (HLS Streaming estilo Netflix/YouTube) para não travar a internet do escritório e criar resoluções 480p/720p automáticas.
2. Anotação na Imagem: Permitir rabiscar de caneta vermelha em cima da foto do RDO para destacar um cano furado.
3. Conversão de Documentos em Tempo Real: Permitir subir DWG, DOCX ou XLSX e usar bibliotecas caras na nuvem que transformam magicamente para PDF dentro do sistema.
4. Auto-Tagging IA: A Inteligência Artificial ler a foto do pilar sujo e já sugerir o texto "Limpeza não conformada".
