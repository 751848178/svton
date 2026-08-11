# ---- base: shared install layer (also used by devpilot-web build, cache-reused) ----
FROM node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5 AS base
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

# ---- immutable scanner supply for controlled-local-acceptance-v2 ----
FROM python@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2 AS acceptance-semgrep
COPY apps/devpilot-api/security/semgrep-requirements-linux-py312.lock /tmp/semgrep-requirements.lock
RUN echo '278aedc50045986f04e0eb268e5e42883bed7bdf6bff64d08cc2ef455f0b334c  /tmp/semgrep-requirements.lock' | sha256sum -c - \
 && pip install --no-cache-dir --timeout 180 --retries 8 \
      --require-hashes --only-binary=:all: \
      -r /tmp/semgrep-requirements.lock \
 && semgrep --version | grep -F '1.172.0'

FROM debian:bookworm-slim@sha256:abd67ffcfa541b485a3dff59865ab629aa048a6c613e639d36e7456b0b229241 AS acceptance-tools
ARG TARGETARCH
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) GITLEAKS_ARCH=x64; GITLEAKS_SHA=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;; \
      arm64) GITLEAKS_ARCH=arm64; GITLEAKS_SHA=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;; \
      *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_${GITLEAKS_ARCH}.tar.gz" -o /tmp/gitleaks.tar.gz; \
    echo "${GITLEAKS_SHA}  /tmp/gitleaks.tar.gz" | sha256sum -c -; \
    mkdir -p /out/bin /out/licenses/gitleaks /tmp/gitleaks; \
    tar -xzf /tmp/gitleaks.tar.gz -C /tmp/gitleaks; \
    install -m 0755 /tmp/gitleaks/gitleaks /out/bin/gitleaks; \
    cp /tmp/gitleaks/LICENSE /out/licenses/gitleaks/LICENSE
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) TRIVY_ARCH=64bit; TRIVY_SHA=2edd39da482bb4e9831962487b68f68e3928ec3137794757f54d00383d79547b ;; \
      arm64) TRIVY_ARCH=ARM64; TRIVY_SHA=13833d97e8a1a5367471c372a173180157f593bece570e20d5d925fef552f5dd ;; \
      *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v0.73.0/trivy_0.73.0_Linux-${TRIVY_ARCH}.tar.gz" -o /tmp/trivy.tar.gz; \
    echo "${TRIVY_SHA}  /tmp/trivy.tar.gz" | sha256sum -c -; \
    mkdir -p /out/licenses/trivy /tmp/trivy; \
    tar -xzf /tmp/trivy.tar.gz -C /tmp/trivy; \
    install -m 0755 /tmp/trivy/trivy /out/bin/trivy; \
    cp /tmp/trivy/LICENSE /out/licenses/trivy/LICENSE
RUN set -eux; \
    TOKEN_JSON="$(curl -fsSL 'https://ghcr.io/token?scope=repository:aquasecurity/trivy-db:pull')"; \
    TOKEN="$(printf '%s' "$TOKEN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"; \
    test -n "$TOKEN"; \
    curl -fsSL -H "Authorization: Bearer $TOKEN" \
      'https://ghcr.io/v2/aquasecurity/trivy-db/blobs/sha256:4cdc607a113f80be2873b1dd3ebf08bc6f3d171e491dbee48dd2debe837aa848' \
      -o /tmp/trivy-db.tar.gz; \
    echo '4cdc607a113f80be2873b1dd3ebf08bc6f3d171e491dbee48dd2debe837aa848  /tmp/trivy-db.tar.gz' | sha256sum -c -; \
    mkdir -p /out/trivy-cache/db; \
    tar -xzf /tmp/trivy-db.tar.gz -C /out/trivy-cache/db; \
    grep -F '2026-08-11T01:05:09.651160722Z' /out/trivy-cache/db/metadata.json
RUN set -eux; \
    curl -fsSL "https://codeload.github.com/semgrep/semgrep-rules/tar.gz/40b8c63f75dc7c22c8a77482d73bfb864b146f7e" -o /tmp/semgrep-rules.tar.gz; \
    echo "b7e483abf001c405a3e908251ff66cb198a26702aff5fe4c5f0c4b2fffec4919  /tmp/semgrep-rules.tar.gz" | sha256sum -c -; \
    mkdir -p /out/semgrep-rules; \
    tar -xzf /tmp/semgrep-rules.tar.gz --strip-components=1 -C /out/semgrep-rules; \
    test -f /out/semgrep-rules/LICENSE

# This target is selected only by the isolated acceptance compose profile.
FROM api AS api-acceptance
COPY --from=acceptance-semgrep /usr/local/ /usr/local/
COPY --from=acceptance-tools /out/bin/ /usr/local/bin/
COPY --from=acceptance-tools /out/licenses/ /opt/devpilot/security/licenses/
COPY --from=acceptance-tools /out/semgrep-rules/ /opt/devpilot/security/semgrep-rules/
COPY --from=acceptance-tools /out/trivy-cache/ /opt/devpilot/security/trivy-cache/
ENV SEMGREP_SEND_METRICS=off
ENV SEMGREP_ENABLE_VERSION_CHECK=0
LABEL io.svton.devpilot.acceptance-profile="controlled-local-acceptance-v2" \
      io.svton.devpilot.semgrep-rules="40b8c63f75dc7c22c8a77482d73bfb864b146f7e" \
      io.svton.devpilot.trivy-db="sha256:e5c54b277db94d2973c2d4fdf68c94be8729a3d5fc2e48e7da04b6dacdf0bb71"
RUN gitleaks version | grep -F "8.30.1" \
 && semgrep --version | grep -F "1.172.0" \
 && trivy --version | grep -F "Version: 0.73.0" \
 && grep -F '2026-08-11T01:05:09.651160722Z' /opt/devpilot/security/trivy-cache/db/metadata.json
