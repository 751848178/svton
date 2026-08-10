import type { ReleaseGateCapabilityDefinition } from "./release-gate-catalog.types";

const capability = (id: ReleaseGateCapabilityDefinition["id"], zh: string, en: string) => ({
  id, name: { zh, en },
});

export const RELEASE_GATE_CAPABILITIES: ReleaseGateCapabilityDefinition[] = [
  capability("M01", "来源与必需 CI", "Source and required CI"),
  capability("M02", "变更影响识别", "Change impact detection"),
  capability("M03", "构建、锁文件与关键测试", "Build, lockfile, and critical tests"),
  capability("M04", "Secret 与高危漏洞", "Secrets and critical vulnerabilities"),
  capability("M05", "不可变制品", "Immutable artifacts"),
  capability("M06", "配置与密钥完整性", "Configuration and Secret integrity"),
  capability("M07", "资源绑定与连通性", "Resource binding and connectivity"),
  capability("M08", "容量检查", "Capacity checks"),
  capability("M09", "迁移与备份", "Migration and backup"),
  capability("M10", "生产审批", "Production approval"),
  capability("M11", "DNS、TLS 与路由", "DNS, TLS, and routing"),
  capability("M12", "HTTP 与人工业务验证", "HTTP and manual business validation"),
  capability("M13", "基本可观测性", "Baseline observability"),
  capability("M14", "稳定制品与恢复发布", "Stable artifacts and recovery release"),
  capability("M15", "策略能力门禁", "Strategy capability gates"),
];
