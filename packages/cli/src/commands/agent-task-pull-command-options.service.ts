import type { Command } from "commander";
import { collect } from "./agent-task-pull-config";

export function addAgentTaskPullSharedOptions(command: Command) {
  return command
    .option("--api-url <url>", "Devpilot API base URL")
    .option("--token <token>", "Server-agent task-pull token")
    .option("--team <id>", "Team id")
    .option("--server <id>", "Server id")
    .option("--agent <id>", "Agent id")
    .option("--runner <id>", "Runner id")
    .option("--capability <name>", "Requested capability", collect, [])
    .option("--cwd <path>", "Working directory for command steps")
    .option("--ack-renewal-interval-ms <ms>", "Command-step ack renewal delay")
    .option("--force-kill-grace-ms <ms>", "Delay before SIGKILL fallback");
}
