import { spawnSync } from "node:child_process";

const run = (args) => {
  const result = spawnSync("op", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `op ${args.join(" ")} failed`);
  return result.stdout;
};

const name = "V2-02 Version Configuration";
const before = JSON.parse(run(["get", "--name", name, "--depth", "0"])).nodes || [];
if (before.length !== 1) throw new Error(`Expected one version board before stabilization, found ${before.length}`);

run(["copy", before[0].id, "--parent", "root"]);
const after = JSON.parse(run(["get", "--name", name, "--depth", "0"])).nodes || [];
const replacement = after.find((node) => node.id !== before[0].id);
if (after.length !== 2 || !replacement) throw new Error("OpenPencil did not create one replacement version board");

run(["delete", before[0].id]);
run(["update", replacement.id, JSON.stringify({ x: 1520, y: 0 })]);

const navigation = JSON.parse(run(["get", "--name", "Project navigation", "--depth", "1"])).nodes || [];
const copiedNavigation = navigation
  .toSorted((left, right) => Number(right.id.slice(1)) - Number(left.id.slice(1)))[0];
const copiedTabs = copiedNavigation?.children?.[0];
if (!copiedTabs?.id) throw new Error("Unable to find copied project tabs");
run(["update", copiedTabs.id, JSON.stringify({ gap: 40 })]);
