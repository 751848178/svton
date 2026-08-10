import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SiteRouteSwitchSagaOrchestrator } from "./site-route-switch-saga.orchestrator";
import { SiteRouteSwitchSagaRecoveryRepository } from "./site-route-switch-saga-recovery.repository";

const POLL_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 60_000;

@Injectable()
export class SiteRouteSwitchSagaRecoveryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SiteRouteSwitchSagaRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly saga: SiteRouteSwitchSagaOrchestrator,
    private readonly repository: SiteRouteSwitchSagaRecoveryRepository,
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
    const due = await this.repository.due(
      now,
      new Date(now.getTime() - STALE_AFTER_MS),
    );
    let recovered = 0;
    for (const item of due) {
      const leaseId = randomUUID();
      if (!(await this.repository.claim(item.operationId, leaseId, now))) {
        continue;
      }
      try {
        if (item.status === "compensating") {
          const reset = await this.repository.requeueStaleCompensation(
            item.operationId,
            leaseId,
          );
          if (reset.count !== 1) {
            await this.repository.release(item.operationId, leaseId, null);
            continue;
          }
        }
        const result = await this.saga.compensate(
          item.operationId,
          item.lastError ?? "stale_route_switch_saga",
        );
        await this.repository.release(
          item.operationId,
          leaseId,
          result === "compensation_required"
            ? nextRecovery(now, item.recoveryAttemptCount + 1)
            : null,
        );
        recovered += 1;
      } catch (error) {
        await this.repository.release(
          item.operationId,
          leaseId,
          nextRecovery(now, item.recoveryAttemptCount + 1),
        );
        this.logger.error(
          `Route saga recovery failed: ${item.operationId}`,
          error,
        );
      }
    }
    const alerted = await this.repository.alertExhausted(now);
    for (const alert of alerted) {
      this.logger.error(
        `Production route saga exhausted: operationId=${alert.operationId} status=${alert.status} teamId=${alert.teamId} projectId=${alert.projectId ?? "none"} environmentId=${alert.environmentId ?? "none"} siteId=${alert.siteId} deploymentRunId=${alert.deploymentRunId ?? "none"} lastError=${alert.lastError ?? "unknown"}`,
      );
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
    try {
      await this.runOnce();
    } catch (error) {
      this.logger.error("Production route saga recovery cycle failed", error);
    } finally {
      this.running = false;
      if (!this.stopped) this.schedule(POLL_INTERVAL_MS);
    }
  }
}

function nextRecovery(now: Date, attempt: number) {
  return new Date(now.getTime() + routeSagaRecoveryBackoff(attempt));
}

export function routeSagaRecoveryBackoff(attempt: number) {
  return Math.min(300_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}
