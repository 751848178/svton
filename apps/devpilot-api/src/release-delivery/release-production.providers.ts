import { ReleaseProductionDnsProbeService } from "./release-production-dns-probe.service";
import { ReleaseProductionPreflightService } from "./release-production-preflight.service";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseProductionService } from "./release-production.service";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseServerCapacityRepository } from "./release-server-capacity.repository";
import { ReleaseServerCapacityService } from "./release-server-capacity.service";

export const releaseProductionProviders = [
  ReleaseProductionWorkloadService,
  ReleaseProductionRepository,
  ReleaseProductionService,
  ReleaseProductionPreflightService,
  ReleaseServerCapacityRepository,
  ReleaseServerCapacityService,
  ReleaseProductionDnsProbeService,
];
