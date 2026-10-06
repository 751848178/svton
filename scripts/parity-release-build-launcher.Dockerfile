ARG PARITY_API_IMAGE=devpilot-parity-api:local

FROM docker@sha256:5e4f578fbee0c884a4ba1b42a2025251c1e5946279a212d39d3cb23913c86c45 AS docker-cli
FROM ${PARITY_API_IMAGE}

USER root
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY scripts/devpilot/run-release-build-external-oci-launcher.sh /usr/local/bin/devpilot-release-build-launcher
RUN chmod 0555 /usr/local/bin/docker /usr/local/bin/devpilot-release-build-launcher

WORKDIR /app
ENTRYPOINT ["/usr/local/bin/devpilot-release-build-launcher"]
