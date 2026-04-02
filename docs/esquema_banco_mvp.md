# Modelagem Física de Dados - Obra 10 (MVP)

Abaixo o esquema físico e as regras sistêmicas orientadas à implementação do banco de dados.

---

## 1, 2 e 3. Detalhamento das Entidades

Todas as tabelas (*exceto* `empresa`, `usuario`, `perfil` e `audit_logs`) pertencem em última instância a **Obra**.
*Padrão de Tabelas:* Devem possuir `created_at`, `updated_at`, `deleted_at` (Uso de **Soft Delete** obrigatório no sistema), além de `created_by` e `updated_by` sempre que gerado por login.

### A. Core / Setup Automático
**1. empresa**
*   **Controle:** Nível Raiz (Tenant).
*   **Obrigatórios:** `id` (uuid), `razao_social`, `cnpj`.
*   **Opcionais:** N/A.
*   **Regras:** `cnpj` é UNIQUE. Controle de isolamento de dados total na API.

**2. obra**
*   **Controle:** Pertence à `empresa_id` (FK Obrigatória).
*   **Obrigatórios:** `id`, `nome`, `status_obra` (Ativa/Finalizada).
*   **Opcionais:** `endereco`, `cep`.

**3. usuario**
*   **Controle:** Pertence à `empresa_id` (FK Obrig.).
*   **Obrigatórios:** `id`, `nome`, `email`, `senha_hash`.
*   **Opcionais:** `telefone`.
*   **Regras:** `email` é UNIQUE por sistema. Soft Delete aplicável para não quebrar tabelas históricas (quem aprovou a FVS antiga não pode ser limpo do banco).

**4. perfil**
*   **Controle:** Tabela Estática do Banco (Semeada).
*   **Obrigatórios:** `id` (int: 1,2,3,4), `nome_interno` ('Viewer', 'Field', 'Manager', 'Admin').

**5. user_obra_role**
*   **Controle:** Tabela Pivô. Determina o acesso e poder numa Obra.
*   **FKs Obrigatórias:** `usuario_id`, `obra_id`, `perfil_id`.
*   **Regras:** Unicidade na trinca `(usuario_id + obra_id)`. Se o usuário "João" está na "Obra 1", ele só pode ter 1 perfil nessa obra.

### B. Módulo RDO (Normalizado em Master-Detail)
**6. rdo (Cabeçalho)**
*   **Controle:** Pertence à `obra_id` (FK Obrigatória).
*   **Obrigatórios:** `id`, `data_referencia`, `status`.
*   **Opcionais:** `clima_manha`, `clima_tarde`, `condicao_terreno`.
*   **Rastreio:** `created_by` (Quem abriu o RDO), `aprovado_by` (Engenheiro que assinou).
*   **Regras:** Unicidade da trinca `(obra_id + data_referencia + deleted_at NULL)`: Só existe um RDO aberto por dia, por obra.

**7. rdo_atividade**
*   **Controle:** FK `rdo_id` (Obrigatória).
*   **Obrigatórios:** `id`, `descricao`, `created_by` (Quem digitou aquela linha exata).
*   **Opcionais:** `frente_servico`.

**8. rdo_efetivo**
*   **Controle:** FK `rdo_id` (Obrigatória).
*   **Obrigatórios:** `id`, `empresa_terceira`, `funcao_cargo`, `quantidade`, `created_by`.

**9. rdo_ocorrencia**
*   **Controle:** FK `rdo_id` (Obrigatória).
*   **Obrigatórios:** `id`, `tipo_ocorrencia`, `descricao`, `created_by`.
*   **Opcionais:** `horas_perdidas`.

### C. Projetos e FVS
**10. projetos_documento**
*   **Controle:** Pertence à `obra_id` (FK Obrigatória).
*   **Obrigatórios:** `id`, `titulo`, `revisao`, `arquivo_url_s3`, `status` (Vigente/Obsoleto), `created_by`.
*   **Opcionais:** `disciplina`.

