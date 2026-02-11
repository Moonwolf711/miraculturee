FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy full monorepo structure
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
# Stub api package.json so pnpm lockfile resolves
COPY apps/api/package.json apps/api/package.json

# Install deps
RUN pnpm install --frozen-lockfile

# Build shared, then web
RUN pnpm --filter @miraculturee/shared build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
RUN pnpm --filter @miraculturee/web build

# Serve with lightweight static server
FROM node:22-alpine
COPY --from=build /app/apps/web/dist /app
COPY apps/web/server.cjs /app/server.cjs
WORKDIR /app
EXPOSE ${PORT:-80}
CMD ["node", "server.cjs"]
