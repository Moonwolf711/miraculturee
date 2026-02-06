FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package manifests
COPY packages/shared/package.json packages/shared/
COPY packages/pos/package.json packages/pos/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# Build (VITE_API_URL baked in at build time)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @miraculturee/shared build
RUN pnpm --filter @miraculturee/web build

# Serve with lightweight static server
FROM node:22-alpine
RUN npm install -g serve
COPY --from=build /app/apps/web/dist /app
WORKDIR /app
EXPOSE ${PORT:-80}
CMD ["sh", "-c", "serve -s . -l ${PORT:-80}"]
