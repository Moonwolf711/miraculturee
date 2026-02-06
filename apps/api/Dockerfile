FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy full monorepo structure (pnpm needs all workspace packages present)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
# Stub web package.json so pnpm lockfile resolves
COPY apps/web/package.json apps/web/package.json

# Install deps
RUN pnpm install --frozen-lockfile

# Build workspace deps
RUN pnpm --filter @miraculturee/shared build
RUN pnpm --filter @miraculturee/pos build

# Generate Prisma client
RUN cd apps/api && npx prisma generate

WORKDIR /app/apps/api
EXPOSE ${PORT:-3000}

# Use tsx for production — no tsc build step needed
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && npx tsx src/server.ts"]
