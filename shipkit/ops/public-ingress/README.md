# Public HTTPS upstream

This module supplies a single host TCP relay for an existing Nginx Proxy Manager
(NPM) vhost. NPM forwards HTTP to its approved bridge gateway on port `28770`;
the relay forwards to Shipkit's existing `127.0.0.1:28769` publication.
The Shipkit container stays on its original control network. NPM and other
applications keep their existing networks and configuration.

## Configuration and boundary

Generate a private configuration with exactly these fields:

```json
{
  "version": 1,
  "npmContainerId": "<full approved 64-character container ID>",
  "npmNetworkId": "<full approved 64-character default bridge network ID>",
  "npmAddress": "<approved NPM RFC1918 IPv4 address>",
  "npmGateway": "<approved default bridge gateway IPv4 address>"
}
```

The runtime path is fixed at `/etc/shipkit-public-ingress/config.json`, under a
root-owned `0700` directory, with a root-owned regular `0600` file. Symlinks,
hard links, duplicate fields, unknown fields and oversized files are refused.
The guard also owns an immutable configuration-bound `ownership.json` receipt
there. It does not accept configuration, executable or state paths from the
environment or command line.

Startup and explicit `verify` require the full NPM container ID to be running,
unpaused and on the approved default `bridge`/`docker0` network with its frozen
network ID, address and gateway. The current Compose-managed Shipkit `server`
must be healthy, on only `shipkit-control`, and publish only the original
loopback endpoint. Its container ID may change during normal self deployment.
Inspection projects only the required metadata; it reads no Env, Cmd or keys.

`SHIPKIT-INGRESS` admits only the configured NPM source IPv4 arriving on
`docker0`. Its sole first INPUT jump targets only the configured gateway and
port `28770`. Rules carry the module marker and an ownership receipt. Unknown
rules, references or ownership cause refusal; no chain is flushed. The original
control guard, DOCKER-USER and existing business rules are untouched.

This is source IP admission for the human web upstream, not continuous machine
identity authentication. A different source IP is immediately dropped. A
replacement NPM container retaining the same IP is detected only at startup or
explicit verification. Machine ingress remains disabled and must use its own
TLS/edge proof and credential controls when separately enabled.

## Prepare and install

1. Record existing container IDs/lifecycle state and the existing INPUT rules.
   Confirm the configured NPM ID/network/address, the healthy Shipkit upstream,
   the unused candidate listen port and `/usr/lib/systemd/systemd-socket-proxyd`.
2. Run `python3 render_candidate.py private-config.json new-private-directory`
   locally. The new directory and files are private and creation is exclusive.
   Copy the five runtime sources alongside the rendered configuration/units.
   Keep a file SHA256 manifest and the existing artifacts for rollback.
3. Refuse foreign existing files/units/rules in the new namespace. Install the
   runtime sources root-owned under `/usr/local/lib/shipkit-public-ingress`,
   configuration as described above, and the three rendered units root-owned
   under `/etc/systemd/system`. Runtime scripts must not be writable by other
   users. Do not install an ownership receipt manually.
4. Run target `systemd-analyze verify` on all three units; check their loaded
   fragments and that no unexpected drop-ins apply. Reload systemd, then start
   the dedicated socket. Its guard runs first and establishes only its rules.
   The TCP relay runs as `nobody` without capabilities, with a read-only system
   and restricted address families. Only its explicit verification precheck
   runs as root. Python ignores environment/site injection and PATH is fixed.
5. From the existing NPM container, make a bounded HTTP request to the configured
   gateway on `28770` and require `200 /api/health`. Verify the effective listener,
   admission rule counters, public HTTPS certificate/health, login and secure
   session cookie. Probe a different bridge source and require refusal. Compare
   the original NPM/Docker/business lifecycle state to the recorded baseline.

NPM's new vhost uses HTTP, the configured bridge gateway, port `28770`, and the
intended HTTPS domain. Existing vhosts are not changed. Shipkit must separately
persist `SHIPKIT_PUBLIC_ORIGIN=https://<the exact browser domain>` through its
normal configuration/deployment path. HTTPS makes the human cookie Secure;
the previous HTTP browser origin stops being a valid login origin.

The socket dependencies request Docker and the existing Shipkit Server before
the guard; there is no `PartOf` restart cascade. A Server unit may complete while
its container health is still starting. The guard refuses until healthy; this
module does not claim a complete boot/readiness replay. Retry the own socket
after the existing Server is healthy. Do not restart Docker or business units.

## Rollback

1. Stop only `shipkit-public-ingress.socket` and
   `shipkit-public-ingress.service`; stop the own guard and disable the own
   socket. Confirm port `28770` has no listener.
2. Run `/usr/bin/python3 -E -s
   /usr/local/lib/shipkit-public-ingress/guard.py rollback` as root. This refuses
   an active listener, verifies the receipt and all exact rules/references,
   removes only its jump/rules/empty chain, then removes its receipt.
3. Remove only this module's exact owned units/files and reload systemd. Restore
   the old Shipkit public-origin configuration through normal deployment if
   needed. The owner handles only the new NPM vhost, keeping other vhosts intact.

## Verification evidence

The Python tests use in-memory command schedules, temporary private files and
parameterized unit parsing. They execute no Docker, iptables or systemd commands
and include Python 3.6 grammar and source size checks. Actual target unit parsing,
relay traffic, cross-bridge denial, HTTPS/browser acceptance and boot behavior
are separate operational checks; a passing pure suite does not prove them.
