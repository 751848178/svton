import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const png = await readFile(join(root, "assets", "devpilot-cube-mark.png"));
const source = `data:image/png;base64,${png.toString("base64")}`;
const lookup = spawnSync("op", ["get", "--name", "Devpilot geometric cube mark", "--depth", "0"], {
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});
if (lookup.status !== 0) throw new Error(lookup.stderr || "Unable to find brand mark containers");
const nodes = JSON.parse(lookup.stdout).nodes || [];
if (nodes.length !== 10) throw new Error(`Expected 10 brand mark containers, found ${nodes.length}`);
for (const node of nodes) {
  const payload = JSON.stringify({
    type: "image",
    name: "Devpilot cube asset",
    x: -3,
    y: -3,
    width: 34,
    height: 34,
    src: source,
    objectFit: "fit",
  });
  const inserted = spawnSync("op", ["insert", "-", "--parent", node.id], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (inserted.status !== 0) throw new Error(inserted.stderr || `Unable to inject asset into ${node.id}`);
}
