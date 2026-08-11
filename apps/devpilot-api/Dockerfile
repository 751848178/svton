# ---- base: shared install layer (also used by devpilot-web build, cache-reused) ----
FROM node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5 AS base
ENV PNPM_EXECUTABLE=/opt/devpilot/pnpm/8.12.0/bin/pnpm.cjs
# npmjs.org connections are flaky here; be generous with fetch retries
ENV npm_config_fetch_retries=8
ENV npm_config_fetch_retry_mintimeout=15000
ENV npm_config_fetch_retry_maxtimeout=180000
RUN npm pack pnpm@8.12.0 --ignore-scripts --pack-destination /tmp \
 && echo '279278f83be782f6faaefbacbccc503301c4ec2cdafd40983e7c26aeeee7c38270f5c8e635b43464691b897abe1675b40c06df6edadde922532b7368aa9a5267  /tmp/pnpm-8.12.0.tgz' | sha512sum -c - \
 && mkdir -p /opt/devpilot/pnpm/8.12.0 \
 && tar -xzf /tmp/pnpm-8.12.0.tgz --strip-components=1 -C /opt/devpilot/pnpm/8.12.0 \
 && chown -R root:root /opt/devpilot/pnpm \
 && chmod -R go-w /opt/devpilot/pnpm \
 && test ! -L "$PNPM_EXECUTABLE" \
 && test "$("$PNPM_EXECUTABLE" --version)" = '8.12.0'
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/devpilot-api ./apps/devpilot-api
# Install in two layers so retries resume from the linked layer, not from scratch:
# 1) link packages without running lifecycle scripts (slow, but cacheable)
# 2) run native build scripts (gyp, prisma engines...) in a separate, retryable layer
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    "$PNPM_EXECUTABLE" install --frozen-lockfile --store-dir=/pnpm/store --ignore-scripts \
      --filter @svton/devpilot-api...
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    "$PNPM_EXECUTABLE" rebuild --store-dir=/pnpm/store \
      --filter @svton/devpilot-api...

# ---- api: NestJS backend ----
# dist/ is compiled on the host (turbo build) and already present in the build
# context; only prisma engines must be generated for the container platform.
FROM base AS api
RUN "$PNPM_EXECUTABLE" --filter @svton/devpilot-api run prisma:generate
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
COPY apps/devpilot-api/security/semgrep-rule-manifest.txt /tmp/semgrep-rule-manifest.txt
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
    echo "cd087178050a0abf3664375e5c9a7f4bbc0810c59fa53771d44fd6467662c648  /tmp/semgrep-rule-manifest.txt" | sha256sum -c -; \
    curl -fsSL "https://codeload.github.com/semgrep/semgrep-rules/tar.gz/40b8c63f75dc7c22c8a77482d73bfb864b146f7e" -o /tmp/semgrep-rules.tar.gz; \
    echo "b7e483abf001c405a3e908251ff66cb198a26702aff5fe4c5f0c4b2fffec4919  /tmp/semgrep-rules.tar.gz" | sha256sum -c -; \
    mkdir -p /tmp/semgrep-rules /out/semgrep-rules-manifest /out/licenses/semgrep-rules; \
    tar -xzf /tmp/semgrep-rules.tar.gz --strip-components=1 -C /tmp/semgrep-rules; \
    awk '$1 == "path" { print $2 }' /tmp/semgrep-rule-manifest.txt | while read -r rule_path; do \
      case "$rule_path" in *[!a-zA-Z0-9_-]*) exit 1;; esac; \
      test -d "/tmp/semgrep-rules/$rule_path"; \
      find "/tmp/semgrep-rules/$rule_path" -type f \( -name '*.yaml' -o -name '*.yml' \) \
        ! -name '*.test.yaml' ! -name '*.test.yml' \
        ! -name '*.fixed.yaml' ! -name '*.fixed.yml' -print | while read -r rule_file; do \
          if grep -q '^rules:' "$rule_file"; then \
            relative="${rule_file#/tmp/semgrep-rules/}"; \
            mkdir -p "/out/semgrep-rules-manifest/$(dirname "$relative")"; \
            cp "$rule_file" "/out/semgrep-rules-manifest/$relative"; \
          fi; \
        done; \
    done; \
    (cd /out/semgrep-rules-manifest && find . -type f -print | LC_ALL=C sort | \
      while read -r rule_file; do sha256sum "$rule_file"; done) \
      > /tmp/semgrep-selected-files.sha256; \
    test "$(wc -l < /tmp/semgrep-selected-files.sha256)" = '2075'; \
    echo '67ebc323d193c658fa86ff175823e4aceee40bd822d5b34f1c1928cf8780a678  /tmp/semgrep-selected-files.sha256' | sha256sum -c -; \
    cp /tmp/semgrep-rules/LICENSE /out/licenses/semgrep-rules/LICENSE; \
    test ! -e /out/semgrep-rules-manifest/.pre-commit-config.yaml

