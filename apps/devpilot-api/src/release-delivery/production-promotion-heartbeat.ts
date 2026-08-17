import type { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import {
  ProductionPromotionLeaseLostError,
  type ProductionPromotionLease,
} from "./production-promotion-lease.policy";

export async function withProductionPromotionHeartbeat<T>(input: {
  commands: ProductionPromotionCommandRepository;
  commandId: string;
  lease: ProductionPromotionLease;
  action: () => Promise<T>;
  intervalMs?: number;
}) {
  let lost: unknown;
  let heartbeat = Promise.resolve();
  const renew = () => {
    heartbeat = heartbeat.then(async () => {
      if (!lost) await input.commands.heartbeat(input.commandId, input.lease)
        .catch((error) => { lost = error; });
    });
  };
  await input.commands.heartbeat(input.commandId, input.lease);
  const timer = setInterval(renew, input.intervalMs ?? 10_000);
  timer.unref();
  try {
    const result = await input.action();
    await heartbeat;
    if (lost) throw new ProductionPromotionLeaseLostError();
    await input.commands.heartbeat(input.commandId, input.lease);
    return result;
  } finally {
    clearInterval(timer);
  }
}
