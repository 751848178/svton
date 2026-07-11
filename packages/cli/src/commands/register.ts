import type { Command } from "commander";
import { createProject } from "./create";
import { buildSkills, installSkill, listSkills } from "./skills";
import { dev, build, start, lint, typecheck, test, clean } from "./lifecycle";
import { info } from "./info";
import { doctor } from "./doctor";
import { envCheck } from "./env";
import { db } from "./db";
import { services } from "./services";
import { generate } from "./generate";
import { docker } from "./docker";
import { registerAgentTaskPullCommand } from "./agent-task-pull-command.controller";

export function registerCliCommands(program: Command) {
  program
    .command("create <project-name>")
    .alias("init")
    .alias("new")
    .description("Create a new Svton project")
    .option("-o, --org <name>", "Organization name (default: project name)")
    .option("--skip-install", "Skip installing dependencies")
    .option("--skip-git", "Skip Git initialization")
    .option("-t, --template <template>", "Template to use", "full-stack")
    .option("-p, --package-manager <pm>", "Package manager to use", "pnpm")
    .option(
      "--registry <url>",
      "NPM registry for generated project and dependency install",
    )
    .option("-y, --yes", "Skip all prompts and use defaults")
    .action(createProject);

  registerSkillCommands(program);
  registerAgentTaskPullCommand(program);
  registerLifecycleCommands(program);
  registerOpsCommands(program);
}

function registerSkillCommands(program: Command) {
  const skillCommand = program
    .command("skill")
    .alias("skills")
    .description("Install, build, and list AI agent skills");

  skillCommand
    .command("install [source]")
    .description(
      "Install a skill from a local directory, Git repository, SKILL.md URL, or SkillHub",
    )
    .option(
      "--source-dir <path>",
      "Local skill directory, or source subdirectory inside --repo",
    )
    .option("--repo <url>", "Git repository containing one or more skills")
    .option("--ref <ref>", "Git branch, tag, or commit to clone")
    .option("--url <url>", "Direct URL to a SKILL.md file")
    .option(
      "--hub <url>",
      "SkillHub-compatible base URL (defaults to skills.sh when --skill is used)",
    )
    .option(
      "--skill <id>",
      "SkillHub skill id, for example owner/repo/skill-name",
    )
    .option("--out-dir <path>", "Target skill directory", ".svton/skills")
    .option("--force", "Overwrite an existing skill with the same name")
    .option("-y, --yes", "Skip prompts and require command-line options")
    .action(installSkill);

  skillCommand
    .command("build [skill]")
    .description(
      "Build skills from a source skills directory into AI agent skill artifacts",
    )
    .option(
      "--skills-dir <path>",
      "Directory containing source skill folders",
      "skills",
    )
    .option("--out-dir <path>", "Target built skill directory", ".svton/skills")
    .option("--clean", "Remove the target directory before building")
    .action(buildSkills);

  skillCommand
    .command("list")
    .description("List built or installed skills")
    .option("--out-dir <path>", "Skill directory to inspect", ".svton/skills")
    .action(listSkills);
}

function registerLifecycleCommands(program: Command) {
  program.command("dev [target]").description("Start dev servers").action(dev);
  program
    .command("build [target]")
    .description("Build all or a single app")
    .action(build);
  program
    .command("start [target]")
    .description("Start a production app")
    .option("--all", "Start every app that has a start script")
    .action(start);
  program
    .command("lint [target]")
    .description("Lint all or a single app")
    .option("--fix", "Pass --fix through to the linters")
    .action(lint);
  program
    .command("typecheck [target]")
    .description("Type-check")
    .action(typecheck);
  program.command("test [target]").description("Run tests").action(test);
  program
    .command("clean")
    .description("Clean build outputs")
    .option("--keep-deps", "Keep node_modules")
    .action(clean);
}

function registerOpsCommands(program: Command) {
  program
    .command("info")
    .description("Print the resolved manifest")
    .option("--json", "Emit JSON")
    .action(info);
  program
    .command("doctor")
    .description("Run sanity checks")
    .option("--fix", "Apply fixes")
    .action(doctor);

  const envCommand = program
    .command("env")
    .description("Manage environment files");
  envCommand
    .command("check [target]")
    .option("--fix", "Create missing .env")
    .action(envCheck);
  envCommand
    .command("pull [target]")
    .action((target: string | undefined) => envCheck(target, { fix: true }));

  program
    .command("db <command>")
    .option("--name <name>", "Migration name")
    .action(db);
  program
    .command("services <command>")
    .option("--force", "init: overwrite compose")
    .option("--volumes", "down: remove volumes")
    .action(services);

  program
    .command("docker <command>")
    .description("Production Docker for svton projects")
    .option("--force", "init: overwrite generated files")
    .option("--template <root|per-app>", "init: Dockerfile style", "root")
    .option("--db <mysql|postgres|none>", "init: database engine")
    .option("--mobile", "init: enable mobile service")
    .option("--no-mobile", "init: disable mobile service")
    .option("--no-healthchecks", "init: omit healthchecks")
    .option("--service <name>", "operate on a single app")
    .option("--no-cache", "docker build --no-cache")
    .option("--build-arg <k=v>", "pass build arg", collect, [])
    .option("--tag <tag>", "image tag")
    .option("--push", "build then push")
    .option("--profile <name>", "compose profile", collect, [])
    .option("--no-build", "up: skip --build")
    .option("--build", "restart: rebuild images")
    .option("--serial", "build apps one at a time")
    .option("--no-serial", "build in parallel")
    .option("--volumes", "down: also remove volumes")
    .option("--rmi <all|local>", "down: remove images")
    .option("--tail <n>", "logs: tail N lines", (v: string) => Number(v))
    .option("--file <path>", "override compose file path")
    .action(docker);

  program
    .command("generate <kind> [name]")
    .alias("g")
    .description("Scaffold code")
    .option("--app <name>", "Target app")
    .option("--dry-run", "Print the plan")
    .option("--force", "Overwrite existing files")
    .action(generate);
}

function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}
