FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package manifests
COPY packages/shared/package.json packages/shared/
COPY packages/pos/package.json packages/pos/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/pos/ packages/pos/
COPY apps/api/ apps/api/

# Build packages in order
RUN pnpm --filter @miraculturee/shared build
RUN pnpm --filter @miraculturee/pos build
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @miraculturee/api build

WORKDIR /app/apps/api
EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/server.js"]
