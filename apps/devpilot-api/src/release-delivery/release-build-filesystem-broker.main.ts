import { readFileSync } from "node:fs";
import { runReleaseBuildBroker } from "./release-build-filesystem-broker";

async function main() {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) throw new Error("broker input missing");
  const input = JSON.parse(readFileSync(path, "utf8"));
  const result = await runReleaseBuildBroker(input);
  process.stdout.write(JSON.stringify(result));
}

void main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : "broker failed");
  process.exitCode = 1;
});
