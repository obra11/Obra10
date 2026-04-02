# Obra 10: Modelagem do Banco de Dados (MVP)

A arquitetura do MVP será multi-tenant (vários clientes/empresas no mesmo banco), garantindo isolamento de dados e hierarquia de vínculos.

---

## 1 e 2. Entidades Principais e Relacionamentos

### Níveis Globais e de Acesso (Tenant)
**1. Empresa (Tenant)**
*   **Objetivo:** Isolar totalmente os dados de uma construtora da outra.
*   **Campos:** `id`, `cnpj`, `razao_social`, `created_at`, `deleted_at`.
*   **Contexto:** Base do sistema. Todas as Obras e Usuários pertencem a uma Empresa.

**2. Obra**
*   **Objetivo:** Representar o canteiro físico onde os processos ocorrem.
*   **Campos:** `id`, `empresa_id` (FK), `nome`, `endereco`, `status` (Ativa/Finalizada).
*   **Contexto:** Pertence à Empresa. "Pai" de todas as entidades processuais (RDO, FVS).

**3. Usuário**
*   **Objetivo:** Credenciais de acesso de uma pessoa física.
*   **Campos:** `id`, `empresa_id` (FK), `nome`, `email`, `senha_hash`, `ativo`.
*   **Contexto:** Pertence à Empresa. Uma construtora cadastra seus funcionários.

**4. Perfil (System Roles)**
*   **Objetivo:** Tabela de domínio (estática) com os níveis lógicos de permissão reduzidos.
*   **Registros Base:** 1 (Viewer), 2 (Field/Operador), 3 (Manager/Engenheiro), 4 (SysAdmin).

**5. Vínculo (user_obra_role)**
*   **Objetivo:** Tabela pivô de extrema importância. Define a matriz de permissão *por obra*. (Um usuário pode ser 'Engenheiro' na Obra A, mas apenas 'Viewer' na Obra B).
*   **Campos:** `id`, `usuario_id` (FK), `obra_id` (FK), `perfil_id` (FK).
*   **Relacionamento:** N:N.

### Níveis Transacionais (A rotina de Obra)
**6. RDO (Relatório Diário)**
*   **Objetivo:** Registrar o dia.
*   **Campos:** `id`, `obra_id` (FK), `criador_id` (FK), `aprovador_id` (FK nulo), `data_registro`, `clima_manha`, `clima_tarde`, `atividades_resumo`, `status`, `deleted_at`.
*   **Contexto:** Pertence à Obra.

**7. Projetos (Documentos)**
*   **Objetivo:** Repositório fiel das plantas.
*   **Campos:** `id`, `obra_id` (FK), `uploader_id` (FK), `disciplina` (Arq, Estrutura), `revisao`, `titulo`, `arquivo_url`, `status`, `deleted_at`.
*   **Contexto:** Pertence à Obra.

**8. FVS (Ficha de Verificação)**
*   **Objetivo:** Checklist e liberação de frentes.
*   **Campos:** `id`, `obra_id` (FK), `projeto_id` (FK - Prancha referenciada), `criador_id` (FK), `local_aplicacao` (Ex: Laje 2), `disciplina` (Forma/Aço), `status`, `deleted_at`.
*   **Contexto:** Pertence à Obra.

**9. Controle de Concreto (Lote de Concretagem)**
*   **Objetivo:** Rastreio estrutural.
*   **Campos:** `id`, `obra_id` (FK), `fvs_liberacao_id` (FK), `volume_realizado`, `fck_projeto`, `fck_realizado_28d`, `data_despejo`, `status`.
*   **Contexto:** Pertence à Obra. Relaciona-se 1:1 com uma FVS exigida (Liberação prévia).

**10. Anexos (Tabela Polimórfica)**
*   **Objetivo:** Guardar fotos para qualquer entidade sem criar 4 tabelas de fotos diferentes.
*   **Campos:** `id`, `url_s3`, `attachable_type` (String ex: 'RDO', 'FVS'), `attachable_id` (Integer).

