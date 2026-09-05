# ============================================
# Obra 10 â€” Production Dockerfile
# Force rebuild: 2026-09-05-relatorios-pdf-fotos-2.9.17
# ============================================

# --- Build stage ---
FROM node:22-alpine AS builder

ARG OBRA10_BUILD_ID=2.9.17-20260905
ENV OBRA10_BUILD_ID=$OBRA10_BUILD_ID

# Install build tools for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Placeholder antes do npm install: postinstall roda `prisma generate` sem banco.
ENV PRISMA_BUILD_PLACEHOLDER=1

# Copy package.json, prisma schema, and prisma config first (layer caching)
COPY obra10-backend/package.json ./
COPY obra10-backend/prisma.config.ts ./
COPY obra10-backend/prisma ./prisma/

# Install all dependencies (including devDependencies for nest build)
RUN npm install

# Copy remaining backend source
COPY obra10-backend/ .

# Generate Prisma client and build NestJS (sem banco real no build)
RUN npx prisma generate && npx nest build
ENV PRISMA_BUILD_PLACEHOLDER=

# --- Production stage ---
FROM node:22-alpine

ARG OBRA10_BUILD_ID=2.9.17-20260905
ENV OBRA10_BUILD_ID=$OBRA10_BUILD_ID
ENV NODE_ENV=production

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/client ./client
COPY --from=builder /app/scripts/railway-start.sh ./scripts/railway-start.sh

# Create uploads directory for runtime (dev/local only; produÃ§Ã£o usa R2)
RUN mkdir -p uploads && chmod +x scripts/railway-start.sh
# Guarda: contexto de build nÃ£o deve trazer mÃ­dia de usuÃ¡rio
RUN if [ -d uploads ] && [ "$(find uploads -type f 2>/dev/null | head -1)" ]; then \
      echo "ERRO: arquivos em uploads/ no contexto Docker â€” remova do Git/.dockerignore"; \
      exit 1; \
    fi

EXPOSE 3000

CMD ["sh", "scripts/railway-start.sh"]
