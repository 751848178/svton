FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ENV COREPACK_HOME=/opt/corepack
RUN apt-get -o Acquire::Retries=3 update && apt-get -o Acquire::Retries=3 install -y --no-install-recommends \
    ca-certificates openssl git openssh-client tini \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@8.12.0 --activate \
    && chmod -R a+rX,go-w /opt/corepack
WORKDIR /app

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shipkit/package.json shipkit/tsconfig.json ./shipkit/
COPY apps/shipkit-api/package.json apps/shipkit-api/tsconfig.json ./apps/shipkit-api/
COPY apps/shipkit-web/package.json apps/shipkit-web/tsconfig.json ./apps/shipkit-web/
COPY packages/api-client/package.json packages/api-client/tsconfig.json ./packages/api-client/
COPY packages/hooks/package.json packages/hooks/tsconfig.json ./packages/hooks/
COPY packages/ui/package.json packages/ui/tsconfig.json ./packages/ui/
COPY packages/authz/package.json packages/authz/tsconfig.json ./packages/authz/
COPY packages/nestjs-http/package.json packages/nestjs-http/tsconfig.json ./packages/nestjs-http/
RUN pnpm --filter shipkit --filter @svton/shipkit-api... --filter @svton/shipkit-web... \
    install --frozen-lockfile
COPY shipkit/src ./shipkit/src
COPY shipkit/bootstrap/src ./shipkit/bootstrap/src
COPY shipkit/bootstrap/install.sh ./shipkit/bootstrap/install.sh
COPY shipkit/scripts/build-install.mjs ./shipkit/scripts/build-install.mjs
COPY shipkit/ops/container/ship.yaml ./shipkit/ops/container/ship.yaml
COPY shipkit/ops/host-isolation/render-spec.mjs shipkit/ops/host-isolation/ship.generated.yaml ./shipkit/ops/host-isolation/
COPY packages/api-client/src ./packages/api-client/src
COPY packages/hooks/src ./packages/hooks/src
COPY packages/ui/src ./packages/ui/src
COPY packages/ui/tsup.config.ts packages/ui/tailwind.config.js packages/ui/tailwind-preset.js ./packages/ui/
COPY packages/authz/src ./packages/authz/src
COPY packages/authz/tsup.config.ts ./packages/authz/
COPY packages/nestjs-http/src ./packages/nestjs-http/src
COPY packages/nestjs-http/tsup.config.ts ./packages/nestjs-http/
COPY apps/shipkit-api/src ./apps/shipkit-api/src
COPY apps/shipkit-api/prisma ./apps/shipkit-api/prisma
COPY apps/shipkit-api/scripts/migrate.mjs ./apps/shipkit-api/scripts/migrate.mjs
COPY apps/shipkit-web/src ./apps/shipkit-web/src
COPY apps/shipkit-web/public ./apps/shipkit-web/public
COPY apps/shipkit-web/next.config.mjs apps/shipkit-web/next-env.d.ts \
    apps/shipkit-web/tailwind.config.cjs apps/shipkit-web/postcss.config.cjs ./apps/shipkit-web/
RUN node shipkit/scripts/build-install.mjs --check \
    && pnpm --filter shipkit build \
    && pnpm --filter @svton/api-client --filter @svton/hooks --filter @svton/ui \
       --filter @svton/authz --filter @svton/nestjs-http build \
    && pnpm --filter @svton/shipkit-api prisma:generate \
    && pnpm --filter @svton/shipkit-api build \
    && pnpm --filter @svton/shipkit-web build \
    && rm -rf apps/shipkit-web/.next/cache \
    && mkdir -p apps/shipkit-web/.next/cache \
    && find shipkit/dist -name '*.test.js' -delete

FROM base AS runtime
RUN groupadd --gid 10001 shipkit && useradd --uid 10001 --gid shipkit --no-create-home shipkit
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOME=/etc/shipkit SHIPKIT_WEB_HOST=0.0.0.0 \
    COREPACK_ENABLE_NETWORK=0 \
    SHIPKIT_DATA_DIR=/var/lib/shipkit SHIPKIT_STATE_DIR=/var/lib/shipkit/controller-state \
    SHIPKIT_SECRET_KEY_FILE=/etc/shipkit/private/secret-key.json
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=10001:10001 /app/shipkit/package.json ./shipkit/package.json
COPY --from=build --chown=10001:10001 /app/shipkit/node_modules ./shipkit/node_modules
COPY --from=build --chown=10001:10001 /app/shipkit/dist ./shipkit/dist
COPY --from=build --chown=10001:10001 /app/shipkit/bootstrap/install.sh ./shipkit/bootstrap/install.sh
COPY --from=build --chown=10001:10001 /app/packages ./packages
RUN find packages -type d -name src -prune -exec rm -rf '{}' +
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/package.json ./apps/shipkit-api/package.json
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/node_modules ./apps/shipkit-api/node_modules
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/dist ./apps/shipkit-api/dist
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/generated ./apps/shipkit-api/generated
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/prisma ./apps/shipkit-api/prisma
COPY --from=build --chown=10001:10001 /app/apps/shipkit-api/scripts ./apps/shipkit-api/scripts
COPY --from=build --chown=10001:10001 /app/apps/shipkit-web/package.json ./apps/shipkit-web/package.json
COPY --from=build --chown=10001:10001 /app/apps/shipkit-web/node_modules ./apps/shipkit-web/node_modules
COPY --from=build --chown=10001:10001 /app/apps/shipkit-web/.next ./apps/shipkit-web/.next
COPY --from=build --chown=10001:10001 /app/apps/shipkit-web/public ./apps/shipkit-web/public
COPY --from=build --chown=10001:10001 /app/apps/shipkit-web/next.config.mjs ./apps/shipkit-web/next.config.mjs
COPY --chown=10001:10001 shipkit/scripts/platform-start.mjs shipkit/scripts/platform-start-settings.mjs \
    shipkit/scripts/platform-process-lock.mjs shipkit/scripts/platform-runtime-context.mjs \
    shipkit/scripts/platform-process-tree.mjs shipkit/scripts/platform-supervisor-lifecycle.mjs ./shipkit/scripts/
COPY --chown=10001:10001 shipkit/ops/container/health.mjs shipkit/ops/container/bootstrap.mjs ./shipkit/ops/container/
RUN mkdir -p /var/lib/shipkit /etc/shipkit/private && chown 10001:10001 /var/lib/shipkit
USER 10001:10001
EXPOSE 8769
HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=3 \
    CMD ["node", "shipkit/ops/container/health.mjs"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "shipkit/scripts/platform-start.mjs", "--production", "--reuse-build"]
