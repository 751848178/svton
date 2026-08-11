import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const mode = process.argv[2];
if (!["test", "lint", "typecheck"].includes(mode)) process.exit(2);

const root = process.cwd();
const files = walk(root).filter((path) => /\.(?:js|mjs|html)$/.test(path));
if (files.length === 0) throw new Error("fixture source files are missing");

for (const path of files) {
  const source = readFileSync(path, "utf8");
  if (mode === "test" && source.includes("FIXTURE_TEST_FAILURE")) {
    throw new Error(`fixture test marker found in ${relative(root, path)}`);
  }
  if (mode === "lint" && /[ \t]+$/m.test(source)) {
    throw new Error(`trailing whitespace found in ${relative(root, path)}`);
  }
  if (mode === "typecheck" && /\.(?:js|mjs)$/.test(path)) {
    execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["dist", "node_modules"].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
