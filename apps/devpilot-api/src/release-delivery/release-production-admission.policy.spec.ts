import { assertProductionAdmissionProof,
  type ProductionAdmissionProof } from "./release-production-admission.policy";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import { buildReleaseDeploymentInputSnapshot } from "./release-deployment-input-snapshot.utils";

describe("production admission transaction proof", () => {
  it("accepts exact fresh immutable receipts", async () => {
    await expect(assertProductionAdmissionProof(tx() as never, proof(), expected()))
      .resolves.toBeUndefined();
  });

  it("rejects evidence that expires before the create transaction", async () => {
    const value = proof();
    value.checks[0].expiresAt = "2000-01-01T00:00:00.000Z";
    const client = tx();
    await expect(assertProductionAdmissionProof(client as never, value, expected()))
      .rejects.toThrow("Production 前置检查已过期或漂移");
    expect(client.serverCapacitySnapshot.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an exact receipt that no longer proves a successful result", async () => {
    const client = tx();
    client.serverCapacitySnapshot.findFirst.mockResolvedValue({ status: "insufficient" });
    await expect(assertProductionAdmissionProof(client as never, proof(), expected()))
      .rejects.toThrow("Production 前置检查已过期或漂移");
  });

  it.each([
    ["connection", "resourceConnectionRun"],
    ["backup", "backupRun"],
  ])("rejects a %s run that changes after preview", async (_name, key) => {
    const client = tx();
    const value = proof();
    const gate = value.checks.find((check) => check.id ===
      (key === "backupRun" ? "D12" : "D08"))!;
    gate.evidenceIdentity = { environmentId: "production-1",
      resourceRunMap: JSON.stringify([["resource-1", "run-1"]]) };
    const repository = key === "backupRun" ? client.backupRun
      : client.resourceConnectionRun;
    repository.findFirst.mockResolvedValue({ id: "run-new-failed", status: "failed",
      dryRun: false, environmentId: "production-1" });
    await expect(assertProductionAdmissionProof(client as never, value, expected()))
      .rejects.toThrow("Production 前置检查已过期或漂移");
  });

  it("rejects a site domain or probe that drifts after preview", async () => {
    const client = tx();
    const value = proof();
    value.checks.find((check) => check.id === "D14")!.evidenceIdentity = {
      siteId: "site-1", environmentId: "production-1", hostname: "old.example",
      routeHash: "route-1",
    };
    client.site.findFirst.mockResolvedValue({ dns: {
      status: "resolved", hostname: "renamed.example",
    }, tls: {} });
    await expect(assertProductionAdmissionProof(client as never, value, expected()))
      .rejects.toThrow("Production 前置检查已过期或漂移");
  });

  it.each(["D14", "D15"])(
    "rejects checked mutable %s evidence without an exact identity",
    async (gateId) => {
      const value = proof();
      delete value.checks.find((check) => check.id === gateId)!.evidenceIdentity;
      await expect(assertProductionAdmissionProof(tx() as never, value, expected()))
        .rejects.toThrow("Production 前置检查已过期或漂移");
    },
  );

  it("rejects target binding or server drift reconstructed inside the transaction", async () => {
    const client = tx();
    const state = deploymentState();
    state.bindings[0].server.host = "changed.internal";
    client.projectEnvironment.findFirst.mockResolvedValue({
      id: state.environmentId, currentConfigRevision: state.revision,
      serverBindings: state.bindings,
    });
    await expect(assertProductionAdmissionProof(client as never, proof(), expected()))
      .rejects.toThrow("Production 前置检查已过期或漂移");
  });
});

function proof(): ProductionAdmissionProof {
  const deploymentSnapshot = snapshot();
  const exactIdentity = { configRevisionId: "config-1",
    deploymentInputHash: deploymentSnapshot.inputHash };
  return {
    preApprovalAllowed: true,
    previewInputHash: "preview-1",
    deploymentInputHash: deploymentSnapshot.inputHash,
    deploymentSnapshot,
    workloadInputHash: "workload-1",
    capacitySnapshotId: "capacity-1",
    dnsProbeReceiptId: "dns-1",
    checks: releaseGateCheckpointPolicy("production_pre_execution")
      .requiredGateIds.map((id) => ({ id, status: id === "D13" ? "manual" : "checked",
        fresh: true, expiresAt: "2099-01-01T00:00:00.000Z",
        evidenceIdentity: ["D14", "D15"].includes(id) ? exactIdentity : undefined })),
  };
}

function expected() {
  return { teamId: "team-1", projectId: "project-1", environmentId: "production-1",
    previewInputHash: "preview-1", deploymentInputHash: snapshot().inputHash,
    workloadInputHash: "workload-1" };
}

function tx() {
  const state = deploymentState();
  return {
    serverCapacitySnapshot: { findFirst: jest.fn().mockResolvedValue({ status: "fit" }) },
    siteDnsProbeReceipt: { findFirst: jest.fn().mockResolvedValue({ id: "dns-1" }) },
    resourceConnectionRun: { findFirst: jest.fn().mockResolvedValue(null) },
    backupRun: { findFirst: jest.fn().mockResolvedValue(null) },
    site: { findFirst: jest.fn().mockResolvedValue(null) },
    projectEnvironment: { findUnique: jest.fn().mockResolvedValue({
      currentConfigRevision: { routeSnapshot: {} },
    }), findFirst: jest.fn().mockResolvedValue({
      id: state.environmentId, currentConfigRevision: state.revision,
      serverBindings: state.bindings,
    }), findMany: jest.fn().mockResolvedValue([]) },
    environmentConfigRevision: { findFirst: jest.fn().mockResolvedValue(state.revision) },
    secretKey: { findMany: jest.fn().mockResolvedValue([]) },
    resourceInstance: { findFirst: jest.fn() },
    managedResource: { findFirst: jest.fn() },
    cDNConfig: { findFirst: jest.fn() },
  };
}

function snapshot() {
  return buildReleaseDeploymentInputSnapshot(
    deploymentState(), "local-filesystem-v1", [], {},
  ).snapshot;
}

function deploymentState() {
  return {
    environmentId: "production-1",
    revision: { id: "config-1", teamId: "team-1", projectId: "project-1",
      environmentId: "production-1", revision: 1, snapshotHash: "snapshot-1",
      plainVariables: {}, secretReferences: [], resourceReferences: [],
      routeSnapshot: {}, observabilitySnapshot: {} },
    secrets: [], resources: [], bindings: [{ id: "binding-1", teamId: "team-1",
      projectId: "project-1", environmentId: "production-1", metadata: {
      releaseDeployment: { providerKey: "local-filesystem-v1", targetRef: "local" },
    }, updatedAt: new Date("2026-08-12T00:00:00.000Z"), server: {
      id: "server-1", teamId: "team-1", host: "localhost", port: 22, username: "runner",
      authType: "password", credentials: "secret", status: "online",
      updatedAt: new Date("2026-08-12T00:00:00.000Z"),
    } }],
  };
}
