import { components, projectFacts, releaseRows } from "../view-models.js";

const currentRelease = releaseRows[0];
const sourceFacts = [
  ["候选来源", currentRelease.source],
  ["候选版本", `${currentRelease.name} ${currentRelease.version}`],
];
const buildResources = components.map((item) => ({
  name: item.name,
  path: item.path,
  runtime: item.runtime,
  result: "已写入 Manifest",
}));

function check(label, detail, status = "success", evidence = null) {
  return { label, detail, status, evidence };
}

function step(key, label, detail, state, description, facts, options = {}) {
  return { key, label, detail, state, description, facts, ...options };
}

export function buildReleaseStages({ completed, stagingCompleted, domainFixed, preflightVerified, productionPublished, validationCompleted }) {
  const productionEnabled = stagingCompleted;
  const validationEnabled = productionPublished;
  const completionEnabled = validationCompleted;
  const productionCheckState = completed || productionPublished || preflightVerified ? "done" : !productionEnabled ? "disabled" : domainFixed ? "current" : "blocked";
  const productionDeployState = completed || productionPublished ? "done" : !productionEnabled || !preflightVerified ? "disabled" : "current";

  return [
    {
      key: "staging",
      label: "预发",
      state: stagingCompleted ? "done" : "current",
      summary: stagingCompleted ? "已完成 · 4 / 4" : "当前 · 预检与部署",
      progress: stagingCompleted ? "4 / 4 已通过" : "执行中",
      description: "候选来源经预检和构建后，以同一 Manifest 完成预发部署与验证。",
      children: [
        step("preflight", "预检", "来源、版本与策略有效", stagingCompleted ? "done" : "current", "确认候选来源、版本格式和发布策略能够进入构建。", [...sourceFacts, ["发布策略", `${projectFacts.releasePolicy} · ${projectFacts.releasePolicyDetail}`], ["检查结果", "3 / 3 已通过"]], {
          checks: [check("发布顺序", "预发必须先于生产"), check("发布策略", `${projectFacts.releasePolicy} · ${projectFacts.releasePolicyDetail}`)],
        }),
        step(
          "build",
          "构建",
          `Manifest ${currentRelease.manifestId}`,
          stagingCompleted ? "done" : "disabled",
          "三个项目组件已生成可复用的构建资源，并写入同一份不可变 Manifest。",
          [
            ["构建来源", currentRelease.source],
            ["Manifest", currentRelease.manifestId],
            ["制品摘要", currentRelease.manifestDigest],
            ["构建结果", "3 / 3 资源完成"],
          ],
          {
            resources: buildResources,
            checks: [check("不可变制品", `${currentRelease.manifestId} · ${currentRelease.manifestDigest}`, "success", "manifest")],
            evidence: "manifest",
          },
        ),
        step("staging-deploy", "预发部署", stagingCompleted ? "DeploymentRun 已完成" : "等待构建完成", stagingCompleted ? "done" : "disabled", "以构建阶段生成的同一 Manifest 部署到预发环境。", [
          ["目标环境", "预发环境"],
          ["目标组件", "web / api / postgres"],
          ["执行结果", stagingCompleted ? "DeploymentRun 已完成" : "等待构建完成"],
        ]),
        step(
          "staging-verify",
          "预发验证",
          stagingCompleted ? "6 / 6 检查通过" : "等待预发部署",
          stagingCompleted ? "done" : "disabled",
          "预发部署完成后执行健康检查、入口探测和发布策略验证。",
          [
            ["验证结果", stagingCompleted ? "6 / 6 检查通过" : "尚未开始"],
            ["验证对象", "组件健康、入口与策略"],
            ["证据时间", stagingCompleted ? "12:36" : "—"],
          ],
          {
            checks: [check("预发验证", stagingCompleted ? "6 / 6 检查通过 · 12:36" : "等待预发部署", stagingCompleted ? "success" : "warning", stagingCompleted ? "verified" : null)],
            evidence: stagingCompleted ? "verified" : null,
          },
        ),
      ],
    },
    {
      key: "production",
      label: "生产",
      state: completed || productionPublished ? "done" : productionEnabled ? "current" : "disabled",
      summary: completed || productionPublished ? "已完成 · 2 / 2" : productionEnabled ? "当前 · 生产门禁" : "预发完成后可用",
      progress: completed || productionPublished ? "2 / 2 已完成" : preflightVerified ? "1 / 2 已通过" : "0 / 2 待处理",
      description: "生产保护先完成服务端门禁检查，再由用户确认创建生产 DeploymentRun。",
      children: [
        step(
          "production-check",
          "生产检查",
          completed || productionPublished || preflightVerified ? "服务端门禁已通过" : !productionEnabled ? "等待预发完成" : domainFixed ? "入口已保存，等待重新检查" : "缺少生产域名入口",
          productionCheckState,
          "核对生产入口、TLS、目标组件、审批与并发保护。",
          [
            ["目标环境", "生产环境"],
            ["生产入口", domainFixed ? "草案已保存" : "尚未配置"],
            ["检查结果", completed || productionPublished || preflightVerified ? "服务端门禁已通过" : "生产部署仍被锁定"],
          ],
          {
            checks: [check("生产入口", domainFixed ? "草案已保存，待服务端确认" : "尚未配置", domainFixed ? "warning" : "blocked"), check("生产审批", "生产负责人 · 部署前确认"), check("并发保护", "当前无其他生产运行")],
          },
        ),
        step(
          "production-deploy",
          "生产部署",
          completed || productionPublished ? "DeploymentRun 已完成" : preflightVerified ? "已解锁，等待人工开始" : "生产检查通过后解锁",
          productionDeployState,
          "复用预发验证通过的 Manifest 创建生产 DeploymentRun。",
          [
            ["目标环境", "生产环境"],
            ["部署制品", currentRelease.manifestId],
            ["执行状态", completed || productionPublished ? "已完成" : preflightVerified ? "等待人工开始" : "尚未解锁"],
          ],
          {
            checks: [check("制品完整性", "复用预发通过的 Manifest", "success", "manifest")],
            evidence: completed || productionPublished ? "verified" : "manifest",
          },
        ),
      ],
    },
    {
      key: "validation",
      label: "验证",
      state: completed || validationCompleted ? "done" : validationEnabled ? "current" : "disabled",
      summary: completed || validationCompleted ? "已完成 · 2 / 2" : validationEnabled ? "当前 · 生产验证" : "生产部署后可用",
      progress: completed || validationCompleted ? "2 / 2 已通过" : validationEnabled ? "0 / 2 验证中" : "尚未解锁",
      description: "生产部署完成后运行组件健康检查与用户入口探测。",
      children: [
        step(
          "health-check",
          "健康检查",
          completed || validationCompleted ? "组件健康检查通过" : validationEnabled ? "等待执行" : "等待生产部署",
          completed || validationCompleted ? "done" : validationEnabled ? "current" : "disabled",
          "检查生产环境全部组件的健康状态。",
          [
            ["验证对象", "web / api / postgres"],
            ["执行状态", completed || validationCompleted ? "已通过" : validationEnabled ? "等待执行" : "尚未解锁"],
          ],
          {
            checks: [check("组件健康", completed || validationCompleted ? "3 / 3 组件健康" : "等待生产部署完成", completed || validationCompleted ? "success" : "warning", completed || validationCompleted ? "verified" : null)],
          },
        ),
        step(
          "route-probe",
          "入口探测",
          completed || validationCompleted ? "HTTPS 入口可达" : validationEnabled ? "等待健康检查" : "等待生产部署",
          completed || validationCompleted ? "done" : validationEnabled ? "upcoming" : "disabled",
          "验证生产域名、TLS 和用户访问路径。",
          [
            ["验证入口", "picshare.acme.dev"],
            ["执行状态", completed || validationCompleted ? "HTTPS 200" : validationEnabled ? "等待健康检查" : "尚未解锁"],
          ],
          {
            checks: [check("入口探测", completed || validationCompleted ? "HTTPS 200 · TLS 有效" : "等待组件健康", completed || validationCompleted ? "success" : "warning", completed || validationCompleted ? "verified" : null)],
          },
        ),
      ],
    },
    {
      key: "complete",
      label: "完成",
      state: completed ? "done" : completionEnabled ? "current" : "disabled",
      summary: completed ? "已完成 · 结果已写入" : completionEnabled ? "当前 · 确认结果" : "验证通过后可用",
      progress: completed ? "发布已完成" : completionEnabled ? "等待服务端确认" : "尚未解锁",
      description: "验证通过后，服务端写入最终发布结果和 EnvironmentVersion 审计记录。",
      children: [
        step(
          "result-confirmation",
          "结果确认",
          completed ? "EnvironmentVersion 已更新" : completionEnabled ? "等待服务端写入" : "等待验证完成",
          completed ? "done" : completionEnabled ? "current" : "disabled",
          "服务端确认发布结果并更新当前运行版本。",
          [
            ["发布结果", completed ? "已完成" : completionEnabled ? "等待服务端确认" : "尚未解锁"],
            ["运行版本", completed ? "图库重构 1.4.0" : "尚未更新"],
          ],
          {
            checks: [check("结果写入", completed ? "EnvironmentVersion 已更新" : "验证通过后执行", completed ? "success" : "warning", completed ? "verified" : null)],
          },
        ),
      ],
    },
  ];
}
