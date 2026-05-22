# ============================================
# Obra 10 — Production Dockerfile
# ============================================

# --- Build stage ---
FROM node:22-alpine AS builder

# Install build tools for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package.json and prisma schema first (layer caching)
COPY obra10-backend/package.json ./
COPY obra10-backend/prisma ./prisma/

# Install all dependencies (including devDependencies for nest build)
RUN npm install

# Copy remaining backend source
COPY obra10-backend/ .

# Generate Prisma client and build NestJS
RUN npx prisma generate && npx nest build

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/client ./client

# Create uploads directory for runtime
RUN mkdir -p uploads

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