**11. fvs (Cabeçalho)**
*   **Controle:** Pertence à `obra_id` (FK Obrigatória).
*   **Obrigatórios:** `id`, `titulo_servico`, `local_aplicacao` (Ex: Pilar P5), `status`, `created_by`.
*   **Opcionais (Pivot):** `projeto_ferramenta_id` (FK para projetos_documento. Opcionallity explicada no Tópico 4) e `aprovador_by`.

**12. fvs_item (A resposta do checklist)**
*   **Controle:** FK `fvs_id` (Obrigatória).
*   **Obrigatórios:** `id`, `pergunta_texto`, `status_resposta` (Conforme, Não Conforme, N/A), `created_by`.
*   **Opcionais:** `observacao`.

### D. Controle de Concreto
**13. lote_concreto**
*   **Controle:** Pertence à `obra_id` (FK Obrigatória).
*   **Obrigatórios:** `id`, `nf_betoneira`, `volume_m3`, `data_despejo`, `status`, `created_by`.
*   **Opcionais:** `fvs_id` (FK de liberação), `fck_projeto`, `fck_realizado_28d`, `slump_test`, `aprovador_by`.

### E. Transversais
**14. anexos**
* *(Detalhado na Seção 6).*

**15. audit_logs**
* *(Detalhado na Seção 7).*

---

## 4. Relação FVS e Projetos (A Abordagem para o MVP)

Existem três opções para atrelar a FVS (o que se fiscaliza no campo) com o Projeto (o que diz como fazer):
1.  **Vínculo Obrigatório:** FVS exige a FK `projeto_id` populada.
    *   *Pró:* Máxima rastreabilidade. Impossível julgar baseado em obra física.
    *   *Contra:* Se o Engenheiro atrasar o upload ou a API cair, a obra paralisa 100%. Mestre desiste do app.
2.  **Vínculo Indireto (Texto Livre):** Cria-se um campo `projeto_usado_txt`.
    *   *Pró:* O Mestre sempre segue operando, apenas digita "Prancha A01 Física".
    *   *Contra:* Zero rastreabilidade lógica. Quando a Prancha A01 obsolecer, o sistema não cruza os dados.
