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

# Compile TypeScript to JavaScript (faster cold start, lower memory)
RUN pnpm --filter @miraculturee/api exec tsc

WORKDIR /app/apps/api
EXPOSE ${PORT:-3000}

CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/server.js"]
