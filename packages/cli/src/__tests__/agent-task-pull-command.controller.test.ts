import { Command } from "commander";
import { registerAgentTaskPullCommand } from "../commands/agent-task-pull-command.controller";

describe("registerAgentTaskPullCommand", () => {
  it("registers agent task-pull once and run commands", () => {
    const program = new Command();

    registerAgentTaskPullCommand(program);

    const agent = findCommand(program, "agent");
    const taskPull = findCommand(agent, "task-pull");

    expect(findCommand(taskPull, "once").description()).toBe(
      "Read or execute one Devpilot server-agent task-pull job",
    );
    expect(findCommand(taskPull, "run").description()).toBe(
      "Poll and execute Devpilot server-agent task-pull jobs",
    );
  });

  it("preserves once command options", () => {
    const once = findTaskPullCommand("once");

    expect(readLongOptions(once)).toEqual([
      "--api-url",
      "--token",
      "--team",
      "--server",
      "--agent",
      "--runner",
      "--capability",
      "--cwd",
      "--ack-renewal-interval-ms",
      "--force-kill-grace-ms",
      "--execute",
    ]);
  });

  it("preserves run command options", () => {
    const run = findTaskPullCommand("run");

    expect(readLongOptions(run)).toEqual([
      "--api-url",
      "--token",
      "--team",
      "--server",
      "--agent",
      "--runner",
      "--capability",
      "--cwd",
      "--ack-renewal-interval-ms",
      "--force-kill-grace-ms",
      "--interval-ms",
      "--max-iterations",
      "--idle-limit",
      "--forever",
      "--pid-file",
      "--heartbeat-token",
      "--heartbeat-status",
      "--heartbeat-hostname",
      "--heartbeat-version",
      "--heartbeat-ttl-seconds",
    ]);
  });
});

function findTaskPullCommand(name: string) {
  const program = new Command();
  registerAgentTaskPullCommand(program);
  return findCommand(
    findCommand(findCommand(program, "agent"), "task-pull"),
    name,
  );
}

function findCommand(command: Command, name: string) {
  const found = command.commands.find((candidate) => candidate.name() === name);
  if (!found) throw new Error(`Missing command: ${name}`);
  return found;
}

function readLongOptions(command: Command) {
  return command.options.map((option) => option.long);
}
