import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { ConfiguredReleaseDeploymentProviderService } from "./configured-release-deployment-provider.service";
import { LocalFilesystemDeploymentProviderService } from "./local-filesystem-deployment-provider.service";
import {
  ReleaseArtifactArchivePort,
  UnzipReleaseArtifactArchiveService,
} from "./release-artifact-archive.service";
import { ReleaseDeploymentProviderPort } from "./release-deployment-provider.types";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";
import { ReleaseRuntimeEnvironmentFileService } from "./release-runtime-environment-file.service";
import { SshReleaseDeploymentProviderService } from "./ssh-release-deployment-provider.service";

export const releaseDeploymentProviders = [
  LocalFilesystemDeploymentProviderService,
  SshReleaseDeploymentProviderService,
  ConfiguredReleaseDeploymentProviderService,
  UnzipReleaseArtifactArchiveService,
  SshTransportFactory,
  ReleaseDeploymentInputService,
  ReleaseRuntimeEnvironmentFileService,
  {
    provide: ReleaseArtifactArchivePort,
    useExisting: UnzipReleaseArtifactArchiveService,
  },
  {
    provide: ReleaseDeploymentProviderPort,
    useExisting: ConfiguredReleaseDeploymentProviderService,
  },
];
