import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { CryptoService } from "../common/crypto/crypto.service";
import type { ReleaseDeploymentInputService } from "./release-deployment-input.service";

export type ReleaseDeploymentInputDrift = "config" | "resource" | "target";

export async function driftReleaseDeploymentInput(
  prisma: PrismaClient,
  ids: { revisionId: string; resourceId: string; serverId: string },
  kind: ReleaseDeploymentInputDrift,
) {
  if (kind === "config") {
    const row = await prisma.environmentConfigRevision.findUniqueOrThrow({
      where: { id: ids.revisionId },
      select: { plainVariables: true },
    });
    await prisma.environmentConfigRevision.update({
      where: { id: ids.revisionId },
      data: { plainVariables: { PLAIN_F432: "drifted" } },
    });
    return () =>
      prisma.environmentConfigRevision.update({
        where: { id: ids.revisionId },
        data: {
          plainVariables: row.plainVariables as Prisma.InputJsonValue,
        },
      });
  }
  if (kind === "resource") {
    const row = await prisma.resourceInstance.findUniqueOrThrow({
      where: { id: ids.resourceId },
      select: { delivery: true },
    });
    await prisma.resourceInstance.update({
      where: { id: ids.resourceId },
      data: { delivery: { host: "drifted.internal" } },
    });
    return () =>
      prisma.resourceInstance.update({
        where: { id: ids.resourceId },
        data: { delivery: row.delivery as Prisma.InputJsonValue },
      });
  }
  const row = await prisma.server.findUniqueOrThrow({
    where: { id: ids.serverId },
    select: { host: true },
  });
  await prisma.server.update({
    where: { id: ids.serverId },
    data: { host: "drifted.example" },
  });
  return () =>
    prisma.server.update({
      where: { id: ids.serverId },
      data: { host: row.host },
    });
}

export async function withReleaseDeploymentInputDrift<T>(
  inputs: ReleaseDeploymentInputService,
  prisma: PrismaClient,
  ids: { revisionId: string; resourceId: string; serverId: string },
  kind: ReleaseDeploymentInputDrift,
  action: () => Promise<T>,
) {
  const prepare = inputs.prepare.bind(inputs);
  let restore: (() => Promise<unknown>) | undefined;
  inputs.prepare = async (input) => {
    const prepared = await prepare(input);
    restore = await driftReleaseDeploymentInput(prisma, ids, kind);
    return prepared;
  };
  try {
    return await action();
  } finally {
    inputs.prepare = prepare;
    await restore?.();
  }
}

export async function withForeignReleaseTargetScope<T>(
  prisma: PrismaClient,
  crypto: CryptoService,
  input: { bindingId: string; teamId: string },
  action: () => Promise<T>,
) {
  const foreignTeam = await prisma.team.create({
    data: { id: `f432-foreign-${randomUUID()}`, name: "F432 foreign team" },
  });
  await prisma.projectEnvironmentServer.update({
    where: { id: input.bindingId },
    data: { teamId: foreignTeam.id },
  });
  const cbc = jest.spyOn(crypto, "decryptCbc");
  const gcm = jest.spyOn(crypto, "decryptGcm");
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await action() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const decrypted = cbc.mock.calls.length + gcm.mock.calls.length;
  cbc.mockRestore();
  gcm.mockRestore();
  await prisma.projectEnvironmentServer.update({
    where: { id: input.bindingId },
    data: { teamId: input.teamId },
  });
  await prisma.team.delete({ where: { id: foreignTeam.id } });
  if (decrypted) {
    throw new Error("foreign deployment target caused managed input decrypt");
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
