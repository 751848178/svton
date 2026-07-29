import { ServerCommandPolicyTemplateRepository } from "./server-command-policy-template.repository";
import { ServerCommandPolicyTemplateMatcherService } from "./server-command-policy-template-matcher.service";
import type { ServerExecutionInput } from "./server-executor.types";
import type { PrismaService } from "../prisma/prisma.service";

// 捕获 findEnabledForScope 收到的 (teamId, scope) —— 直接断言租户隔离与作用域数组。
function mockRepo(returning: unknown[] = []) {
  const calls: { teamId: string; scope: unknown[] }[] = [];
  const prisma = {
    serverCommandPolicyTemplate: {
      findMany: jest.fn().mockResolvedValue(returning),
    },
  };
  const repo = new ServerCommandPolicyTemplateRepository(
    prisma as unknown as PrismaService,
  );
  const spy = jest.spyOn(repo, "findEnabledForScope").mockResolvedValue(returning as never);
  return { repo, calls, spy };
}

function input(
  overrides: Partial<ServerExecutionInput> & { metadata?: Record<string, unknown> } = {},
): ServerExecutionInput {
  return {
    teamId: "team-A",
    userId: "user-1",
    operationKey: "release_stage.health_check",
    adapterKey: "ssh-live",
    dryRun: false,
    target: { transport: "ssh", serverId: "srv-1" },
    steps: [{ key: "k", label: "l", command: "echo ok", required: true, risk: "low" }],
    ...overrides,
  } as ServerExecutionInput;
}

function tpl(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    adapterKeys: ["ssh-live"],
    operationKeys: ["release_stage.health_check"],
    allowedPatterns: ["echo *"],
    blockedPatterns: [],
    ...extra,
  };
}

describe("ServerCommandPolicyTemplateMatcherService (P0-1 scope)", () => {
  it("team-global only when no scope in metadata", async () => {
    const { repo, spy } = mockRepo([tpl("team-global")]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    const out = await matcher.loadMatchingTemplates(input({ metadata: {} }));
    expect(spy).toHaveBeenCalledWith("team-A", [
      { projectId: null, environmentId: null },
    ]);
    expect(out.map((t) => t.id)).toEqual(["team-global"]);
  });

  it("project-scoped template matches via flat metadata", async () => {
    const { repo, spy } = mockRepo([tpl("proj-tpl")]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    await matcher.loadMatchingTemplates(
      input({ metadata: { projectId: "proj-1", environmentId: "env-1" } }),
    );
    const scope = spy.mock.calls[0][1] as unknown[];
    expect(scope).toEqual([
      { projectId: null, environmentId: null },
      { projectId: "proj-1", environmentId: null },
      { environmentId: "env-1" },
    ]);
  });

  it("project-scoped template matches via legacy nested sourceMetadata (release-stage data)", async () => {
    const { repo, spy } = mockRepo([tpl("nested-tpl")]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    await matcher.loadMatchingTemplates(
      input({
        metadata: {
          sourceMetadata: { projectId: "proj-1", environmentId: "env-1" },
        },
      }),
    );
    const teamId = spy.mock.calls[0][0];
    const scope = spy.mock.calls[0][1] as unknown[];
    expect(teamId).toBe("team-A");
    expect(scope).toContainEqual({ projectId: "proj-1", environmentId: null });
    expect(scope).toContainEqual({ environmentId: "env-1" });
  });

  it("environment-scoped template matches with projectId absent", async () => {
    const { repo } = mockRepo([tpl("env-tpl")]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    const out = await matcher.loadMatchingTemplates(
      input({ metadata: { environmentId: "env-1" } }),
    );
    expect(out.map((t) => t.id)).toEqual(["env-tpl"]);
  });

  it("always passes teamId as hard equality predicate (no cross-tenant leak)", async () => {
    const { repo, spy } = mockRepo([]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    await matcher.loadMatchingTemplates(
      input({ metadata: { projectId: "proj-1" } }),
    );
    expect(spy.mock.calls[0][0]).toBe("team-A");
  });

  it("filters out templates whose adapterKeys do not match", async () => {
    const { repo } = mockRepo([
      tpl("match"),
      tpl("wrong-adapter", { adapterKeys: ["server-agent"] }),
    ]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    const out = await matcher.loadMatchingTemplates(input());
    expect(out.map((t) => t.id)).toEqual(["match"]);
  });

  it("filters out templates whose operationKeys do not match", async () => {
    const { repo } = mockRepo([
      tpl("match"),
      tpl("wrong-op", { operationKeys: ["deployment.run"] }),
    ]);
    const matcher = new ServerCommandPolicyTemplateMatcherService(repo);
    const out = await matcher.loadMatchingTemplates(input());
    expect(out.map((t) => t.id)).toEqual(["match"]);
  });
});
