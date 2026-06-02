# Technical Specification - Confirmação Manual de Pagamento por Super Admin

## 1. Objetivo
Permitir que usuários com perfil `SUPER_ADMIN` validem manualmente cobranças pendentes no painel administrativo, alterando o status para `PAGO`, registrando a data de pagamento e reativando automaticamente os acessos e módulos da empresa caso estivessem suspensos. Para maior segurança, a ação exigirá a confirmação da senha do próprio Super Admin logado.

---

## 2. Requisitos de Negócio (Critérios de Aceite)
1. **Controle de Acesso (Super Admin):**
   - Apenas usuários com `perfilGlobal === 'SUPER_ADMIN'` podem visualizar o botão de confirmação manual de pagamento e executar o endpoint de validação.
2. **Confirmação de Senha:**
   - A validação do pagamento só é processada mediante a digitação correta da senha do Super Admin logado no momento da confirmação.
3. **Efeitos no Banco de Dados:**
   - O status da cobrança (`Cobranca`) deve ser atualizado para `'PAGO'`.
   - A data de pagamento (`dataPagamento`) deve ser definida para o momento atual.
   - A forma de pagamento (`formaPagamento`) deve ser definida como `'MANUAL'`.
   - A empresa vinculada deve ser marcada como ativa/não suspensa (`suspensa: false`, `diasInadimplente: 0`).
   - Os módulos contratados da empresa (`tenantModulos`) que estão marcados como ativos devem ser reativados e sincronizados.
4. **Registro de Auditoria:**
   - Deve ser registrado um registro de auditoria (`AuditLog`) detalhando a ação, incluindo o ID do Super Admin que realizou o override.
5. **Comunicação por E-mail:**
   - Enviar um e-mail de confirmação de pagamento para o e-mail cadastrado da empresa.
6. **Interface do Usuário (UI):**
   - Exibir um botão "Confirmar Pagamento" nas linhas da tabela de faturamento que possuem status pendente.
   - Abrir um modal solicitando a senha de confirmação do Super Admin.
   - Exibir feedback visual de processamento e atualizar a tabela instantaneamente.

---

## 3. Detalhes de Implementação

### Back-end

#### Endpoint `POST /admin/empresas/:id/cobrancas/:cobrancaId/confirmar-manual`
- **Guards:** `JwtAuthGuard`, `SuperAdminGuard`.
- **Body DTO:**
  ```typescript
  export class ConfirmarPagamentoManualDto {
    @IsNotEmpty({ message: 'A senha é obrigatória.' })
    @IsString()
    senha: string;
  }
  ```
- **Fluxo:**
  1. Verificar a senha informada utilizando `bcrypt.compare` com a senha hash do `req.user` (Super Admin).
  2. Caso a senha seja inválida, retornar `ForbiddenException('Senha de administrador incorreta.')`.
  3. Buscar a cobrança pelo `cobrancaId` e verificar se ela pertence ao `empresaId` (`id` da URL).
  4. Executar as atualizações no banco:
     - Cobrança: `status = 'PAGO'`, `dataPagamento = new Date()`, `formaPagamento = 'MANUAL'`.
     - Empresa: `suspensa = false`, `diasInadimplente = 0`.
     - Reativar e atualizar módulos da empresa.
     - Gravar no `AuditLog` a ação `'PAGAMENTO_CONFIRMADO_MANUAL'` com a identificação do `usuarioId = req.user.id`.
  5. Enviar e-mail de confirmação.

### Front-end

#### Tela `AdminEmpresaDetalhe.tsx`
- Adicionar uma ação na tabela da aba **Faturamento**:
  - Exibir botão de check verde (ícone `CheckCircle2` ou similar) apenas para cobranças que possuam status diferente de `'PAGO'` e `'RECEIVED'`.
- Implementar um modal para a entrada da senha:
  - Form com input `type="password"` para a senha do administrador.
  - Botão "Confirmar" com spinner e "Cancelar".
- Chamar o endpoint correspondente e, se bem-sucedido, recarregar as cobranças e o status da empresa.
