# 🛠️ Skill: Deploy Railway

- Variáveis de ambiente obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`
- Sequência de deploy: build → migrate → start
- Verificação pós-deploy: health check em `/api/health`
- Rollback: revert para o commit anterior via Railway dashboard
- PostgreSQL: connection pooling habilitado (máx 10 conexões no plano básico)
