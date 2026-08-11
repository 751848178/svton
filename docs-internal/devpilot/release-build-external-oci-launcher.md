# External OCI release-build launcher

`controlled-local-acceptance-v2` only becomes available when the API observes a
fresh, HMAC-authenticated `external-oci-launcher-v1` heartbeat. The launcher is a
trusted host process. It is deliberately not a Compose service and neither the
API nor any worker container receives a Docker socket.

## Trust and execution boundary

- The API publishes an exact-commit archive and signed request into the host
  input root. Repository history and API credentials are not included.
- The trusted launcher validates the request, manifest, registered profile,
  pinned supply proof and fixed local scanner executables before publishing a
  heartbeat.
- Repository commands run only in one immutable `repo@sha256` image per job.
  The launcher supplies the image, mounts and command; project input cannot
  replace them.
- The job container has a private PID namespace, `network=none`, read-only root,
  all capabilities dropped, `no-new-privileges`, UID/GID 3000, and bounded
  CPU, memory and processes. It sees only control/source read-only and its own
  work/output read-write directories.
- On success, failure, cancellation or timeout the launcher kills and removes
  the whole container before validating and promoting artifacts or signing the
  final result. A missing or stale heartbeat keeps readiness unavailable.

Nested `bubblewrap` is not used: Docker's default seccomp/user-namespace
combination cannot provide the required boundary without unsafe elevated
capabilities. The earlier same-container UID runner remains test-fixture-only.

## Host installation contract

1. Build the `api-acceptance` target, push it to the controlled registry, resolve
   its immutable manifest digest, and set `RELEASE_BUILD_LAUNCHER_JOB_IMAGE` to
   that exact `repo@sha256` reference. Mutable tags are rejected.
2. Install the registered scanner/package executables and immutable security
   data at the paths frozen in `release-build-acceptance-profile.ts`. Install the
   matching supply proof as a root-owned, non-writable file.
3. Create a root-owned 32-byte-or-longer HMAC secret file. The API receives the
   same file through a read-only Compose secret; the job container never sees it.
4. Configure absolute, non-overlapping input/output/work roots plus a proof path
   in `/etc/devpilot/release-build-launcher.env`, then install the example systemd
   unit from `infra/systemd/`.
5. Start the launcher before the acceptance Compose profile. Bind the same host
   input/output/proof-directory paths into the API through the required Compose
   variables. The proof is a directory bind, so atomic heartbeat replacements
   are visible inside the API container.

Every configured input, output, work, heartbeat proof, HMAC secret, supply proof,
Docker executable and scanner/package executable path must already exist. The
launcher resolves every path segment without following symlinks, verifies the
expected owner/mode/type, and rejects any pair of paths where one contains the
other. Its startup script intentionally does not call `install -d`, `mkdir` or
change ownership: host provisioning is a separate privileged operation.

`RELEASE_BUILD_LAUNCHER_INSTANCE_LABEL` is stable across restarts of one launcher
installation. Startup removes only containers with that exact label. SIGTERM or
SIGINT aborts the current job; Docker kill/remove completes before systemd's
bounded stop timeout expires. The broker scans the read-only source mount first,
then copies it into its private writable `/work/build` tree for package install,
build and artifact collection. Repository commands never mutate `/source`.

The host acceptance run must retain the launcher log, exact job image digest,
heartbeat proof, Docker inspect evidence and focused build result. Failure to
prove any of them is a product blocker, never a passed or deferred gate.
