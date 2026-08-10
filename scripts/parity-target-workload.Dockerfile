FROM nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752

ARG PARITY_SOURCE_REVISION=unverified
ARG PARITY_SOURCE_TREE_SHA256=unverified
ARG PARITY_RUNTIME_ID=default
ARG PARITY_GOAL_ID=unverified
ARG PARITY_CLEANUP_OWNER_TOKEN=unverified
LABEL org.opencontainers.image.revision=$PARITY_SOURCE_REVISION \
  io.svton.devpilot.source-tree-sha256=$PARITY_SOURCE_TREE_SHA256 \
  io.svton.devpilot.runtime-id=$PARITY_RUNTIME_ID \
  io.svton.devpilot.goal-id=$PARITY_GOAL_ID \
  io.svton.devpilot.cleanup-owner-token=$PARITY_CLEANUP_OWNER_TOKEN

COPY fixtures/parity-target-site/ /usr/share/nginx/html/
