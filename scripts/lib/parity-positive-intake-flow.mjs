export function createPositiveIntakeFlow(options) {
  let projectId;
  let analysisRunId;
  let contract;
  let reviewSnapshot;

  return Object.freeze({
    projectId: () => projectId,
    async draft() {
      const draft = await options.request("POST", "/project-intake/drafts", {
        name: `Parity fresh intake ${options.runKey}`,
        description: "F475 current-run repository intake evidence",
      });
      projectId = requireId(draft?.id, "draft-project");
      const state = await options.request(
        "GET",
        `/project-intake/${projectId}`,
      );
      return { project: state.project };
    },
    async connect() {
      requireId(projectId, "project-before-connect");
      const connected = await options.request(
        "POST",
        `/project-intake/${projectId}/repository`,
        {
          repositoryUrl: "/read-only-repositories/parity-app-intake",
          visibility: "public",
          branch: "main",
        },
      );
      return pick(connected, [
        "provider",
        "defaultBranch",
        "selectedBranch",
        "commitSha",
        "status",
      ]);
    },
    async analyze() {
      const started = await options.request(
        "POST",
        `/project-intake/${projectId}/analysis-runs`,
        { branch: "main", idempotencyKey: `f475-${options.runKey}` },
      );
      analysisRunId = requireId(started?.id, "analysis-run");
      const run = await poll(async () => {
        const detail = await options.request(
          "GET",
          `/projects/${projectId}/repository-analysis/runs/${analysisRunId}`,
        );
        return ["succeeded", "failed"].includes(detail.status)
          ? detail
          : undefined;
      });
      if (run.status !== "succeeded") {
        throw new Error(
          `F475_INTAKE_INVALID: analysis-failed:${run.errorCode || run.errorMessage}`,
        );
      }
      return {
        runId: analysisRunId,
        status: run.status,
        commitSha: run.commitSha,
        pinned: run.commitSha === options.pinnedCommit,
        services: (run.result?.services || []).map(({ key }) => key),
        packageManager: run.result?.repository?.packageManager,
        migrationEvidence: run.result?.migrationEvidence,
      };
    },
    async contract() {
      contract = await options.request(
        "GET",
        `/project-intake/${projectId}/analysis-runs/${analysisRunId}/contract`,
      );
      return {
        contractKeys: Object.keys(contract),
        suggestionCount:
          (contract.overview ? 1 : 0) +
          (contract.components?.length || 0) +
          (contract.dependencies?.length || 0),
        snapshot: contract.snapshot,
      };
    },
    async review() {
      const reviewed = await options.request(
        "POST",
        `/project-intake/${projectId}/analysis-runs/${analysisRunId}/review`,
        { items: reviewItems(contract) },
      );
      reviewSnapshot = reviewed.snapshot;
      return {
        expectedRefusal: false,
        reviewSnapshotId: reviewSnapshot?.id,
        reviewSnapshotHash: reviewSnapshot?.hash,
      };
    },
    async finalize() {
      const finalized = await options.request(
        "POST",
        `/project-intake/${projectId}/finalize`,
        {
          analysisRunId,
          reviewSnapshotId: reviewSnapshot?.id,
          reviewSnapshotHash: reviewSnapshot?.hash,
          idempotencyKey: `f475-finalize-${options.runKey}`,
        },
      );
      const state = await options.request(
        "GET",
        `/project-intake/${projectId}`,
      );
      return {
        expectedRefusal: false,
        projectId: finalized.projectId,
        status: state.project?.onboardingStatus,
      };
    },
  });
}

function reviewItems(contract) {
  if (!contract) throw new Error("F475_INTAKE_INVALID: contract-missing");
  const suggestions = [
    ...(contract.overview ? [contract.overview] : []),
    ...(contract.components || []),
    ...(contract.dependencies || []),
  ];
  return suggestions.map((item) => ({
    suggestionId: requireId(item.suggestionId, "suggestion"),
    decision: item.kind === "resource_requirement" ? "reject" : "accept",
  }));
}

async function poll(action) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await action();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("F475_INTAKE_INVALID: analysis-timeout");
}

function requireId(value, reason) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`F475_INTAKE_INVALID: ${reason}`);
  }
  return value;
}

function pick(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source?.[key]]));
}
