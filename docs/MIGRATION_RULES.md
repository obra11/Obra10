# Regras de Migração Segura — Obra 10

## Princípio: NUNCA quebrar o que já existe

### PODE fazer sem risco:
- Adicionar nova coluna com valor default ou nullable (`?`)
- Adicionar nova tabela
- Adicionar novo índice
- Adicionar novo enum value

### PRECISA de cuidado (fazer em 2 etapas):
- **Renomear coluna** → Etapa 1: criar nova coluna + copiar dados. Etapa 2: remover antiga (depois que o código não usa mais)
- **Mudar tipo de coluna** → Etapa 1: criar nova coluna com tipo novo + copiar. Etapa 2: remover antiga
- **Remover coluna** → Primeiro remover do código, fazer deploy, DEPOIS remover do banco

### NUNCA fazer direto:
- Remover coluna que o código ainda usa
- Renomear tabela sem migration em 2 etapas
- Alterar enum removendo valor existente (adicionar é ok)

---

## Prisma: Comandos

| Comando | Quando usar |
|---------|------------|
| `prisma db push` | **Apenas desenvolvimento local** — pode dropar dados silenciosamente |
| `prisma migrate dev` | Desenvolvimento — gera arquivo de migration |
| `prisma migrate deploy` | **Produção** — aplica migrations existentes de forma segura |

### Fluxo para produção:
1. Alterar `schema.prisma`
2. Rodar `npx prisma migrate dev --name descricao_da_mudanca`
3. Testar localmente
4. Commitar a migration gerada em `prisma/migrations/`
5. Em produção: `npx prisma migrate deploy`

---

## Checklist antes de cada deploy:
- [ ] A migration adiciona colunas opcionais ou com default?
- [ ] Nenhuma coluna existente foi removida ou renomeada diretamente?
- [ ] O código antigo continua funcionando com o novo schema?
- [ ] Testei a migration em ambiente local com dados existentes?
