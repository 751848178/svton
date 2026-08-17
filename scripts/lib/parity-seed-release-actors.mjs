export const PARITY_RELEASE_ACTORS = Object.freeze({
  requester: Object.freeze({
    idKey: "user",
    email: "parity-requester@parity.test",
    name: "Parity Release Requester",
    passwordEnv: "PARITY_REQUESTER_PASSWORD",
    defaultPassword: "ParityRequester123!",
  }),
  reviewer: Object.freeze({
    idKey: "reviewerUser",
    email: "parity-reviewer@parity.test",
    name: "Parity Independent Reviewer",
    passwordEnv: "PARITY_REVIEWER_PASSWORD",
    defaultPassword: "ParityReviewer123!",
  }),
  confirmer: Object.freeze({
    idKey: "confirmerUser",
    email: "parity-confirmer@parity.test",
    name: "Parity Production Confirmer",
    passwordEnv: "PARITY_CONFIRMER_PASSWORD",
    defaultPassword: "ParityConfirmer123!",
  }),
});

export async function seedParityReleaseActors({
  prisma,
  ids,
  environment,
  hashPassword,
}) {
  const receipts = [];
  for (const [releaseRole, actor] of Object.entries(PARITY_RELEASE_ACTORS)) {
    const userId = ids[actor.idKey];
    const password = environment[actor.passwordEnv] || actor.defaultPassword;
    const passwordHash = await hashPassword(password);
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: actor.email,
        name: actor.name,
        passwordHash,
        role: "user",
      },
      update: { email: actor.email, name: actor.name, passwordHash },
    });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: ids.team, userId } },
      create: { teamId: ids.team, userId, role: "admin" },
      update: { role: "admin" },
    });
    receipts.push({ releaseRole, userId, email: actor.email });
  }
  return Object.freeze(receipts);
}
