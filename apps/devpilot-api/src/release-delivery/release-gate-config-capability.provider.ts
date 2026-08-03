import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  record,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

@Injectable()
export class ReleaseGateConfigCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "environment_config_revision";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M06"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.deploy?.environment?.currentConfigRevision);
  }

  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    const environment = context.deploy?.environment;
    const revision = environment?.currentConfigRevision;
    if (!environment || !revision) {
      return unavailable(
        "staging_config_revision_missing",
        "Staging 环境没有当前配置修订",
        "The Staging environment has no current configuration revision",
      );
    }
    return definition.id === "D02"
      ? this.config(context, environment.id, revision, now)
      : this.secrets(context, environment.id, revision, now);
  }

  private config(
    context: ReleaseGateEvidenceContext,
    environmentId: string,
    revision: NonNullable<NonNullable<ReleaseGateEvidenceContext["deploy"]>["environment"]>["currentConfigRevision"] & {},
    now: Date,
  ) {
    const plain = record(revision.plainVariables);
    const route = record(revision.routeSnapshot);
    const secrets = arrayRecords(revision.secretReferences);
    const references = arrayRecords(revision.resourceReferences);
    const policies = Array.isArray(revision.policyReferences);
    const variablesValid = Object.entries(plain)
      .every(([key, value]) => /^[A-Z_][A-Z0-9_]*$/.test(key) && typeof value === "string");
    const routeValid = Array.isArray(route.domains ?? [])
      && (route.domains as unknown[]).every((value) => typeof value === "string");
    const resourcesValid = references.every((reference) => {
      const ids = reference.sharedEnvironmentIds;
      const row = context.deploy?.resources.find((item) =>
        item.id === reference.id && item.kind === reference.kind);
      return typeof reference.id === "string"
        && typeof reference.kind === "string"
        && Array.isArray(ids)
        && ids.includes(environmentId)
        && Boolean(row)
        && (!row?.environmentId || ids.includes(row.environmentId));
    });
    const hashValid = /^[a-f0-9]{64}$/i.test(revision.snapshotHash);
    const valid = revision.environmentId === environmentId
      && variablesValid && routeValid && resourcesValid
      && policies && secrets.length === (revision.secretReferences as unknown[]).length
      && hashValid;
    return evaluated({
      status: valid ? "checked" : "blocked",
      reasonCode: valid ? "config_revision_complete" : "config_revision_invalid",
      zh: valid
        ? `Staging 配置 R${revision.revision} 完整，${references.length} 个资源引用均绑定当前环境范围`
        : "配置修订结构、快照 Hash 或资源环境归属无效",
      en: valid
        ? `Staging config R${revision.revision} is complete; ${references.length} resource reference(s) are environment-scoped`
        : "Config revision structure, snapshot hash, or resource environment ownership is invalid",
      evidenceRef: `environment-config-revision:${revision.id};environment:${environmentId}`,
      checkedAt: revision.createdAt,
      now,
    });
  }

  private secrets(
    context: ReleaseGateEvidenceContext,
    environmentId: string,
    revision: NonNullable<NonNullable<ReleaseGateEvidenceContext["deploy"]>["environment"]>["currentConfigRevision"] & {},
    now: Date,
  ) {
    const references = arrayRecords(revision.secretReferences);
    const forbidden = new Set(["value", "secret", "plaintext", "secretPlaintext"]);
    const safe = references.every((reference) =>
      Object.keys(reference).every((key) => !forbidden.has(key)));
    const rows = context.deploy?.secrets ?? [];
    const complete = safe && references.every((reference) => {
      const row = rows.find((item) => item.id === reference.id);
      return Boolean(row)
        && (!row?.projectId || row.projectId === revision.projectId)
        && (!row?.environmentId || row.environmentId === environmentId);
    });
    return evaluated({
      status: complete ? "checked" : "blocked",
      reasonCode: complete ? "secret_references_resolved" : "secret_reference_invalid",
      zh: complete
        ? `${references.length} 个 Secret 仅以引用解析，未读取或返回明文`
        : "Secret 引用缺失、跨项目/环境或包含明文字段",
      en: complete
        ? `${references.length} Secret reference(s) resolved without reading or returning plaintext`
        : "A Secret reference is missing, cross-project/environment, or contains plaintext fields",
      evidenceRef: `environment-config-revision:${revision.id}#secret-references`,
      checkedAt: revision.createdAt,
      now,
    });
  }
}

function arrayRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}
