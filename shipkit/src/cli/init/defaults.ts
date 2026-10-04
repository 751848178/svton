// Default resolution for the wizard's machine/app questions (M1-02/R1/R4).
// Machine URL + token defaults are bound as one group so a token is never
// prefilled for an endpoint it does not belong to, and runtime groups are
// resolved per the target the user actually chooses (R1). A still-valid draft
// is NEWER intent than the unchanged file, so draft answers win over file values.
// M2-05: a connection group carries its credential REFERENCE alongside the
// resolved plaintext, so an unchanged rerun keeps `tokenRef` in the config
// instead of silently rewriting it into a plaintext long-term secret.

import path from 'node:path';
import type { ShipConfig, ShipSpec } from '../../shared/types.js';
import type { CredentialEntry } from '../../shared/credentials.js';
import type { Detection } from './detect.js';
import type { InitState } from './state.js';
import type { ResumeDecision } from './defaults-resume.js';

/** one machine connection: URL + how its token is referenced (M2-05) */
export interface TargetConn {
  url: string;
  /** resolved plaintext, prefill-only; never written when tokenRef survives */
  token?: string;
  /** credential name in ~/.ship/credentials.json the token came from */
  tokenRef?: string;
  /** CA file pinned by that credential (for live checks; never written to config) */
  caFile?: string;
}

export interface MachineDefaults {
  builderUrl?: string;
  builderToken?: string;
  builderTokenRef?: string;
  builderCaFile?: string;
  targetName?: string;
  /** draft-only URL for a target that has no config entry yet (state never stores tokens) */
  priorRuntimeUrl?: string;
  /** live config targets; askMachines resolves the group after targetName is picked (R1) */
  runtimeTargets: Record<string, TargetConn>;
}

function credOf(creds: Record<string, CredentialEntry> | undefined, ref: string | undefined): CredentialEntry | undefined {
  return ref ? creds?.[ref] : undefined;
}

/** builder group may be draft-only (URL without any token information) */
type BuilderConn = { url?: string; token?: string; tokenRef?: string; caFile?: string };

export function machineDefaults(
  config: ShipConfig | null,
  prior: InitState | null,
  /** contents of ~/.ship/credentials.json, read once by the caller (pure resolver here) */
  creds?: Record<string, CredentialEntry>,
): MachineDefaults {
  const static_ = config?.builder?.mode === 'static' ? config.builder.static : undefined;
  const builderEntry = static_ ? credOf(creds, static_.tokenRef) : undefined;
  const builder: BuilderConn = static_
    ? { url: static_.url, token: static_.token ?? builderEntry?.token, tokenRef: static_.tokenRef, caFile: builderEntry?.caFile }
    : { url: prior?.machines?.builderUrl };
  const runtimeTargets: Record<string, TargetConn> = {};
  if (config) {
    for (const [n, t] of Object.entries(config.runtime.targets)) {
      const entry = credOf(creds, t.tokenRef);
      runtimeTargets[n] = { url: t.url, token: t.token ?? entry?.token ?? '', tokenRef: t.tokenRef, caFile: entry?.caFile };
    }
  }
  const names = Object.keys(runtimeTargets);
  const priorName = prior?.machines?.targetName;
  return {
    builderUrl: builder.url,
    builderToken: builder.token,
    builderTokenRef: builder.tokenRef,
    builderCaFile: builder.caFile,
    targetName: names.find((n) => n === priorName) ?? names[0] ?? priorName,
    priorRuntimeUrl: prior?.machines?.runtimeUrl,
    runtimeTargets,
  };
}

export interface AppDefaultsSrc {
  name?: string;
  nameSource: string;
  dockerfile?: string;
  existingPorts?: string[];
  priorPorts?: string[];
  healthcheckPath?: string;
  healthcheckHostPort?: number;
  envFile?: string;
}

/** app-question prefill: a still-valid draft (cleared fields included) outranks
 *  the unchanged file; a stale/absent draft falls back to the file and detection */
export function appDefaults(spec: ShipSpec | null, prior: InitState | null, det: Detection, resume: ResumeDecision): AppDefaultsSrc {
  const draft = resume.useApp ? prior?.app : undefined;
  const specLabel = det.existingSpecPath ? `现有 ${path.basename(det.existingSpecPath)}` : '';
  return {
    name: draft?.name ?? spec?.name ?? det.nameCandidates[0]?.value,
    nameSource: draft?.name ? '上次 init 进度' : spec?.name ? specLabel : det.nameCandidates[0] ? `检测（${det.nameCandidates[0].source}）` : '无检测候选，请输入',
    dockerfile: draft?.dockerfile,
    existingPorts: spec?.ports,
    priorPorts: draft ? draft.ports : undefined, // draft-first, [] included (R4)
    healthcheckPath: draft ? draft.healthcheckPath ?? undefined : spec?.healthcheck?.path,
    healthcheckHostPort: draft ? draft.healthcheckHostPort ?? undefined : spec?.healthcheck?.hostPort,
    envFile: draft ? draft.envFile ?? undefined : spec?.envFile,
  };
}
