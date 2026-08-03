import { Injectable } from "@nestjs/common";
import type {
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import {
  evaluated,
  type ReleaseGateCapabilityProvider,
  unavailable,
} from "./release-gate-provider.types";

@Injectable()
export class ReleaseGateArtifactCapabilityProvider
implements ReleaseGateCapabilityProvider {
  readonly providerKey = "artifact_manifest";
  readonly capabilityIds: ReleaseGateCapabilityId[] = ["M05"];

  available(
    _capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ) {
    return Boolean(context.buildRuns[0]);
  }

  evaluate(
    _definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ) {
    const build = context.buildRuns[0];
    const manifest = build?.manifest;
    if (!build) {
      return unavailable("build_missing", "发布单尚无 BuildRun", "The release order has no BuildRun");
    }
    if (!manifest) {
      const status: ReleaseGateStatus = build.status === "failed"
        || build.status === "succeeded" ? "blocked" : "unchecked";
      return evaluated({
        status,
        reasonCode: build.status === "failed"
          ? "manifest_not_produced" : build.status === "succeeded"
            ? "manifest_invariant_broken" : "manifest_pending",
        zh: build.status === "failed"
          ? `Build #${build.revision} 失败且未产生 Manifest`
          : build.status === "succeeded"
            ? "成功 BuildRun 缺少 Manifest，完整性约束被破坏" : "BuildRun 尚未产生 Manifest",
        en: build.status === "failed"
          ? `Build #${build.revision} failed and produced no Manifest`
          : build.status === "succeeded"
            ? "A successful BuildRun is missing its Manifest; the integrity invariant is broken"
            : "The BuildRun has not produced a Manifest yet",
        evidenceRef: `build-run:${build.id}`,
        checkedAt: build.finishedAt ?? build.startedAt ?? build.createdAt,
        now,
      });
    }
    const digestValid = /^sha256:[a-f0-9]{64}$/i.test(manifest.digest);
    const itemsBound = manifest.items.length > 0
      && manifest.items.every((item) => /^sha256:[a-f0-9]{64}$/i.test(item.digest));
    const checked = build.status === "succeeded" && digestValid && itemsBound;
    return evaluated({
      status: checked ? "checked" : "blocked",
      reasonCode: checked ? "manifest_digest_bound" : "manifest_integrity_invalid",
      zh: checked
        ? `Manifest ${manifest.id} 以 Digest 绑定 Build #${build.revision} 和精确 Commit`
        : "Manifest Digest、条目或 BuildRun 绑定不完整",
      en: checked
        ? `Manifest ${manifest.id} binds its Digest to Build #${build.revision} and exact Commit`
        : "Manifest Digest, items, or BuildRun binding is incomplete",
      evidenceRef: `artifact-manifest:${manifest.id};build-run:${build.id}`,
      checkedAt: manifest.createdAt,
      now,
    });
  }
}
