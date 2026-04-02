# OBRA 10 — Backend

API NestJS para o sistema de gestão de obras OBRA 10. Multi-tenant, modular, com cobrança automática integrada ao Asaas.

---

## Pré-requisitos

| Dependência | Versão |
|---|---|
| Node.js | 20.x |
| PostgreSQL | 18.x |
| npm | 10.x |

---

## Instalação

```bash
npm install
npx prisma generate
```

Copie `.env.example` para `.env` e preencha as variáveis:

### Variáveis de ambiente obrigatórias

```env
# Banco de dados
DATABASE_URL=postgresql://postgres:SENHA@localhost:5432/obra10

# Autenticação JWT
JWT_SECRET=chave-secreta-aleatoria-min-32-chars

# Super Admin (criado pelo seed)
SUPER_ADMIN_EMAIL=superadmin@obra10.com
SUPER_ADMIN_SENHA=suasenha

# Asaas (deixar vazio em dev → modo MOCK automático)
ASAAS_API_KEY=
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3

# Webhook — gerar com: node -e "console.log(require('crypto').randomUUID())"
ASAAS_WEBHOOK_TOKEN=

# E-mail (deixar vazio em dev → modo MOCK automático)
RESEND_API_KEY=

# Anthropic AI — Relatório Executivo RDO v2.0
# Obter em: https://console.anthropic.com → API Keys
# Deixar VAZIO para usar modo MOCK (sem custo, dados fictícios)
ANTHROPIC_API_KEY=
```

> ⚠️ **Atenção — variável no ambiente do sistema operacional:**
> Se `ANTHROPIC_API_KEY` estiver definida como **variável de ambiente do SO** (Windows Environment Variables / `.bashrc` / `.zshrc`), ela **sobrescreve silenciosamente** o valor do `.env`. Isso faz o backend chamar a API real do Claude mesmo com o `.env` vazio — e pode gerar erro 400 se a conta não tiver créditos.
>
> Para verificar se a variável está no sistema:
> ```powershell
> # Windows
> echo %ANTHROPIC_API_KEY%
> # Linux / Mac
> echo $ANTHROPIC_API_KEY
> ```
> Para usar modo MOCK em dev, garanta que a variável **não está definida no sistema** — apenas no `.env` com valor vazio.

---

## Primeiro uso — Seed

Popula o banco com módulos, Super Admin e dados de demonstração:

```bash
npx ts-node prisma/seed.ts
```

O seed é **idempotente** — pode ser rodado múltiplas vezes sem duplicar dados.

**Dados criados:**
| Usuário | E-mail | Senha |
|---|---|---|
| Super Admin | `superadmin@obra10.com` | *(ver `SUPER_ADMIN_SENHA` no `.env`)* |
| Gestor demo | `engenheiro@acme.com` | `Senha123` |
| Usuário demo | `mestre@acme.com` | `Senha123` |

---

## Rodar o projeto

```bash
npm run start:dev
```

API em: `http://localhost:3000`

Use o arquivo `Obra10_Postman.http` para testar os endpoints (compatível com VS Code REST Client).

---

## Pipeline de Migrations

> ⚠️ `prisma migrate dev` **não funciona** neste ambiente — bug do Prisma 7 com Windows + PostgreSQL shadow database.

### Para adicionar mudanças ao schema:

**1. Edite `prisma/schema.prisma`**

**2. Execute o script:**
```powershell
.\scripts\migrate.ps1 -Name "nome_da_mudanca"
```

O script automaticamente:
1. Lê `DATABASE_URL` do `.env`
2. Gera o SQL da mudança via `prisma migrate diff`
3. Exibe o SQL para **revisão antes de aplicar** — edite se necessário
4. Aguarda confirmação (ENTER) ou cancelamento (CTRL+C)
5. Aplica o SQL ao banco via `psql`
6. Regenera o Prisma Client (`prisma generate`)
7. Registra no histórico (`prisma migrate resolve --applied`)

**Exemplos:**
```powershell
.\scripts\migrate.ps1 -Name "add_fvs_tables"
.\scripts\migrate.ps1 -Name "add_payment_expiry"
.\scripts\migrate.ps1 -Name "remove_legacy_column"
```

> ⚠️ **ATENÇÃO:** O diff usa `--from-empty` como fallback, gerando o schema completo.  
> Edite o SQL gerado para manter **apenas os `ALTER TABLE` / `CREATE TABLE` novos**.

> ❌ **NUNCA usar** `prisma db push` — não mantém histórico de versões.

---

## Módulos implementados

| Módulo | Rota base | Descrição |
|---|---|---|
| **Auth** | `/auth` | Login (HttpOnly cookie), logout, getMe, esqueci/redefinir senha |
| **Tenants** | `/tenants` | Self-service register PF/PJ, verificar-email, reenviar-verificacao |
| **Usuários** | `/usuarios` | CRUD, atribuição de módulos por usuário |
| **Admin** | `/admin/tenants` | Listar tenants, toggle módulos, alterar plano |
| **Cobranças** | `/cobrancas` | Contratar PIX/cartão, histórico, status seguro, modulos-ativos, webhook Asaas |
| **Módulos** | `/modulos` | Catálogo público com preços (para novos clientes) |
| **RDO** | `/rdos` | CRUD, efetivos, atividades, equipamentos, enviar, aprovar |
| **Obras** | `/obras` | Listar obras do usuário autenticado |
| **Anexos** | `/anexos` | Upload S3 pré-assinado, listagem, soft-delete |

### Segurança
- Autenticação via **HttpOnly cookie** (`obra10_token`) — token nunca exposto no body
- `ModuloGuard` — verifica módulo ativo e que tenant não está suspenso (403 se suspenso)
- `ObraContextGuard` — valida acesso via header `x-obra-id`
- Rate limiting: 5/hora em `/tenants/register`, 3/hora em reenvio de verificação
- Webhook Asaas requer `ASAAS_WEBHOOK_TOKEN` configurado (rejeita se vazio)

### Cron Jobs
| Job | Frequência | Ação |
|---|---|---|
| `TenantExpiryCron` | Diário (meia-noite) | Desativa módulos com `expiresAt` vencido |
| `CobrancaCron` | Dia 1 do mês | Gera cobranças mensais por módulos ativos |
| `CobrancaCron` | Diário | Verifica inadimplência — suspende tenant após 5 dias |
