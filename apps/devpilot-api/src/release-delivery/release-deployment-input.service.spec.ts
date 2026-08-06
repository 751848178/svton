import { ConflictException } from "@nestjs/common";
import { assertReleaseDeploymentInputCurrent } from "./release-deployment-input-freeze.policy";
import {
  deploymentInputFixture,
  prepareDeploymentInput as input,
} from "./release-deployment-input.spec-fixture";

describe("ReleaseDeploymentInputService", () => {
  it("resolves environment-scoped runtime input while persisting only safe evidence", async () => {
    const fixture = deploymentInputFixture();
    const prepared = await fixture.service.prepare(input);

    expect(prepared.runtimeEnvironment).toEqual({
      DATABASE_URL: "mysql://app:resource-sentinel-f432@db.example:3306/app",
      NODE_ENV: "plain-sentinel-f432",
      API_TOKEN: "secret-sentinel-f432",
    });
    expect(prepared.targetConnection).toEqual({
      host: "target.example",
      port: 2222,
      username: "deploy",
      authType: "password",
      credential: "ssh-sentinel-f432",
      root: "/srv/app",
    });
    expect(prepared.snapshot).toMatchObject({
      configRevision: {
        id: "config-1",
        revision: 7,
        snapshotHash: "snapshot-hash-7",
        stateHash: expect.any(String),
      },
      plainVariableKeys: ["NODE_ENV"],
      resourceReferences: [
        expect.objectContaining({
          id: "resource-1",
          environmentId: "staging-1",
          sharedEnvironmentIds: ["staging-1"],
        }),
      ],
      runtimeEnvironmentKeys: ["API_TOKEN", "DATABASE_URL", "NODE_ENV"],
      target: {
        bindingId: "binding-1",
        serverId: "server-1",
        providerKey: "ssh-v1",
        targetRef: "ssh://deploy@target.example:2222/srv/app",
      },
    });
    const auditJson = JSON.stringify(prepared.snapshot);
    for (const value of [
      "plain-sentinel-f432",
      "secret-sentinel-f432",
      "resource-sentinel-f432",
      "ssh-sentinel-f432",
    ]) {
      expect(auditJson).not.toContain(value);
    }
  });

  it("rejects resource references that are not bound to the target environment", async () => {
    const fixture = deploymentInputFixture();
    fixture.state.resourceReferences[0].sharedEnvironmentIds = ["prod-1"];

    await expect(fixture.service.prepare(input)).rejects.toThrow(
      "未绑定当前环境",
    );
  });

  it("rejects resource sharing through a foreign environment scope", async () => {
    const fixture = deploymentInputFixture();
    fixture.state.resourceReferences[0].sharedEnvironmentIds = [
      "staging-1",
      "foreign-environment",
    ];

    await expect(fixture.service.prepare(input)).rejects.toThrow(
      "共享环境作用域已漂移",
    );
  });

  it.each([
    [
      "revision",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.state.revisionTeamId = "foreign-team";
      },
    ],
    [
      "binding",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.state.bindingTeamId = "foreign-team";
      },
    ],
    [
      "server",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.state.serverTeamId = "foreign-team";
      },
    ],
  ])(
    "rejects foreign %s scope before decrypting managed input",
    async (_name, mutate) => {
      const fixture = deploymentInputFixture();
      mutate(fixture);

      await expect(fixture.service.prepare(input)).rejects.toThrow("作用域");
      expect(fixture.database.secretKey.findMany).not.toHaveBeenCalled();
      expect(
        fixture.database.resourceInstance.findFirst,
      ).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing effective target before decrypting runtime values", async () => {
    const fixture = deploymentInputFixture();
    fixture.state.includeBinding = false;
    const decryptCbc = jest.spyOn(fixture.crypto, "decryptCbc");
    const decryptGcm = jest.spyOn(fixture.crypto, "decryptGcm");

    await expect(fixture.service.prepare(input)).rejects.toThrow(
      "目标绑定缺失",
    );
    expect(decryptCbc).not.toHaveBeenCalled();
    expect(decryptGcm).not.toHaveBeenCalled();
  });

  it.each([
    [
      "configuration",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.state.plainVariables.NODE_ENV = "changed";
      },
    ],
    [
      "target",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.state.serverHost = "changed.example";
      },
    ],
    [
      "secret",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.secret.value = fixture.crypto.encryptCbc("changed");
      },
    ],
    [
      "resource",
      (fixture: ReturnType<typeof deploymentInputFixture>) => {
        fixture.resource.delivery = {
          ...fixture.resource.delivery,
          host: "changed.internal",
        };
      },
    ],
  ])("detects %s drift before provider execution", async (_name, mutate) => {
    const fixture = deploymentInputFixture();
    const prepared = await fixture.service.prepare(input);
    mutate(fixture);

    await expect(
      assertReleaseDeploymentInputCurrent(fixture.database as never, {
        ...input,
        snapshot: prepared.snapshot,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
