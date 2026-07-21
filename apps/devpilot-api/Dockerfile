# ---- base: shared install layer (also used by devpilot-web build, cache-reused) ----
FROM node:20 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate
# npmjs.org connections are flaky here; be generous with fetch retries
ENV npm_config_fetch_retries=8
ENV npm_config_fetch_retry_mintimeout=15000
ENV npm_config_fetch_retry_maxtimeout=180000
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/devpilot-api ./apps/devpilot-api
# Install in two layers so retries resume from the linked layer, not from scratch:
# 1) link packages without running lifecycle scripts (slow, but cacheable)
# 2) run native build scripts (gyp, prisma engines...) in a separate, retryable layer
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store --ignore-scripts \
      --filter @svton/devpilot-api...
RUN pnpm rebuild --filter @svton/devpilot-api...

# ---- api: NestJS backend ----
# dist/ is compiled on the host (turbo build) and already present in the build
# context; only prisma engines must be generated for the container platform.
FROM base AS api
RUN pnpm --filter @svton/devpilot-api run prisma:generate
WORKDIR /app/apps/devpilot-api
ENV NODE_ENV=production
ENV PORT=3121
EXPOSE 3121
CMD ["node", "dist/main.js"]
