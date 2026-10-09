// Cross-cutting contracts shared by the controller CLI and the machine agents.
export type { Job, JobType, JobStatus, JobEvent, JobPhase, JobLogPage, JobEventsPage } from './job-protocol.js';

export const SHIP_VERSION = '0.5.0';

export type AgentRole = 'builder' | 'runtime' | 'both';

/** Per-project delivery spec (ship.yaml). Validated by shared/spec-schema.js. */
export interface ShipSpec {
  /** app name, doubles as the image repository name */
  name: string;
  /** relative to repo root, default 'Dockerfile' */
  dockerfile?: string;
  /** build context dir relative to repo root, default '.' */
  context?: string;
  /** Dockerfile build target (multi-stage builds); default = the final stage */
  target?: string;
  /** explicit image platform, e.g. linux/amd64; default = builder native */
  platform?: string;
  /** 'strict' (default): only public bake-time build args, mirroring devpilot buildEnvironment rules */
  buildArgsPolicy?: 'strict' | 'open';
  buildArgs?: Record<string, string>;
  /** 'HOST:CONTAINER' or 'CONTAINER' */
  ports?: string[];
  /** declares a runtime env file; content is delivered via the deploy API, never through the builder */
  envFile?: string;
  healthcheck?: { path?: string; hostPort?: number; timeoutSeconds?: number };
}

export type BuildSource =
  | { type: 'git'; repo: string; ref?: string; token?: string }
  | { type: 'tarball'; id: string };

export interface BuildRequest {
  operationId?: string;
  source: BuildSource;
  spec: ShipSpec;
  tag?: string;
}

export interface BuildResult {
  name: string;
  tag: string;
  localImage: string;
  sha?: string;
  /** normalized os/arch of the built image, e.g. 'linux/amd64' (platform gate) */
  arch?: string;
}

export interface PushRequest {
  operationId?: string;
  name: string;
  tag: string;
  registry?: string;
  namespace?: string;
}

export interface PushResult {
  imageRef: string;
  digest?: string;
}

export interface DeployRequest {
  app: string;
  /** project identity (source.repo / origin / local digest); binds (project, env) — a
   *  different project OR environment is REFUSED, never silently shared */
  project: string;
  /** environment identity: the runtime target name (e.g. prod/staging) */
  env: string;
  imageRef: string;
  spec: ShipSpec;
  envFileContent?: string;
  keepEnv?: boolean;
}

/** outcome of a deploy/rollback job; recovery is reported only when it was actually attempted (F04) */
export interface DeployResult {
  app: string;
  imageRef: string;
  releaseId: string;
  previousReleaseId?: string | null;
  verification?: 'passed' | 'skipped';
  recovery?: { attempted: true; succeeded: boolean; target: string | null };
}

export interface RollbackRequest {
  app: string;
  /** must match the (project, env) bound to the app (see DeployRequest) */
  project: string;
  env: string;
}

export interface AgentHealth {
  ok: true;
  role: AgentRole;
  version: string;
  docker: boolean;
}

export interface AppStatus {
  app: string;
  current: string | null;
  previous: string | null;
  currentReleaseId?: string | null;
  previousReleaseId?: string | null;
  updatedAt?: string;
}

export interface AgentStatus {
  role: AgentRole;
  version: string;
  workRoot: string;
  docker: boolean;
  apps?: AppStatus[];
  /** v2 multi-service release groups on this runtime */
  groups?: Array<{ app: string; currentReleaseId: string | null; updatedAt?: string }>;
  activeJobs?: number;
  /** what the CALLING credential may actually do (M2-04): the authenticated
   *  identity's effective role — machine `role` above must not be read as a
   *  credential permission */
  auth?: { role: AgentRole; capabilities: string[] };
}

// ---- controller-side config (ship.config.yaml) ----

export interface TargetConfig {
  url: string;
  /** plaintext long-term agent token (legacy default; do not commit real configs) */
  token?: string;
  /** name in ~/.ship/credentials.json written by `ship pair`; mutually exclusive with token */
  tokenRef?: string;
}

export interface TencentCvmConfig {
  region: string;
  zone: string;
  instanceType: string;
  imageId: string;
  /** Explicit system disk; omission keeps Tencent's default allocation. Size is in GiB. */
  systemDisk?: { diskType: string; diskSize: number };
  vpcId: string;
  subnetId: string;
  securityGroupIds: string[];
  /** controller IP reachable from created builders; required unless installUrl is set */
  advertiseHost?: string;
  bundlePort?: number;
  /** full install.sh URL from a self-hosted bootstrap source (skips the built-in bundle server) */
  installUrl?: string;
  /** token baked into that self-hosted installer — required together with installUrl (F18) */
  installToken?: string;
  /** bash snippet injected into cloud-init before the installer (e.g. pre-seed /etc/docker/daemon.json) */
  preInstallScript?: string;
  /** optional SSH password for created builders (debug access; the controller itself never SSHes) */
  loginPassword?: string;
  /** cloud-enforced maximum lifetime in minutes (ActionTimer terminate); must cover install+build+push budget */
  maxLifetimeMinutes?: number;
  /** scheme used to reach the created builder's agent — https when fronted by TLS (RA06) */
  agentScheme?: 'http' | 'https';
  /**
   * named entry (domain/tunnel/VIP) used INSTEAD of the raw public IP — bare host, NO port
   * (port comes from agentPort). Recommended with https so the certificate identity matches a
   * controlled entry. Note (corrected 2026-09): some CAs do issue IP certificates today
   * (e.g. Let's Encrypt short-lived IP certs since 2025-07), so https-without-host is allowed
   * for that scenario, but named entries remain the recommendation for renewability/compat.
   */
  agentHost?: string;
  /** agent port on the created builder (default 7410) */
  agentPort?: number;
  /** public base URL of a TLS-terminated bundle source, e.g. https://ship.example.com:7443 (RA06) */
  bundleBaseUrl?: string;
  instanceName?: string;
  internetMaxBandwidthOut?: number;
}

export interface ShipConfig {
  builder: {
    mode: 'static' | 'dynamic';
    static?: TargetConfig;
    dynamic?: {
      provider: 'tencent';
      keepMinutes?: number;
      tencent?: TencentCvmConfig;
    };
  };
  registry?: { url: string; namespace: string };
  source?: { repo?: string; ref?: string; token?: string };
  runtime: { targets: Record<string, TargetConfig> };
}
