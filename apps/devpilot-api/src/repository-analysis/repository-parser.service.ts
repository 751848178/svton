import { Injectable } from "@nestjs/common";
import { applyComposeEvidence } from "./repository-compose-detector.utils";
import { detectRepositoryMigrationEvidence } from "./repository-migration-evidence.utils";
import {
  detectPackageServices,
  detectRepositoryPackageFacts,
} from "./repository-package-detector.utils";
import {
  RepositoryAnalysisResult,
  RepositoryInventory,
} from "./repository-parser.types";

@Injectable()
export class RepositoryParserService {
  parse(inventory: RepositoryInventory): RepositoryAnalysisResult {
    const repository = detectRepositoryPackageFacts(inventory);
    const services = detectPackageServices(inventory);
    const composeCandidates = applyComposeEvidence(inventory, services);
    const warnings = this.collectWarnings(services, composeCandidates.length);
    const resourceRequirements = [
      ...new Set(services.flatMap((service) => service.databases)),
    ].sort();
    return {
      repository: {
        ...repository,
        monorepo: repository.monorepo || services.length > 1,
      },
      services,
      composeCandidates,
      migrationEvidence: detectRepositoryMigrationEvidence(inventory, services),
      resourceRequirements,
      warnings,
      evidence: [
        ...repository.lockfiles.map((file) => ({
          file,
          kind: "lockfile",
          detail: `包管理锁文件 ${file}`,
          confidence: "high" as const,
        })),
        ...composeCandidates.flatMap((candidate) => candidate.evidence),
      ],
    };
  }

  private collectWarnings(
    services: RepositoryAnalysisResult["services"],
    composeCount: number,
  ): string[] {
    const warnings: string[] = [];
    if (composeCount > 1) {
      warnings.push(
        `检测到 ${composeCount} 份 Compose 配置，应用前必须确认部署目标。`,
      );
    }
    for (const service of services) {
      const paths = [...new Set(service.healthChecks.map((item) => item.path))];
      if (paths.length > 1) {
        warnings.push(
          `${service.name} 存在多个健康检查 ${paths.join("、")}，需要确认发布门禁。`,
        );
      }
      if (
        !service.deployable &&
        !service.artifactOnly &&
        service.role !== "shared"
      ) {
        warnings.push(`${service.name} 未检测到部署或制品入口。`);
      }
    }
    return warnings;
  }
}
