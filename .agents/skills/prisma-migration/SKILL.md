# 🛠️ Skill: Prisma Migration

- Sempre rodar `prisma db push` + `prisma generate` juntos
- Rodar `tsc --noEmit` após generate para verificar tipos
- Nunca usar `prisma migrate reset` em produção
- Padrão de nomenclatura de campos: camelCase
- `empresaId` é campo obrigatório em **todo** model que armazena dados de tenant
