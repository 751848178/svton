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

const USAGE = `ship v${SHIP_VERSION} — lightweight build/push/deploy controller

commands:
  ship build [--from-dir DIR | git repo of cwd] [--tag TAG] [--keep-builder] [--timeout-min N]
      trigger the builder agent: docker build + push to the registry
  ship deploy [--ref IMAGE] [--app NAME] [--to TARGET] [--env-file FILE | --keep-env] [--timeout-min N]
      trigger the runtime agent: pull + compose up + healthcheck (+ auto recovery to previous release)
  ship release [flags of build+deploy]
      build + push + deploy in one shot
  ship rollback <app> [--to TARGET]
      roll the target back to its previous release snapshot (image + env + config)
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

async function main(): Promise<number> {
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