# This target is selected only by the isolated acceptance compose profile.
FROM api AS api-acceptance
COPY --from=acceptance-semgrep /usr/local/ /usr/local/
COPY --from=acceptance-tools /out/bin/ /usr/local/bin/
COPY --from=acceptance-tools /out/licenses/ /opt/devpilot/security/licenses/
COPY --from=acceptance-tools /out/semgrep-rules-manifest/ /opt/devpilot/security/semgrep-rules-manifest/
COPY --from=acceptance-tools /out/trivy-cache/ /opt/devpilot/security/trivy-cache/
COPY apps/devpilot-api/security/semgrep-rule-manifest.txt /opt/devpilot/security/semgrep-rule-manifest.txt
ENV SEMGREP_SEND_METRICS=off
ENV SEMGREP_ENABLE_VERSION_CHECK=0
LABEL io.svton.devpilot.acceptance-profile="controlled-local-acceptance-v2" \
      io.svton.devpilot.pnpm-package="sha512:279278f83be782f6faaefbacbccc503301c4ec2cdafd40983e7c26aeeee7c38270f5c8e635b43464691b897abe1675b40c06df6edadde922532b7368aa9a5267" \
      io.svton.devpilot.semgrep-rules="40b8c63f75dc7c22c8a77482d73bfb864b146f7e" \
      io.svton.devpilot.semgrep-rule-manifest="sha256:cd087178050a0abf3664375e5c9a7f4bbc0810c59fa53771d44fd6467662c648" \
      io.svton.devpilot.trivy-db="sha256:e5c54b277db94d2973c2d4fdf68c94be8729a3d5fc2e48e7da04b6dacdf0bb71"
RUN gitleaks version | grep -F "8.30.1" \
 && semgrep --version | grep -F "1.172.0" \
 && trivy --version | grep -F "Version: 0.73.0" \
 && grep -F '2026-08-11T01:05:09.651160722Z' /opt/devpilot/security/trivy-cache/db/metadata.json \
 && printf 'const manifestProof = true;\n' > /tmp/semgrep-manifest-proof.ts \
 && awk '$1 == "path" { print $2 }' /opt/devpilot/security/semgrep-rule-manifest.txt | while read -r rule_path; do \
      semgrep scan --config "/opt/devpilot/security/semgrep-rules-manifest/$rule_path" \
        --metrics off --disable-version-check --json \
        --output /tmp/semgrep-manifest-proof.json /tmp/semgrep-manifest-proof.ts \
        || exit 1; \
      python -c "import json; value=json.load(open('/tmp/semgrep-manifest-proof.json')); assert not value.get('errors')" \
        || exit 1; \
    done
RUN mkdir -p /home /tmp/pnpm-offline-proof \
 && printf '{"name":"offline-proof","version":"1.0.0","private":true}\n' \
      > /tmp/pnpm-offline-proof/package.json \
 && printf "lockfileVersion: '6.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n" \
      > /tmp/pnpm-offline-proof/pnpm-lock.yaml \
 && chown -R 3000:3000 /home /tmp/pnpm-offline-proof
USER 3000:3000
ENV HOME=/home
RUN --network=none test "$("$PNPM_EXECUTABLE" --version)" = '8.12.0' \
 && "$PNPM_EXECUTABLE" install --offline --frozen-lockfile \
      --store-dir=/tmp/pnpm-offline-proof/store \
      --dir=/tmp/pnpm-offline-proof
USER root
RUN node -e "const fs=require('node:fs'); const p=require('./dist/release-delivery/release-build-acceptance-profile'); const s=require('./dist/release-delivery/release-build-supply-proof.policy'); const profile=p.resolveRegisteredReleaseBuildProfile('controlled-local-acceptance-v2'); fs.writeFileSync('/opt/devpilot/security/release-build-supply-proof.json', JSON.stringify(s.expectedReleaseBuildSupplyProof(profile)), {mode:0o444});" \
 && chmod 0444 /opt/devpilot/security/release-build-supply-proof.json
