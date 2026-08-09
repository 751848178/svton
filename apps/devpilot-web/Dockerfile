# ---- base: shared install layer (must stay identical to apps/devpilot-api/Dockerfile base) ----
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
COPY apps/devpilot-web ./apps/devpilot-web
# Install in two layers so retries resume from the linked layer, not from scratch:
# 1) link packages without running lifecycle scripts (slow, but cacheable)
# 2) run native build scripts (gyp, prisma engines...) in a separate, retryable layer
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store --ignore-scripts \
      --filter @svton/devpilot-web...
RUN pnpm rebuild --filter @svton/devpilot-web...

# ---- web: Next.js frontend ----
FROM base AS web
WORKDIR /app/apps/devpilot-web
ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=web-dist . .next/
RUN test -n "$NEXT_PUBLIC_API_URL" && test -f .next/BUILD_ID
EXPOSE 3120
CMD ["pnpm", "start"]
