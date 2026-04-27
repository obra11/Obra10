# 🛠️ Skill: Multi-Tenancy

- `empresaId` deve estar presente em **toda** query Prisma que acesse dados de negócio
- Nunca buscar dados sem filtrar por `empresaId` — isso é uma brecha crítica de segurança
- O `empresaId` vem sempre do JWT decodificado, nunca do body da requisição
- Testar isolamento de tenant em todo novo endpoint criado
