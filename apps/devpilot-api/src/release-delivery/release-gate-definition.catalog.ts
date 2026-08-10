import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGatePhase,
} from "./release-gate-catalog.types";

type RawGate = [string, string, string, string[], ReleaseGateCapabilityId | null];
const gates = (phase: ReleaseGatePhase, rows: RawGate[]): ReleaseGateDefinition[] =>
  rows.map(([id, zh, en, dispositions, capabilityId], index) => ({
    id, phase, ordinal: index + 1, title: { zh, en }, dispositions, capabilityId,
    delivery: capabilityId ? "mvp" : "target",
  }));

const COMMIT = gates("commit", [
  ["C01", "仓库、分支与 Commit 可解析", "Repository, branch, and Commit are resolvable", ["block"], "M01"],
  ["C02", "合并、落后与冲突状态", "Merge, behind, and conflict status", ["block"], "M01"],
  ["C03", "必需 CI 与代码审批", "Required CI and code approval", ["block", "manual"], "M01"],
  ["C04", "Commit 或 Tag 签名", "Commit or Tag signature", ["block", "warning"], null],
  ["C05", "Monorepo 影响范围", "Monorepo impact scope", ["block", "manual"], "M02"],
  ["C06", "高风险目录变更", "High-risk directory changes", ["manual"], "M02"],
  ["C07", "源码密钥扫描", "Source Secret scan", ["block"], "M04"],
  ["C08", "依赖声明与锁文件一致", "Dependency declarations match lockfiles", ["block", "auto_fix"], "M03"],
  ["C09", "Lint、类型与静态质量", "Lint, types, and static quality", ["block", "auto_fix"], "M03"],
  ["C10", "SAST 与代码安全", "SAST and code security", ["block", "manual"], "M04"],
]);

const BUILD = gates("build", [
  ["B01", "锁定依赖的干净安装", "Clean install with locked dependencies", ["block"], "M03"],
  ["B02", "受影响组件编译打包", "Build affected components", ["block"], "M03"],
  ["B03", "单元、集成与契约测试", "Unit, integration, and contract tests", ["block"], "M03"],
  ["B04", "E2E 关键业务测试", "Critical business E2E tests", ["block", "not_configured"], null],
  ["B05", "覆盖率阈值", "Coverage threshold", ["block", "warning"], null],
  ["B06", "依赖与镜像漏洞", "Dependency and image vulnerabilities", ["block"], "M04"],
  ["B07", "开源许可证策略", "Open-source license policy", ["block", "manual"], null],
  ["B08", "SBOM 生成与绑定", "SBOM generation and binding", ["auto_fix"], null],
  ["B09", "不可变制品 Digest", "Immutable artifact Digest", ["block"], "M05"],
  ["B10", "构建来源证明", "Build provenance", ["auto_fix"], null],
  ["B11", "制品签名与可信构建器", "Artifact signing and trusted builder", ["block"], null],
]);

const DEPLOY = gates("deploy", [
  ["D01", "环境与部署目标绑定", "Environment and deployment target binding", ["block"], "M07"],
  ["D02", "运行配置完整性", "Runtime configuration completeness", ["block", "auto_fix"], "M06"],
  ["D03", "密钥引用可用性", "Secret reference availability", ["block", "manual"], "M06"],
  ["D04", "发布身份最小权限", "Least privilege for release identity", ["block", "manual"], null],
  ["D05", "CPU、内存、磁盘与配额", "CPU, memory, disk, and quota", ["block", "warning"], "M08"],
  ["D06", "发布策略额外容量", "Extra capacity for release strategy", ["block", "disable_capability"], "M15"],
  ["D07", "集群、服务器与镜像仓库连通", "Cluster, server, and registry connectivity", ["block"], "M07"],
  ["D08", "数据库与中间件连通", "Database and middleware connectivity", ["block", "warning"], "M07"],
  ["D09", "网络策略与服务发现", "Network policy and service discovery", ["block"], "M07"],
  ["D10", "Schema Drift 与迁移顺序", "Schema drift and migration order", ["block"], "M09"],
  ["D11", "破坏性迁移与数据回填", "Destructive migrations and backfill", ["block", "manual"], "M09"],
  ["D12", "备份与恢复点", "Backup and recovery point", ["block"], "M09"],
  ["D13", "审批、变更窗口与冻结期", "Approval, change window, and freeze", ["block", "manual"], "M10"],
  ["D14", "DNS 记录与域名归属", "DNS records and domain ownership", ["block", "manual"], "M11"],
  ["D15", "TLS 证书与密钥引用", "TLS certificate and key reference", ["block", "auto_fix"], "M11"],
  ["D16", "Host、Path 与上游路由", "Host, Path, and upstream routing", ["block"], "M11"],
  ["D17", "启动与健康探针配置", "Startup and health probe configuration", ["block"], "M12"],
  ["D18", "日志、指标、Trace 与告警", "Logs, metrics, Trace, and alerts", ["block"], "M13"],
  ["D19", "上一稳定制品可恢复", "Previous stable artifact is recoverable", ["block"], "M14"],
  ["D20", "代码与数据恢复兼容性", "Code and data recovery compatibility", ["block", "manual"], "M14"],
]);

const PROMOTE = gates("promote", [
  ["P01", "新实例与工作负载就绪", "New instances and workloads are ready", ["block"], "M12"],
  ["P02", "HTTP 可访问性检查", "HTTP accessibility check", ["block"], "M12"],
  ["P03", "关键业务验证", "Critical business validation", ["block", "manual"], "M12"],
  ["P04", "错误率、延迟与业务指标", "Error rate, latency, and business metrics", ["block"], "M13"],
  ["P05", "观察时间与样本量", "Observation window and sample size", ["block"], null],
  ["P06", "指标无数据或结论不明", "Metrics missing or inconclusive", ["pause", "manual"], null],
  ["P07", "下一流量阶段审批", "Approval for next traffic stage", ["manual", "auto"], null],
  ["P08", "自动终止与流量回切条件", "Automatic abort and traffic rollback conditions", ["auto_fix", "disable_capability"], "M15"],
  ["P09", "全量后稳定观察", "Post-rollout stability observation", ["block"], null],
  ["P10", "发布证据与豁免留存", "Release evidence and waiver retention", ["block"], "M14"],
]);

export const RELEASE_GATE_DEFINITIONS = [...COMMIT, ...BUILD, ...DEPLOY, ...PROMOTE];
