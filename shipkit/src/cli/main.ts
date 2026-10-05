#!/usr/bin/env node
// ship — the controller CLI. Drives build/push/deploy through agents' open HTTP APIs (no SSH).

import { SHIP_VERSION } from '../shared/types.js';
import { SpecError } from '../shared/spec-schema.js';
import { ConfigError } from '../shared/config.js';
import { ApiError } from '../shared/http.js';
import { CliError } from './errors.js';
import { cmdBuild } from './cmd-build.js';
import { cmdRelease } from './cmd-release.js';
import { cmdDeploy } from './cmd-deploy.js';
import { cmdRollback } from './cmd-rollback.js';
import { cmdStatus } from './cmd-status.js';
import { cmdDoctor } from './cmd-doctor.js';
import { cmdBuilder } from './cmd-builder.js';
import { cmdServeBundle } from './cmd-serve-bundle.js';
import { cmdGc } from './cmd-gc.js';
import { cmdInit } from './cmd-init.js';
import { cmdPair } from './cmd-pair.js';
import { cmdVerifyRegistry } from './cmd-verify-registry.js';

const USAGE = `ship v${SHIP_VERSION} — lightweight build/push/deploy controller

commands:
  ship init [--json]
      guided first-time setup: detect the app, connect installed agents,
      generate ship.yaml + ship.config.yaml (config only — never deploys)
  ship pair <agent-url> [--name NAME] [--code CODE] [--ca-file PATH]
      exchange a one-time pairing code (minted on the machine by the admin) for a
      role-scoped long-term token stored in ~/.ship/credentials.json (via tokenRef)
  ship verify-registry [--to TARGET] [--json]
      distribute registry credentials by role and PROVE push (builder) + pull (runtime)
      with a named test image; reports reachability / distribution / push / pull levels
  ship build [--from-dir DIR | git repo of cwd] [--tag TAG] [--keep-builder] [--timeout-min N]
      trigger the builder agent: docker build + push to the registry
      multi-service projects (schemaVersion: 2): build every service, or --services a,b
  ship deploy [--ref IMAGE] [--app NAME] [--from-dir DIR] [--to TARGET] [--env-file FILE | --keep-env] [--timeout-min N]
      trigger the runtime agent: pull + compose up + healthcheck (+ auto recovery to previous release)
  ship release [flags of build+deploy] [--services a,b] [--plan]
      build + push + deploy in one shot; multi-service projects add:
        --services admin          release ONLY these services (default: all)
        --plan                    read-only plan (with --json): selection, inherited
                                  versions, external resources — builds nothing
  ship rollback <app|group> [--from-dir DIR] [--to TARGET] [--services a,b]
      roll the target back: v1 = previous release snapshot (image + env + config);
      v2 groups = undo the last release's changedServices, or an explicit --services set
  ship status [--to TARGET|all]
      apps + versions on runtime targets
  ship doctor
      local + remote readiness checks (read-only)
  ship builder up|down|status
      manage the builder machine (dynamic create/release; static is bound)
  ship serve-bundle --host <controller-ip> [--minutes N]
      serve the agent installer to bootstrap bound machines
  ship gc [--to TARGET] [--execute]
      preview (or execute) release-ledger-aware image cleanup on a runtime target

global flags:
  --config PATH   controller config (default: ./ship.config.yaml, then ~/.ship/config.yaml)
  --json          machine-readable output: payload on stdout, progress logs on stderr

exit codes:
  0 ok · 1 doctor found problems · 2 usage/config/spec error · 3 agent unreachable
  4 job failed (no recovery) · 5 deploy failed, recovered to previous version
  6 deploy failed AND recovery failed — inspect the agent job log
`;

const COMMANDS: Record<string, (argv: string[]) => Promise<number>> = {
  init: cmdInit,
  pair: cmdPair,
  'verify-registry': cmdVerifyRegistry,
  build: cmdBuild,
  release: cmdRelease,
  deploy: cmdDeploy,
  rollback: cmdRollback,
  status: cmdStatus,
  doctor: cmdDoctor,
  builder: cmdBuilder,
  'serve-bundle': cmdServeBundle,
  gc: cmdGc,
};

/** stable error → exit-code mapping (F28) */
function mapError(e: unknown): { code: string; exit: number } {
  if (e instanceof CliError) return { code: 'cli_error', exit: e.exitCode };
  if (e instanceof ApiError) return { code: e.status === 0 ? 'network_error' : 'agent_error', exit: 3 };
  if (e instanceof SpecError) return { code: 'invalid_spec', exit: 2 };
  if (e instanceof ConfigError) return { code: 'invalid_config', exit: 2 };
  return { code: 'internal_error', exit: 2 };
}

const MIN_NODE_MAJOR = 20;

/** clear guidance instead of a syntax crash on old runtimes; never touches the user's Node install */
function nodeVersionGuard(): number | null {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= MIN_NODE_MAJOR) return null;
  const current = process.versions.node;
  process.stderr.write(
    `ship requires Node.js >= ${MIN_NODE_MAJOR} (current: v${current}).\n` +
    `Upgrade Node yourself (e.g. via nvm, volta or your system package manager) and re-run ship.\n` +
    `ship will not modify your Node environment.\n`,
  );
  return 2;
}

async function main(): Promise<number> {
  const guard = nodeVersionGuard();
  if (guard !== null) return guard;
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    process.stdout.write(USAGE);
    return 2;
  }
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
    return 2;
  }
  const json = rest.includes('--json');
  try {
    return await fn(rest);
  } catch (e) {
    const mapped = mapError(e);
    const message = e instanceof Error ? e.message : String(e);
    if (json) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: { code: mapped.code, exitCode: mapped.exit, message } }, null, 2)}\n`);
    } else {
      process.stderr.write(`${message}\n`);
    }
    return mapped.exit;
  }
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  },
);
