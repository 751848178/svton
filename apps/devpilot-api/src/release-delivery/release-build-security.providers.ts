import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import { FilesystemIsolatedReleaseBuildExecutorService } from "./filesystem-isolated-release-build-executor.service";
import { ReleaseBuildExecutorPort } from "./release-build.types";

export const releaseBuildSecurityProviders = [
  ReleaseBuildScannerEvidenceService,
  ReleaseBuildSourceSnapshotService,
  ReleaseBuildPreScriptSecurityService,
  FilesystemIsolatedReleaseBuildExecutorService,
];

export const filesystemReleaseBuildExecutorProvider = {
  provide: ReleaseBuildExecutorPort,
  useExisting: FilesystemIsolatedReleaseBuildExecutorService,
};
