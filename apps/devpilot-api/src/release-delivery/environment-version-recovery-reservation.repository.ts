import type { Prisma } from "@prisma/client";
import { assertNoActiveProductionRouteSaga, routeSagaScope,
} from "../site/production-route-saga.guard";
import {
  assertNoActiveReleaseRunForEnvironment,
  lockProductionEnvironmentForRelease,
} from "./release-run-concurrency.utils";

type Scope = { teamId: string; projectId: string; environmentId: string };

export async function lockRecoveryProductionEnvironment(
  tx: Prisma.TransactionClient,
  scope: Scope,
) {
  await lockProductionEnvironmentForRelease(tx, scope);
}

export async function assertRecoveryReservationClear(
  tx: Prisma.TransactionClient,
  scope: Scope,
) {
  await assertNoActiveProductionRouteSaga(tx, routeSagaScope(scope));
  await assertNoActiveReleaseRunForEnvironment(tx, scope);
}

export async function assertRecoveryReservationAvailable(
  tx: Prisma.TransactionClient,
  scope: Scope,
) {
  await lockRecoveryProductionEnvironment(tx, scope);
  await assertRecoveryReservationClear(tx, scope);
}
