import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { parityComposeEnvironment } from "./parity-runtime-config.mjs";

export function createParityComposeCapture(root, runtime, spawn = spawnSync) {
  const composeFile = resolve(root, "docker-compose.devpilot-parity.yml");
  return function composeCapture(args) {
    const out = spawn(
      "docker",
      ["compose", "-p", runtime.composeProject, "-f", composeFile, ...args],
      {
        encoding: "utf8",
        maxBuffer: 128 * 1024 * 1024,
        env: parityComposeEnvironment(runtime),
      },
    );
    return {
      status: out.status,
      stdout: out.stdout || "",
      stderr: out.stderr || "",
    };
  };
}
