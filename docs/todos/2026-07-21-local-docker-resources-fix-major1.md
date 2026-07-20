# Fix spec — Finding 1 (MAJOR): docker-socket-proxy is NOT read-only

Source: `docs/todos/2026-07-21-local-docker-resources-cr.md` Finding 1 (lines 45-86).
Branch reviewed: `codex/local-docker-resources-s031`.
Investigation log: `/tmp/codex-tool-runs/svton/local-docker-resources-s031/fix-major1/`.

---

## 1. Verdict

**Option 1 (drop `POST: "1"` and `EXEC: "1"`).** Keep the proxy genuinely
read-only. This is the optimal fix because every dockerode call the Devpilot
code makes against `dockerApiHost` is read-only, so the write-unlock env vars
are pure attack surface with zero functional payoff.

The original rationale for `POST=1` — recorded in
`docs/todos/2026-07-21-local-docker-resources-plan.md:225-227` ("`exec`-based
probes (used by `docker-api-inventory-executor.ts`) need POST") — is
**factually false**. `docker-api-inventory-executor.ts` has no `.exec()` call.
The plan invented a code path that does not exist; the implementation copied
the env verbatim (`docker-compose.devpilot-staging.yml:142` carries the same
bogus comment). Once that false premise is removed, there is no remaining
argument for keeping `POST=1` or `EXEC=1`.

Option 2 (keep `POST=1`, reword docs, bind to `127.0.0.1`) was considered and
rejected: it permanently encodes a misleading "we need POST for exec probes"
claim into the runbook even though no such probes exist, and it leaves an
unnecessary host-escape primitive running on every dev's machine during `pnpm
dev`. The 127.0.0.1 binding from option 2 is still a good idea and is folded
into option 1 below.

---

## 2. Required env vars

After pruning, the docker-socket-proxy service should expose exactly:

```yaml
CONTAINERS: "1"   # GET /containers/json for listContainers
IMAGES: "1"       # GET /images/json — kept for future image inventory
INFO: "1"         # GET /info
VERSION: "1"      # GET /version (healthcheck + observability() smoke)
```

Drop:
- `EXEC: "1"` — no dockerode `.exec()` call exists in `apps/devpilot-api/src`.
- `POST: "1"` — no POST/PUT/DELETE method is invoked via dockerode.
- `NETWORKS: "1"` — no `listNetworks`/`createNetwork` call exists.
- `VOLUMES: "1"` — no `listVolumes`/`createVolume` call exists.

Note `NETWORKS`/`VOLUMES` are optional drops: keeping them costs nothing
functionally because without `POST=1` they are read-only GET endpoints, but
the slice has no code that consumes them. Pruning follows least-privilege; if
a future slice adds `docker.listNetworks()`, re-add the matching env at that
time.

---

## 3. Port binding policy

**Yes — all published staging ports should get the `127.0.0.1:` sit-prefix.**

Rationale: the existing repo convention is uniformly `0.0.0.0` (no prefix) —
verified by inspecting `git show HEAD~1:docker-compose.devpilot-staging.yml`
(pre-slice state) which has 4 published ports all without the prefix, and the
current `docker-compose.devpilot-staging.yml` which has 11 published ports all
without it (lines 16, 29, 46, 59, 75, 95, 111-112, 144, 159-160, 172, 183).
So "follow the convention" is *not* a reason to keep `0.0.0.0`; the convention
itself is the leak. Every one of these ports exposes an unauthenticated
service (mysql with `password`/`password`, minio with `minio12345`, mailhog
with no auth, the docker proxy) and a `pnpm dev` session on a laptop on a
shared LAN (cafe, office, conference) silently publishes all of them. The
fix-cost is one prefix per line; the rollback is trivial.

This change is in-scope for Finding 1 because Finding 1 explicitly recommends
it (`docs/todos/2026-07-21-local-docker-resources-cr.md:84-86`) and the
docker-socket-proxy port is the most sensitive of the lot (host-equivalent
access if `POST=1` is ever re-introduced). Doing only the proxy port and
leaving the rest at `0.0.0.0` would be a half-fix.

---

## 4. Concrete diff spec

### 4.1 `docker-compose.devpilot-staging.yml` — env block on `docker-socket-proxy`

File: `docker-compose.devpilot-staging.yml`, lines 131-151.

Old:
```yaml
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:0.3.0
    container_name: devpilot-g003-docker-socket-proxy
    environment:
      CONTAINERS: "1"
      INFO: "1"
      IMAGES: "1"
      EXEC: "1"
      VERSION: "1"
      NETWORKS: "1"
      VOLUMES: "1"
      POST: "1"            # needed for `docker exec` inventory probes
    ports:
      - "${DEVPILOT_STAGING_DOCKER_PROXY_PORT:-2376}:2375"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:2375/version >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
```

New:
```yaml
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:0.3.0
    container_name: devpilot-g003-docker-socket-proxy
    # Read-only docker daemon proxy. Only GET endpoints are unlocked below:
    # the only dockerode call site is `listContainers` (GET /containers/json)
    # in apps/devpilot-api/src/resource-control/inventory/executors/docker-api-inventory-executor.ts.
    # Do NOT re-add POST=1 / EXEC=1 unless a future slice adds a dockerode
    # `.exec()` / `.createContainer()` call site — there are none today.
    environment:
      CONTAINERS: "1"      # GET /containers/json — listContainers
      IMAGES: "1"          # GET /images/json   — future image inventory
      INFO: "1"            # GET /info
      VERSION: "1"         # GET /version (healthcheck + observability() smoke)
    ports:
      - "127.0.0.1:${DEVPILOT_STAGING_DOCKER_PROXY_PORT:-2376}:2375"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:2375/version >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
```

### 4.2 `docker-compose.devpilot-staging.yml` — prefix every other published port with `127.0.0.1:`

Lines to change (old → new):

- `:16` `"${DEVPILOT_STAGING_MYSQL_PORT:-3320}:3306"` → `"127.0.0.1:${DEVPILOT_STAGING_MYSQL_PORT:-3320}:3306"` (api-mysql)
- `:29` `"${DEVPILOT_STAGING_REDIS_PORT:-6384}:6379"` → `"127.0.0.1:${DEVPILOT_STAGING_REDIS_PORT:-6384}:6379"` (api-redis)
- `:46` `"${DEVPILOT_STAGING_RESOURCE_MYSQL_PORT:-3321}:3306"` → `"127.0.0.1:${DEVPILOT_STAGING_RESOURCE_MYSQL_PORT:-3321}:3306"` (resource mysql)
- `:59` `"${DEVPILOT_STAGING_RESOURCE_REDIS_PORT:-6385}:6379"` → `"127.0.0.1:${DEVPILOT_STAGING_RESOURCE_REDIS_PORT:-6385}:6379"` (resource redis)
- `:75` `"${DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT:-5433}:5432"` → `"127.0.0.1:${DEVPILOT_STAGING_RESOURCE_POSTGRES_PORT:-5433}:5432"`
- `:95` `"${DEVPILOT_STAGING_SSH_PORT:-2223}:2222"` → `"127.0.0.1:${DEVPILOT_STAGING_SSH_PORT:-2223}:2222"`
- `:111` `"${DEVPILOT_STAGING_MINIO_PORT:-9100}:9000"` → `"127.0.0.1:${DEVPILOT_STAGING_MINIO_PORT:-9100}:9000"`
- `:112` `"${DEVPILOT_STAGING_MINIO_CONSOLE_PORT:-9101}:9001"` → `"127.0.0.1:${DEVPILOT_STAGING_MINIO_CONSOLE_PORT:-9101}:9001"`
- `:159` `"${DEVPILOT_STAGING_SMTP_PORT:-1025}:1025"` → `"127.0.0.1:${DEVPILOT_STAGING_SMTP_PORT:-1025}:1025"` (mailhog SMTP)
- `:160` `"${DEVPILOT_STAGING_MAILHOG_HTTP_PORT:-8025}:8025"` → `"127.0.0.1:${DEVPILOT_STAGING_MAILHOG_HTTP_PORT:-8025}:8025"` (mailhog UI)
- `:172` `"${DEVPILOT_STAGING_NGINX_PORT:-18098}:80"` → `"127.0.0.1:${DEVPILOT_STAGING_NGINX_PORT:-18098}:80"`
- `:183` `"${DEVPILOT_STAGING_FAKE_PROVIDER_PORT:-19091}:19091"` → `"127.0.0.1:${DEVPILOT_STAGING_FAKE_PROVIDER_PORT:-19091}:19091"`

The `fake-provider` node command at `:204` still listens on `0.0.0.0` *inside*
the container — that's fine; the host-side `ports:` binding is now loopback
only.

### 4.3 Doc updates

- `scripts/devpilot-docker-staging.mjs:71` — change `matrix()` description from
  `"docker-socket-proxy on 127.0.0.1:2376 (read-only host daemon)"` to
  `"docker-socket-proxy on 127.0.0.1:2376 (GET-only docker daemon proxy; no POST/EXEC)"`.
  This makes the runtime self-description accurate. No code logic changes.

- `docs/devpilot/demo-runbook.md:357` — change table row description from
  "Read-only docker daemon target for `resource-control` dockerode inventory"
  to "GET-only docker daemon proxy (POST/EXEC disabled) for `resource-control`
  dockerode inventory — only `listContainers` is called."

- `docs/devpilot/resource-request-minimum-loop.md:93-98` — change
  "exposes the host docker daemon read-only" to "exposes the host docker
  daemon via GET-only endpoints (POST/EXEC disabled in the proxy env; the only
  dockerode call is `listContainers`)". Add a sentence: "All published staging
  ports bind to `127.0.0.1` so the stack is unreachable from the LAN."

- `docs/todos/2026-07-21-local-docker-resources-plan.md:225-227` — strike the
  false "`POST: "1"` ... needed because dockerode's `listContainers` is GET
  but `exec`-based probes (used by `docker-api-inventory-executor.ts`) need
  POST" note, replace with "POST=0 / EXEC=0 is sufficient because the only
  dockerode call site is `listContainers` (GET)."

### 4.4 Seed row stays as-is

`scripts/devpilot-docker-staging.mjs:190` keeps
`services: { dockerApiHost: "tcp://docker-socket-proxy:2375" }` — that's an
*intra-compose* hostname (resolved by docker DNS) and is unaffected by the
loopback host-side binding. Finding 2 is the one that concerns whether this
row is ever consumed; this fix doesn't touch it.

### 4.5 Healthcheck and observability smoke

No changes needed:
- The compose healthcheck at `:148` uses `http://127.0.0.1:2375/version` from
  *inside* the proxy container — that's a GET, requires `VERSION=1` only, still
  works.
- `scripts/devpilot-docker-staging.mjs:276` does
  `fetch("http://127.0.0.1:2376/version")` from the host — that's the host-side
  published port, still reachable on loopback after the prefix change, still a
  GET, still requires only `VERSION=1`.

---

## 5. Adversarial counter-arguments considered

### Counter-argument A: "Keep POST=1/EXEC=1 because a future slice might add dockerode exec/createContainer probes; re-adding env later is friction."

Rejected. Adding one env line (`POST: "1"`) is a 1-line change that should be
gated on the future code that needs it landing in the same PR — that's the
correct review moment to assess whether to expose the proxy at all. Keeping a
host-escape primitive live today "in case we need it later" violates
least-privilege and perpetuates the false comment trail that caused this
finding in the first place. The same logic applies to `EXEC=1`.

### Counter-argument B: "Option 2 is safer — keep POST=1, just reword the docs and bind to 127.0.0.1."

Rejected. Option 2 leaves the proxy in a strictly more-dangerous state than
option 1 (POST-enabled vs POST-disabled) while gaining nothing — every
dockerode call is read-only. Option 2's only advantage would be if a dockerode
write call existed, but none does. Option 2 also leaves the misleading
"needed for docker exec inventory probes" comment (or a reworded variant) in
the codebase forever, which is exactly the kind of stale rationalization that
got Finding 1 filed. We adopt option 2's `127.0.0.1:` binding into option 1
but not its other provisions.

### Counter-argument C: "Remove the docker-socket-proxy service entirely — the staging runner never invokes it."

Considered and rejected (for this slice). Evidence: the runner seeds a
`Server` row pointing at it (`scripts/devpilot-docker-staging.mjs:190`) and the
observability smoke pings it (`:276`). Removing the service would break the
observability probe and leave a dangling `Server` row. More importantly, the
*point* of the slice is to provide a real docker daemon target for manual
exploration of the dockerode inventory path, which is a stated goal in
`docs/todos/2026-07-21-local-docker-resources-investigation.md:170-172`. If a
follow-up decides the proxy isn't worth its keep, removing the whole service
is a cleaner cut than leaving it half-disabled. But that's a separate
decision from this fix.

### Counter-argument D: "Replace tecnativa/docker-socket-proxy with a custom nginx HAProxy ruleset we own."

Rejected — adds maintenance burden with no security gain over the
upstream-published image + correct env config. The tecnativa image is widely
deployed and the v0.3.0 tag is pinned.

---

## 6. Risk of the recommended fix

1. **Future dockerode write call sites will fail through the proxy.** If a
   later slice adds `.exec()`, `.createContainer()`, `.putArchive()` etc. via
   `DockerApiInventoryExecutor`, those calls will return 403 from the proxy.
   This is the *desired* failure mode — it forces the author of that change to
   consciously decide whether to re-enable `POST=1`/`EXEC=1` and document the
   exposure. Risk: low.

2. **`127.0.0.1:` prefix breaks anyone running the staging stack inside a VM
   or remote docker host and consuming the published ports from the host
   network.** If a developer runs docker on a remote machine and SSH-tunnels
   to specific ports, those tunnels still work (they hit loopback on the
   tunnel endpoint). If they were relying on `0.0.0.0` to reach the staging
   stack from another machine, that access breaks — which is the intended
   behavior. Risk: low; mitigation: mention in the runbook.

3. **`NETWORKS`/`VOLUMES` env removal might surprise someone who runs an ad-hoc
   `curl http://127.0.0.1:2376/networks` for debugging.** The fix makes those
   return 403. Risk: low; the original docs never advertised those endpoints
   as available.

4. **Healthcheck and `observability()` smoke must keep passing.** Both use
   `GET /version` which only requires `VERSION=1` (retained). Verified at
   `docker-compose.devpilot-staging.yml:148` and
   `scripts/devpilot-docker-staging.mjs:276`. Risk: none.

5. **No CI / test risk.** No test exercises the docker-socket-proxy
   (`docker-inventory-executor.factory.spec.ts` only unit-tests the factory's
   options extraction, not a live proxy; the staging runner is a manual
   script). Risk: none.

---

## 7. Investigation answers (file:line citations)

**Q1 — What dockerode calls does the code actually make?**
- `docker-api-inventory-executor.ts:31` is the **only** call site:
  `this.docker.listContainers({ all: true })`.
- `docker-inventory-executor.factory.ts:27` constructs the `Docker` instance.
- `resource-control-sync.service.ts:156` is the only consumer:
  `executor.listContainers({ teamId, serverId: server.id })`.
- dockerode source confirms `listContainers` is `GET /containers/json`
  (`node_modules/.pnpm/dockerode@5.0.1/node_modules/dockerode/lib/docker.js:455-460`).
- No `inspectContainer`, `createContainer`, `putArchive`, `getContainer().exec`,
  `listImages`, `listNetworks`, `listVolumes`, `startExec`, or `modem` call
  exists in `apps/devpilot-api/src` (verified via
  `/tmp/codex-tool-runs/svton/local-docker-resources-s031/fix-major1/dockerode-calls.log`).
- The `docker.container.*` strings (`resource-actions.ts:30,44,64,84`) and
  `server-script.executor.ts:102,110,120,129` are SSH-CLI commands (`docker
  inspect`, `docker logs`, `docker stats`, `docker restart`), not dockerode
  API calls — they go through `server-executor`, not the proxy.

**Q2 — Which env vars unlock which dockerode method?**
- `listContainers` → `GET /containers/json` → needs `CONTAINERS=1` only.
- The proxy v0.3.0 README documents `POST=0` as the default that makes the
  proxy read-only; with `POST=0` every unlocked endpoint group is GET/HEAD
  only. So `CONTAINERS=1` + `POST=0` is sufficient for `listContainers`.
- `IMAGES=1`, `INFO=1`, `VERSION=1` retained as cheap, GET-only, useful for
  future probes and the existing healthcheck.

**Q3 — Can the inventory flow work with POST=0?**
Yes. `collectServerDockerInventoryViaApi`
(`resource-control-sync.service.ts:153-163`) calls only
`executor.listContainers(...)`, which is GET-only. The factory
(`docker-inventory-executor.factory.ts:38`) constructs the executor with just
`{ host, port: 2376 }` — no dockerode option requires write capability.

**Q4 — Is `EXEC=1` actually used?**
No. There is no `container.exec`, `getContainer(...).exec`, `docker.exec`,
`startExec`, `demuxStream`, or `modem` call anywhere in `apps/devpilot-api/src`.
The `EXEC=1` was added based on the false claim in
`docs/todos/2026-07-21-local-docker-resources-plan.md:225-227`. The
investigation doc
(`docs/todos/2026-07-21-local-docker-resources-investigation.md:236`) had the
right env block (`CONTAINERS=1 INFO=1 IMAGES=1 EXEC=1 VERSION=1 NETWORKS=1
VOLUMES=1` — no `POST=1`); the plan then added `POST=1` on top with the
invented rationale.

**Q5 — Port-binding convention?**
The pre-slice file (`git show HEAD~1:docker-compose.devpilot-staging.yml`)
has 4 published ports, all `0.0.0.0` (no `127.0.0.1:` prefix). The current
file has 11 published ports, all `0.0.0.0`. There is **one** compose file in
the repo (`docker-compose.devpilot-staging.yml`); no `docker-compose.devpilot-app.yml`
exists. So the "existing convention" is uniformly `0.0.0.0` — i.e. the
convention is itself the leak Finding 1 calls out.

**Q6 — What does the staging runner actually do with the proxy?**
Two things, both read-only GETs:
1. Seeds a `Server` row with `services.dockerApiHost =
   "tcp://docker-socket-proxy:2375"` (`scripts/devpilot-docker-staging.mjs:190`)
   — no API call ever invokes `syncServerDocker` against it during the run.
2. `observability()` does `fetch("http://127.0.0.1:2376/version")`
   (`scripts/devpilot-docker-staging.mjs:276`) — GET, status code only.
The proxy is **never** used for `POST`/`EXEC` by the runner. The slice's
purpose for the proxy is purely "manual exploration target" for the dockerode
inventory path, which is itself only GET.

---

## Sources

- Code citations are all relative to the repo root and live on branch
  `codex/local-docker-resources-s031`.
- [tecnativa/docker-socket-proxy v0.3.0 README](https://github.com/tecnativa/docker-socket-proxy/blob/v0.3.0/README.md)
  — confirms `POST=0` default and per-endpoint env semantics.
