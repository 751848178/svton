FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32

WORKDIR /app
COPY scripts/parity-route-control-provider.mjs /app/parity-route-control-provider.mjs
COPY scripts/lib/parity-route-control-domain.mjs /app/lib/parity-route-control-domain.mjs
COPY scripts/lib/parity-route-control-http.mjs /app/lib/parity-route-control-http.mjs
COPY scripts/lib/parity-route-control-policy.mjs /app/lib/parity-route-control-policy.mjs
COPY scripts/lib/parity-route-control-state-store.mjs /app/lib/parity-route-control-state-store.mjs
COPY scripts/lib/parity-route-control-upstream.mjs /app/lib/parity-route-control-upstream.mjs
RUN install -d -o node -g node -m 0700 /var/lib/route-control
USER node