3.  **A Melhor Abordagem (Vínculo Opcional Misto):**
    *   **A Recomendação para o MVP:** Adicionar no BD: `projeto_id` (FK Opcional) **E** `projeto_referencia_txt` (String Opcional).
    *   **Como funciona na UI:** Na tela de criar FVS, o app sugere num \`Select\` inteligente todas as pranchas \`Vigentes\`. Se o Mestre selecionar, sela o vínculo. Se ele não achar o projeto na lista, ele clica em "Não encontrei, inserir manualmente" e digita no campo \`projeto_referencia_txt\` e segue com a FVS. Isso não engessa o canteiro e educa o comportamento gradualmente.

## 5. Edição Compartilhada do RDO

Em campo, um Apontador insere o Efetivo e o Mestre tira fotos das Atividades, ao mesmo tempo no RDO do dia.
*   **Mais de um editor?** Sim, todos com Role `Field` podem editar um RDO aberto.
*   **Como evitar conflito?** Por estarmos no modelo de sub-tabelas, não há conflito. Quando o Mestre bate foto e escreve uma atividade, a API roda `INSERT INTO rdo_atividade`. Quando o Apontador insere os peões, roda `INSERT INTO rdo_efetivo`. As ações são isoladas no banco de dados, sem colisão de colunas. Campos do cabeçalho (Clima, Status) usam a tática "Last Write Wins".
*   **Como rastrear autoria?** Como detalhado no BD, toda tabela-filha (`rdo_atividade`, etc) possui seu próprio `created_by`. O sistema sabe linha por linha sob qual conta de usuário a digitação e a foto correram.
*   **Mudança de Status:** Ao mudar de \`Em Preenchimento\` para \`Aguardando Aprovação\`, a API recusa (Erro 403) qualquer tentativa de `INSERT/UPDATE/DELETE` nas tabelas do RDO se o perfil for apenas `Field`.

## 6. Modelo Mínimo de Anexos (Tabela `anexos`)

Para que você não triplique o banco com "foto_de_X", a tabela \`anexos\` usa Polimorfismo.
*   **Campos Obrigatórios:** `id(uuid)`, `obra_id(FK)`, `attachable_type` (Enum String ex: LOTE_CONCRETO, ITEM_FVS), `attachable_id` (ID-Pai), `url`, `content_type` (Ex: image/jpeg), `file_size_bytes`, `created_by`, `created_at`.
*   **Vínculo com a Obra:** Ter a redundância do `obra_id` na foto é estratégico para permitir a criação rápida de uma "Galeria da Obra" agnóstica de onde ela veio.
*   **Vínculo Origem:** O par (`attachable_type` + `attachable_id`) faz esse mapa.
*   **Segurança (Regra BD/Storage):** As URLs no banco nunca são diretas e puras. O sistema gera S3 Pre-Signed URLs que expiram. Se um URL vazar, um estranho não abre a foto.

## 7. Modelo Mínimo de Auditoria (`audit_logs`)

Registrar alterações triviais e correções ortográficas afogaria o banco no 2º mês. No MVP, a auditoria é seletiva para processos críticos:
*   **Campos da Tabela:** `id`, `empresa_id`, `obra_id`, `usuario_id`, `entidade` (String: RDO, FVS), `entidade_id`, `acao` (Ex: APROVAR, REABRIR, CANCELAR, DELETAR_ANEXO), `carga_antiga` (JSON), `carga_nova` (JSON), `created_at`.
*   **Ações Registradas no MVP:**
    *   Qualquer mudança de "Status" de RDO, Projetos, ou FVS (Quem enviou, quem aprovou).
    *   Exclusões (Soft Deletes via Admin).
    *   "Reaberturas" (Admin pegando um RDO fechado e destrancando).
    *   Alterações na tabela Mãe de Concreto (*Qualquer* alteração no fck gera log da carga antiga).

## 8. Máquinas de Estado e Bloqueios (State Machine)

### A. RDO
*   **Estados:** Rascunho $\rightarrow$ Aguardando Aprovação $\rightarrow$ Aprovado $\rightarrow$ Devolvido.
*   **Muda Status:** Field envia (vai para `Aguardando`). Manager Aprova ou Devolve.
*   **Edição Bloqueia:** Assim que bater `Aguardando` (Para perfis Field). Bateu `Aprovado` (Bloqueia até para o Manager; só reabre via Admin).

### B. Projetos
*   **Estados:** Vigente $\rightarrow$ Obsoleto.
*   **Muda Status:** Único momento: Quando o Manager upa a Rev.02, o Back-end marca a R02 como `Vigente` e mata a R01 para `Obsoleto`.
*   **Edição Bloqueia:** Acesso ao objeto de projeto antigo (Rev.01) nunca é fechado para leitura, mas operações de anexo/link dele para novas FVSs travam se estiver `Obsoleto`.

### C. FVS (Ficha de Verificação)
*   **Estados:** Em Preenchimento $\rightarrow$ Enviada (Opcional p/ aprovação) $\rightarrow$ Aprovada / Aprovada com Ressalva / Reprovada.
*   **Muda Status:** Field submete. Manager decreta a aprovação/falha. Alguém do perfil Admin NUNCA aprova engenharia.
*   **Edição Bloqueia:** Assim que bate qualquer status "Aprovado/Reprovado", não aceita mais check em itens. A Ressalva apenas carrega um aviso de texto.

### D. Concreto
*   **Estados:** Em Despejo $\rightarrow$ Aguardando Laudo $\rightarrow$ Concluído.
*   **Muda Status:** Field cadastra nota $\rightarrow$ Muda pra Aguardando Laudo no Fim do Dia. Manager $\rightarrow$ Após 28 dias insere fck e põe como `Concluído`.
*   **Edição Bloqueia:** As notas (Field) travam ao enviar para Aguardando Laudo. Valores do C.P de laboratório travam ao marcar `Concluído`.
