import { resolve } from "node:path";

const WORKER_OVERLAY = "docker-compose.devpilot-parity-worker.yml";

export function parityComposeFiles(root, baseFile, env = process.env) {
  const requested = env.PARITY_COMPOSE_OVERLAY;
  if (!requested) return [baseFile];
  const overlay = resolve(root, requested);
  if (overlay !== resolve(root, WORKER_OVERLAY)) {
    throw new Error("PARITY_COMPOSE_OVERLAY_INVALID");
  }
  return [baseFile, overlay];
}
