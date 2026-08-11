import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import { FilesystemIsolatedReleaseBuildExecutorService } from "./filesystem-isolated-release-build-executor.service";
import { ReleaseBuildExecutorPort } from "./release-build.types";
import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";
import { ReleaseDependencyApiCoordinator } from "./release-dependency-api-coordinator.service";

export const releaseBuildSecurityProviders = [
  ReleaseBuildScannerEvidenceService,
  ReleaseBuildSourceSnapshotService,
  ReleaseBuildPreScriptSecurityService,
  FilesystemIsolatedReleaseBuildExecutorService,
  ReleaseDependencyFetchRepository,
  ReleaseDependencyApiCoordinator,
];

export const filesystemReleaseBuildExecutorProvider = {
  provide: ReleaseBuildExecutorPort,
  useExisting: FilesystemIsolatedReleaseBuildExecutorService,
};
