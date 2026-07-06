import { buildSiteTlsProbeCommand } from "../site/site-tls-probe";
import { isRecord, readOptionalString } from "./server-executor-json.utils";
import {
  ServerCommandStep,
  ServerExecutionInput,
} from "./server-executor.types";

export function isSafeSiteTlsProbeHostname(value: string) {
  return (
    /^[A-Za-z0-9.-]+$/.test(value) &&
    value.includes(".") &&
    !value.includes("..")
  );
}

export function buildSiteTlsProbeWarnings(
  serverId: string | null,
  host: string,
) {
  const warnings: string[] = [];
  if (!serverId) {
    warnings.push("站点未关联服务器，无法通过 Server executor 探测 TLS 证书");
  }
  if (!isSafeSiteTlsProbeHostname(host)) {
    warnings.push(
      "站点主域名包含不支持的字符，已阻止自动 TLS 证书探测命令生成",
    );
  }

  return warnings;
}

export function buildSiteTlsProbeCommandPlan(
  host: string,
): ServerCommandStep[] {
  return [
    {
      key: "probe_tls_certificate",
      label: "探测站点 TLS 证书",
      command: isSafeSiteTlsProbeHostname(host)
        ? buildSiteTlsProbeCommand(host, 443)
        : "",
      preview: `${host}:443`,
      required: true,
      risk: "low",
      timeoutSeconds: 20,
    },
  ];
}

export function buildSiteTlsProbeExecutionInput(
  input: ServerExecutionInput,
  site: {
    id: string;
    projectId: string | null;
    environmentId: string | null;
    primaryDomain: string;
    runtimeType: string;
    tls: unknown;
  },
  commandPlan: ServerCommandStep[],
  warnings: string[],
  followUp: {
    sourceRenewalRunId?: string;
    probeRunId: string;
    host: string;
  },
): ServerExecutionInput {
  return {
    teamId: input.teamId,
    userId: input.userId,
    operationKey: "site.tls_probe",
    adapterKey: "nginx-site-plan",
    dryRun: false,
    target: input.target,
    steps: commandPlan,
    warnings,
    metadata: {
      siteId: site.id,
      siteSyncRunId: followUp.probeRunId,
      projectId: site.projectId,
      environmentId: site.environmentId,
      siteName: site.primaryDomain,
      primaryDomain: site.primaryDomain,
      runtimeType: site.runtimeType,
      configPath: `tls://${followUp.host}:443`,
      tlsProbeHost: followUp.host,
      tlsProbePort: 443,
      tlsType: readOptionalString(
        isRecord(site.tls) ? site.tls.type : undefined,
      ),
      mode: "tls_probe",
      trigger: "renewal_follow_up_tls_probe",
      sourceRunId: followUp.sourceRenewalRunId,
      businessRunSync: "site_sync",
    },
    blockOnWarnings: true,
  };
}
