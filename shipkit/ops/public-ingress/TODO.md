# Public ingress bounded module

Scope: one root-owned host relay for an existing NPM vhost. No NPM, Docker, business restart, Server network change or machine ingress enablement.

- [x] Strict nonsecret config; fixed own paths, ports and namespace; root-only execution.
- [x] Fixed NPM full CID/network/source/gateway; current Server healthy and only loopback publish.
- [x] Scoped INPUT chain: only configured NPM source on docker0; precise ownership and interrupted-install recovery.
- [x] Guard before socket activation; foreign chain/jump refuses; rollback only exact own artifacts after listener stops.
- [x] Parameterized units and private local candidate; repository contains no deployed IP/CID.
- [x] Pure faults, parsed unit templates, Python 3.6 grammar; root performs target runtime acceptance later.

Boundary: fixed source-IP admission applies while running. Same-IP replacement is detected on startup/explicit verify, not continuously. Machine authorization must not rely on this relay or NPM IP/CID.

- [x] Target systemd parser accepted all three units; own socket/relay/guard are active with no drop-ins.
- [x] Target NPM reaches the gateway relay: homepage and `/api/health` return 200; all 12 existing containers and the original Docker/Agent/Server unit lifecycle state match the baseline.
- [ ] Public HTTPS/browser acceptance: DNS/TLS work, but the owner-managed NPM vhost still targets gateway port `28769`; change its upstream port to `28770` before retesting.
- [ ] Cross-bridge denial and boot readiness replay.

Runtime fixes retain bounded output and use only scoped dedicated-chain queries, with kernel reference counts and precise missing-chain classification. Pure suite: 25 passed. Deployment identities and detailed target evidence stay in the private operational record.
