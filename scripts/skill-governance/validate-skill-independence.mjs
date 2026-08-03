#!/usr/bin/env node

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_FILE = "SKILL.md";
const FRONTMATTER_NAME = /^name:\s*["']?([^"'\n]+)["']?\s*$/m;
const MARKDOWN_LINK = /\[[^\]]*]\(([^)]+)\)/g;

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listPackages(skillsRoot) {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name));
}

async function resolvePackages(skillsRoot) {
  const candidates = await listPackages(skillsRoot);
  const checks = await Promise.all(
    candidates.map(async (packageDir) => ({
      packageDir,
      present: await exists(path.join(packageDir, SKILL_FILE)),
    })),
  );
  return checks
    .filter(({ present }) => present)
    .map(({ packageDir }) => packageDir);
}

async function listMarkdownFiles(packageDir) {
  const files = [path.join(packageDir, SKILL_FILE)];
  const referencesDir = path.join(packageDir, "references");
  if (!(await exists(referencesDir))) return files;

  const entries = await readdir(referencesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.join(referencesDir, entry.name));
    }
  }
  return files;
}

function extractName(content, skillFile) {
  const match = content.match(FRONTMATTER_NAME);
  if (!match) throw new Error(`Missing frontmatter name: ${skillFile}`);
  return match[1].trim();
}

function relativeFile(skillsRoot, filePath) {
  return path.relative(skillsRoot, filePath);
}

function extractLocalLinks(content) {
  return [...content.matchAll(MARKDOWN_LINK)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ""))
    .filter((target) => target && !target.startsWith("#"))
    .filter((target) => !/^[a-z][a-z\d+.-]*:/i.test(target))
    .map((target) => target.split("#")[0]);
}

async function validateLinks(skillsRoot, packageDir, skillContent) {
  const issues = [];
  for (const target of extractLocalLinks(skillContent)) {
    const resolved = path.resolve(packageDir, target);
    const insidePackage =
      resolved === packageDir ||
      resolved.startsWith(`${packageDir}${path.sep}`);
    if (!insidePackage) {
      issues.push({
        type: "external_local_link",
        file: relativeFile(skillsRoot, path.join(packageDir, SKILL_FILE)),
        target,
      });
    } else if (!(await exists(resolved))) {
      issues.push({
        type: "missing_local_link",
        file: relativeFile(skillsRoot, path.join(packageDir, SKILL_FILE)),
        target,
      });
    }
  }
  return issues;
}

export async function validateSkillIndependence(skillsRoot) {
  const packageDirs = await resolvePackages(path.resolve(skillsRoot));
  const packages = await Promise.all(
    packageDirs.map(async (packageDir) => {
      const skillFile = path.join(packageDir, SKILL_FILE);
      const content = await readFile(skillFile, "utf8");
      return {
        packageDir,
        name: extractName(content, skillFile),
        skillContent: content,
      };
    }),
  );
  const issues = [];

  for (const current of packages) {
    const markdownFiles = await listMarkdownFiles(current.packageDir);
    for (const filePath of markdownFiles) {
      const content = await readFile(filePath, "utf8");
      for (const other of packages) {
        if (other.name !== current.name && content.includes(other.name)) {
          issues.push({
            type: "cross_skill_name",
            package: current.name,
            dependency: other.name,
            file: relativeFile(skillsRoot, filePath),
          });
        }
      }
    }
    issues.push(
      ...(await validateLinks(
        path.resolve(skillsRoot),
        current.packageDir,
        current.skillContent,
      )),
    );
  }

  return {
    status: issues.length === 0 ? "passed" : "failed",
    packages_checked: packages.length,
    issues,
  };
}

async function main() {
  const skillsRoot = process.argv[2] ?? path.join(process.cwd(), "skills");
  const result = await validateSkillIndependence(skillsRoot);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
