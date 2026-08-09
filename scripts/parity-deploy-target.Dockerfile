FROM lscr.io/linuxserver/openssh-server@sha256:96b9a4d3b5106746d08d43a6911650d4d21f7d5c7f2ac9660e792bdb5e63157c

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

COPY --chmod=755 scripts/deploy-target-parity-init.sh /custom-cont-init.d/99-install-tools.sh
