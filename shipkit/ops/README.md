# Offline operations and portable Linux examples

This directory is an optional operations layer. It does not install services, select a server, obtain certificates, start Agent jobs, or switch live data. Python 3.9+ and its standard-library `sqlite3` module are required; no Python dependency installation is needed.

## Linux service setup

Build a frozen checkout with its lockfile before using `--reuse-build`. Keep code, persistent data, and private configuration in separate directories. Configure the actual service account, absolute Node/pnpm paths and code directory in `shipkit-platform.service.example`; configure absolute data paths and the HTTPS origin in a private copy of `platform.env.example` (0600). `DATABASE_URL` and `SHIPKIT_DATA_DIR` must point to the same `platform.db` layout for these backup tools.

The service example runs the existing platform supervisor, restarts failures, and stops its local process group. Enabling the installed unit provides boot startup. Unit installation/enablement and changes to the selected host need deployment authorization. Stopping this service does not cancel or stop remote Agent jobs: finish or cooperatively cancel tasks in the platform first.

`nginx-https.conf.example` proxies HTTPS to the loopback Web port 8769. Supply the chosen domain and existing certificate/key paths; it neither issues certificates nor exposes API port 8770. Set `SHIPKIT_PUBLIC_ORIGIN` to exactly that HTTPS origin. Login configuration and Agent/cloud credential references follow their own private setup; the example contains no real credentials.

The platform launcher and backup share `DATA/.ops.lock`: an exclusive-created 0600 JSON file with `{pid,purpose}`. The launcher must hold it before build/migration until all children exit. Backup holds it for its entire operation. An existing lock always refuses the operation; scripts never delete a stale lock automatically. Confirm all recorded processes and service state are stopped before manually repairing a stale lock. Direct API starts or filesystem writers that bypass this lock must also be stopped by the operator.

## Offline backup and verify

Stop the platform service and confirm it is inactive. A saved `runtime.json` PID that still exists is conservatively rejected, including a reused PID. Any active task, unresolved `activeScope`, unfinished interrupted task, or releasing cleanup is rejected even after the process is stopped: restore/reconcile the platform first, then finish that work before maintenance.

```sh
python3 shipkit/ops/platform_ops.py backup \
  --source /ABSOLUTE/DATA/DIRECTORY \
  --output /ABSOLUTE/BACKUPS/shipkit-YYYYMMDD
python3 shipkit/ops/platform_ops.py verify \
  --backup /ABSOLUTE/BACKUPS/shipkit-YYYYMMDD
```

The output must not exist, its parent must exist, and it cannot be inside the source directory. The tools reject symlinks in the database, sidecars and copied log trees. SQLite's backup API produces a self-contained `platform.db`, including committed WAL content; direct copying of a live `.db` is not used. All indexed `logs/` and all `process-logs/` files are retained. Every archive must exist, be complete, have the recorded byte count, and be indexed exactly once; missing, extra, incomplete or mismatched task logs refuse backup. Source database changes during backup also refuse it. A failed attempt removes only its newly created output directory and its own lock.

`SHA256SUMS` covers every backup file. Verification rejects missing/extra files, changed hashes, unsafe paths, SQLite integrity/foreign-key errors and database/log mismatches. It does not authenticate an untrusted backup whose files and checksum list were intentionally rewritten; store backups in a trusted private location. These tools do not delete old archives or implement retention. Copy verified backups to an independently protected location according to the chosen retention policy.

## Restore drill; no live switch

```sh
python3 shipkit/ops/platform_ops.py restore \
  --backup /ABSOLUTE/BACKUPS/shipkit-YYYYMMDD \
  --destination /ABSOLUTE/NEW/DATA/DIRECTORY
python3 shipkit/ops/platform_ops.py verify \
  --backup /ABSOLUTE/NEW/DATA/DIRECTORY
```

The destination must be a new nonexistent directory with an existing parent. Even an existing empty directory is refused. Restore verifies the original snapshot first, copies into that new directory and verifies the copy. It then deletes every `AuthSession` row in the restored copy, regenerates `SHA256SUMS` and verifies again. All users must log in again after recovery; restoring an older database cannot reactivate a logged-out cookie. Legacy databases without `AuthSession` are supported. The source backup remains unchanged; task/log/audit records are preserved. A failed attempt removes only the directory it created. Restore does not stop/start services, update `DATABASE_URL`, overwrite old data, migrate schemas, or perform a live switch. `runtime.json` and `.ops.lock` are not restored.

For an actual recovery, keep the original data and matching frozen code version, validate the restored directory, restore separately required references, then choose a maintenance window to change the service data paths. Migration and service restart remain explicit deployment operations. Project root/config paths in the database remain unchanged; moving to another host needs those referenced paths restored or consciously remapped.

## Recovery boundaries

This backup contains platform SQLite records and archived/process logs. It does not contain project source, referenced private configuration/env/credential files, cloud lease state stored elsewhere, TLS keys, SSH bridge setup, Agent data or Agent rollback snapshots, application containers, or business databases/volumes. Back up those owners separately. Restoring platform history cannot recreate a remote rollback snapshot already expired or deleted, and does not restore a business database.

## Local tests

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s shipkit/ops -p 'test_*.py'
```

Tests use temporary SQLite/log fixtures only. They verify restored rows and log bytes, session revocation without source-backup or business-row changes, corruption refusal, running PID/lock refusal, active/unresolved task refusal, database/log mismatches, symlink/path escape rejection and existing-destination preservation. No live services, production data or cloud APIs are used.

The HTTPS example adds login rate limiting using nginx TCP client IP. The API intentionally does not trust arbitrary forwarded-IP headers; behind the loopback proxy, its peer login budget is shared (50 attempts/10 minutes), plus a per-account budget. This MVP assumes a small trusted operator group. Adjust edge limits for the selected deployment without removing backend protection.
