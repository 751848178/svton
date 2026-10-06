import { project, releasePolicyResponse, repositoryAnalysisRun } from "./data.js";
import { deploymentRuns, environmentVersionsResponse, pendingDeploymentRun, releaseOrderListResponse } from "./delivery-data.js";

export const projectHeader = {
  id: project.id,
  name: project.name,
  repo: project.gitRepo,
  branch: repositoryAnalysisRun.branch,
  commit: repositoryAnalysisRun.commitSha,
};

export const projectFacts = {
  repository: project.gitRepo,
  defaultBranch: repositoryAnalysisRun.branch,
  releasePolicy: policyName(releasePolicyResponse.current.strategy),
  releasePolicyDetail: releasePolicyResponse.current.requireProductionApproval ? "生产部署需要审批" : "生产部署无需审批",
  latestAnalysis: `${repositoryAnalysisRun.branch} · ${short(repositoryAnalysisRun.commitSha)}`,
  latestAnalysisAt: dateTime(repositoryAnalysisRun.createdAt),
};

export const components = project.applications.flatMap((application) =>
  application.services.map((service) => ({
    id: service.id,
    name: service.name,
    path: service.deployConfig?.workingDirectory || "—",
    runtime: service.runtime || service.kind || "—",
    port: ports(service.ports),
    status: service.status,
    statusLabel: service.status === "active" ? "运行中" : service.status,
    change: service.metadata?.repositoryAnalysis?.commitSha ? `已应用分析 · ${short(service.metadata.repositoryAnalysis.commitSha)}` : "—",
  })),
);

export const repositorySuggestionRows = repositoryAnalysisRun.suggestions.map((item) => {
  const value = item.proposedValue;
  return {
    id: item.id,
    name: value.serviceName,
    path: value.repoPath || value.deployConfig?.workingDirectory || "—",
    runtime: value.runtime || "—",
    port: ports(value.ports),
    change: item.impact,
    status: item.status,
  };
});

export const versionRecords = uniqueCandidates(environmentVersionsResponse.candidates).map((item) => ({
  id: item.id,
  version: item.releaseOrder.releaseVersion,
  name: item.releaseOrder.releaseName || item.releaseOrder.releaseVersion,
  source: `${item.buildRun.sourceBranch} · ${short(item.buildRun.sourceCommitSha)}`,
  createdAt: dateTime(item.createdAt),
  digest: item.digest,
}));

export const environmentVersions = Object.fromEntries(
  environmentVersionsResponse.environments.map((environment) => {
    const current = environment.environmentVersions.find((item) => item.id === environment.currentEnvironmentVersionId);
    const candidate = current && versionRecords.find((item) => item.id === current.artifactManifestId);
    return [
      environment.baselineRole,
      {
        id: environment.id,
        label: environment.name,
        version: current?.releaseOrder.releaseVersion || "—",
        source: candidate?.source || short(current?.artifactManifest.buildRun.sourceCommitSha),
        deployedAt: current ? dateTime(current.effectiveAt) : "—",
        status: current?.deploymentRun.status === "succeeded" ? "当前运行" : current?.deploymentRun.status || "未部署",
      },
    ];
  }),
);

export const releaseRows = releaseOrderListResponse.items.map((item) => ({
  id: item.id,
  name: item.releaseName || item.releaseVersion,
  version: item.releaseVersion,
  source: `${item.source.branch || "—"} · ${short(item.source.commitSha)}`,
  stage: phaseLabel(item.lifecycle.phase),
  status: item.lifecycle.failureKind === "blocked" ? "blocked" : item.lifecycle.status === "succeeded" ? "success" : "running",
  updated: dateTime(item.lastExecutedAt),
  manifestId: item.build.recentSuccessfulManifest?.id || "—",
  manifestDigest: item.build.recentSuccessfulManifest?.digest || "—",
}));

export const deploymentRows = deploymentRuns.map(deploymentView);
export const pendingDeploymentRow = deploymentView(pendingDeploymentRun);

function deploymentView(run) {
  const order = releaseOrderListResponse.items.find((item) => item.id === run.artifactManifest?.releaseOrderId);
  return {
    id: run.id,
    version: order?.releaseVersion || "—",
    name: order?.releaseName || order?.releaseVersion || "—",
    environment: run.projectEnvironment?.name || run.environment || "—",
    status: run.status,
    duration: duration(run.startedAt, run.finishedAt),
    actor: run.actor?.name || run.actor?.email || "系统",
    manifestId: order?.build.recentSuccessfulManifest?.id || run.artifactManifest?.id || "—",
  };
}

function uniqueCandidates(candidates) {
  return [...new Map([...candidates.staging, ...candidates.production].map((item) => [item.id, item])).values()];
}

function policyName(strategy) {
  return (
    {
      standard: "标准发布",
      canary: "金丝雀发布",
      blue_green: "蓝绿发布",
      automatic_traffic: "自动流量发布",
    }[strategy] || strategy
  );
}

function phaseLabel(phase) {
  return { preflight: "预检", build: "构建", staging: "预发", production: "生产" }[phase] || phase;
}

function ports(value) {
  return Array.isArray(value) && value.length ? value.join(", ") : "—";
}

function short(value) {
  return value ? String(value).slice(0, 8) : "—";
}

function dateTime(value) {
  return value ? value.slice(0, 16).replace("T", " ") : "—";
}

function duration(startedAt, finishedAt) {
  if (!finishedAt) return "进行中";
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
