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
RUN pnpm --filter @miraculturee/web build

# Serve with lightweight static server
FROM node:22-alpine
RUN npm install -g serve
COPY --from=build /app/apps/web/dist /app
WORKDIR /app
EXPOSE ${PORT:-80}
CMD ["sh", "-c", "serve -s . -l ${PORT:-80}"]