**11. Auditoria (Audit_Log)**
*   **Objetivo:** Rastro de migalhas para LGPD e ISO9001 (Quem alterou ou deletou o quê).
*   **Campos:** `id`, `usuario_id`, `entidade_afetada`, `registro_id`, `tipo_acao` (UPDATE, APPROVE, DELETE), `detalhes` (JSON com 'De -> Para').

---

## 3. Máquina de Estados e Transições nos Módulos

### RDO
*   **Status:** `Rascunho` $\rightarrow$ `Enviado` $\rightarrow$ `Aprovado` $\rightarrow$ `Devolvido`
*   **Transição:** Mestre muda de Rascunho para Enviado. Engenheiro muda para Aprovado ou Devolvido.
*   **Bloqueio de Edição:** Ao virar `Enviado` (trava o Mestre). Ao virar `Aprovado` (Trava todos).

### Projetos
*   **Status:** `Vigente` $\rightarrow$ `Obsoleto`
*   **Transição:** Engenheiro posta a Revisão 02 (entra como Vigente), o sistema mapeia a Revisão 01 do mesmo título e derruba seu status para Obsoleto no backend.
*   **Bloqueio de Edição:** Registros em 'Obsoleto' nunca mais sofrem mutação ou recebem novas fotos.

### FVS
*   **Status:** `Inspeção` $\rightarrow$ `Aprovada` $\rightarrow$ `Ressalva` $\rightarrow$ `Reprovada`
*   **Transição:** Inspetor preenche em Inspeção e submete. Engenheiro define o parecer (Aprovada/Ressalva/Reprovada).
*   **Bloqueio de Edição:** Ao receber qualquer parecer final do Engenheiro.

### Controle de Concreto
*   **Status:** `Em Execução` $\rightarrow$ `Aguardando Laudo` $\rightarrow$ `Concluído`
*   **Transição:** Mestre cadastra notas e muda para Aguardando Laudo ao fim do dia. O Engenheiro insere as resistências de laboratório 28 dias depois e joga para Concluído.
*   **Bloqueio de Edição:** Editar notas fiscais/volumes trava na saída para 'Aguardando Laudo'. Após concluído, ninguém altera.

---

## 4. Visibilidade de Dados, Soft Delete e Auditoria

### Visibilidade (Row Level Security Aplicada no Backend)
1.  **Diretor / Admin (All Scope):** A API busca dados onde `Empresa_Id = X`. Veem todas as Obras da construtora deles.
2.  **Por Obra (Scoped):** Engenheiro, Técnico e Mestre enviam requisições, a API cruza o Token deles com a tabela `user_obra_role`. Se tentarem consultar um RDO da "Obra B" onde não constam na tabela pivô, a API devolve Erro 403 (Forbidden).
3.  **Cooperativismo (Registro Próprio? Não!):** Em um canteiro, os dados pertencem à *Obra*. Se o Mestre A adoeceu, o Mestre B vê e edita o RDO que o A deixou em Rascunho de manhã. **A propriedade do registro é da Obra**, limitando a ação apenas pelo Papel da pessoa (Field).

### Soft Delete & Auditoria
Nenhum "DELETE" via SQL é rodado nestas tabelas.
*   O Administrador clica em excluir uma FVS feita errada.
*   O back-end atualiza a coluna `deleted_at = TIMESTAMP_ATUAL`.
*   A query pardão de todos os usuários é `SELECT * FROM fvs WHERE deleted_at IS NULL`. Para a equipe do canteiro, a FVS desapareceu.
*   Ao mesmo tempo, na tabela `Audit_Log` é salvo: `{"usuario": "Admin", "acao": "DELETE", "tabela": "FVS", "ID": 1205, "data": "18/03/2026"}` garantindo resguardo técnico à construtora em caso de perícia.
