import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { SiteRouteSwitchSagaReadbackService } from "../site/site-route-switch-saga-readback.service";
import { ProductionPromotionRecoveryRepository } from "./production-promotion-recovery.repository";
import { ProductionPromotionService } from "./production-promotion.service";

const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class ProductionPromotionRecoveryService
  implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProductionPromotionRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly repository: ProductionPromotionRecoveryRepository,
    private readonly readback: SiteRouteSwitchSagaReadbackService,
    private readonly promotion: ProductionPromotionService,
  ) {}

  onApplicationBootstrap() {
    this.stopped = false;
    this.schedule(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  async runOnce(now = new Date()) {
    const commands = await this.repository.due(now);
    let recovered = 0;
    for (const command of commands) {
      try {
        const route = command.routeSwitchOperationId
          ? await this.readback.inspect(command.routeSwitchOperationId)
          : "prepared";
        if (route === "committed") {
          if (await this.repository.convergeCommitted(command.id, now)) recovered += 1;
          continue;
        }
        if (["recovering", "unknown"].includes(route)) continue;
        if (!command.deploymentRun.environmentId) continue;
        await this.promotion.resume({
          teamId: command.teamId, projectId: command.projectId,
          actorId: command.actorId,
          environmentId: command.deploymentRun.environmentId,
          releaseRunId: command.releaseRunId,
          deploymentRunId: command.deploymentRunId,
          candidateHash: command.candidateHash,
          idempotencyKey: command.idempotencyKey,
        });
        recovered += 1;
      } catch (error) {
        this.logger.error(`Production promotion recovery failed: ${command.id}`, error);
      }
    }
    return recovered;
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delay);
    this.timer.unref?.();
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try { await this.runOnce(); }
    catch (error) { this.logger.error("Production promotion recovery cycle failed", error); }
    finally {
      this.running = false;
      if (!this.stopped) this.schedule(POLL_INTERVAL_MS);
    }
  }
}
