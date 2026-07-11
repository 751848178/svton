import type { Command } from "commander";
import { agentTaskPullOnce, agentTaskPullRun } from "./agent-task-pull";
import { addAgentTaskPullSharedOptions } from "./agent-task-pull-command-options.service";

export function registerAgentTaskPullCommand(program: Command) {
  const agent = program.command("agent").description("Operate Devpilot agents");
  const taskPull = agent
    .command("task-pull")
    .description("Run server-agent task-pull commands");

  addAgentTaskPullSharedOptions(
    taskPull
      .command("once")
      .description("Read or execute one Devpilot server-agent task-pull job"),
  )
    .option(
      "--execute",
      "Claim and execute one task; without this only reads contract",
    )
    .action(agentTaskPullOnce);

  addAgentTaskPullSharedOptions(
    taskPull
      .command("run")
      .description("Poll and execute Devpilot server-agent task-pull jobs"),
  )
    .option("--interval-ms <ms>", "Delay between poll iterations")
    .option("--max-iterations <count>", "Stop after this many poll iterations")
    .option("--idle-limit <count>", "Stop after this many idle claims")
    .option("--forever", "Allow an unbounded polling loop")
    .option(
      "--pid-file <path>",
      "Write and clean up a task-pull runner PID file",
    )
    .option("--heartbeat-token <token>", "Server-agent heartbeat token")
    .option("--heartbeat-status <status>", "Heartbeat runtime status")
    .option("--heartbeat-hostname <name>", "Heartbeat hostname")
    .option("--heartbeat-version <version>", "Heartbeat agent version")
    .option("--heartbeat-ttl-seconds <seconds>", "Heartbeat TTL")
    .action(agentTaskPullRun);
}
