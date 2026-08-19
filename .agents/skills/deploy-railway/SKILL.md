# 🛠️ Skill: Deploy Railway

- Variáveis de ambiente obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`
- Produção — mídia: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT`, `AWS_S3_BUCKET_NAME`, `AWS_S3_PUBLIC_URL` (R2). Sem isso o upload falha de propósito (não grava no disco do container).
- Nunca versionar `obra10-backend/uploads/`. Antes do push: `npm run check:uploads`
- Sequência de deploy: `check:uploads` → build frontend → sync:assets → migrate → start (`scripts/railway-start.sh`)
- Verificação pós-deploy: health check em `/health`
- Rollback: revert para o commit anterior via Railway dashboard
- PostgreSQL: connection pooling habilitado (máx 10 conexões no plano básico)
