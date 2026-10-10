-- Additive identity only: old Actors, AuthSessions and project ledgers are untouched.
-- Keep these custom SQLite CHECKs when generating later table migrations.
BEGIN IMMEDIATE;

CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "incarnation" TEXT NOT NULL,
    "approvedRole" TEXT NOT NULL,
    "resourceKind" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "credentialRevision" INTEGER NOT NULL DEFAULT 1,
    "trustRevision" INTEGER NOT NULL DEFAULT 1,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "draining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Agent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("id" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("id", '-', '')) = 32 AND "id" NOT GLOB '*[^0-9a-f-]*'),
    CHECK ("incarnation" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("incarnation", '-', '')) = 32 AND "incarnation" NOT GLOB '*[^0-9a-f-]*'),
    CHECK (length(trim("name")) > 0 AND length("name") <= 128),
    CHECK ("approvedRole" IN ('runtime', 'builder', 'both')),
    CHECK ("resourceKind" = 'persistent'),
    CHECK (length("credentialHash") = 64 AND "credentialHash" NOT GLOB '*[^0-9a-f]*'),
    CHECK (typeof("credentialRevision") = 'integer' AND "credentialRevision" BETWEEN 1 AND 2147483647),
    CHECK (typeof("trustRevision") = 'integer' AND "trustRevision" BETWEEN 1 AND 2147483647),
    CHECK ("disabled" IN (0, 1) AND "draining" IN (0, 1))
);

CREATE TABLE "AgentEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "issuedByActorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvedRole" TEXT NOT NULL,
    "resourceKind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "consumedAt" DATETIME,
    "attemptId" TEXT,
    "requestHash" TEXT,
    "agentId" TEXT,
    "recoveryUntil" DATETIME,
    "receiptJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentEnrollment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentEnrollment_issuedByActorId_fkey" FOREIGN KEY ("issuedByActorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentEnrollment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("id" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("id", '-', '')) = 32 AND "id" NOT GLOB '*[^0-9a-f-]*'),
    CHECK ("attemptId" IS NULL OR ("attemptId" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("attemptId", '-', '')) = 32 AND "attemptId" NOT GLOB '*[^0-9a-f-]*')),
    CHECK (length(trim("name")) > 0 AND length("name") <= 128),
    CHECK ("approvedRole" IN ('runtime', 'builder', 'both') AND "resourceKind" = 'persistent'),
    CHECK (length("tokenHash") = 64 AND "tokenHash" NOT GLOB '*[^0-9a-f]*'),
    CHECK ("requestHash" IS NULL OR (length("requestHash") = 64 AND "requestHash" NOT GLOB '*[^0-9a-f]*')),
    CHECK (("consumedAt" IS NULL AND "attemptId" IS NULL AND "requestHash" IS NULL AND "agentId" IS NULL AND "recoveryUntil" IS NULL AND "receiptJson" IS NULL)
        OR ("consumedAt" IS NOT NULL AND "attemptId" IS NOT NULL AND "requestHash" IS NOT NULL AND "agentId" IS NOT NULL AND "recoveryUntil" IS NOT NULL AND "receiptJson" IS NOT NULL)),
    CHECK ("receiptJson" IS NULL OR length("receiptJson") BETWEEN 2 AND 1024)
);

CREATE TABLE "AgentSession" (
    "agentId" TEXT NOT NULL PRIMARY KEY,
    "epoch" INTEGER NOT NULL,
    "bootId" TEXT NOT NULL,
    "incarnation" TEXT NOT NULL,
    "credentialRevision" INTEGER NOT NULL,
    "trustRevision" INTEGER NOT NULL,
    "openRequestHash" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "lastPayloadHash" TEXT,
    "lastReceiptJson" TEXT,
    "lastSeenAt" DATETIME NOT NULL,
    "leaseExpiresAt" DATETIME NOT NULL,
    "reportedRole" TEXT NOT NULL,
    "capabilitiesJson" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "docker" BOOLEAN NOT NULL,
    CONSTRAINT "AgentSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (typeof("epoch") = 'integer' AND "epoch" BETWEEN 1 AND 2147483647),
    CHECK (typeof("credentialRevision") = 'integer' AND "credentialRevision" BETWEEN 1 AND 2147483647),
    CHECK (typeof("trustRevision") = 'integer' AND "trustRevision" BETWEEN 1 AND 2147483647),
    CHECK ("bootId" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("bootId", '-', '')) = 32 AND "bootId" NOT GLOB '*[^0-9a-f-]*'),
    CHECK ("incarnation" GLOB '????????-????-[1-8]???-[89ab]???-????????????' AND length(replace("incarnation", '-', '')) = 32 AND "incarnation" NOT GLOB '*[^0-9a-f-]*'),
    CHECK (length("openRequestHash") = 64 AND "openRequestHash" NOT GLOB '*[^0-9a-f]*'),
    CHECK (typeof("lastSequence") = 'integer' AND "lastSequence" BETWEEN 0 AND 2147483647),
    CHECK ("lastPayloadHash" IS NULL OR (length("lastPayloadHash") = 64 AND "lastPayloadHash" NOT GLOB '*[^0-9a-f]*')),
    CHECK (("lastSequence" = 0 AND "lastPayloadHash" IS NULL AND "lastReceiptJson" IS NULL)
        OR ("lastSequence" >= 1 AND "lastPayloadHash" IS NOT NULL AND "lastReceiptJson" IS NOT NULL)),
    CHECK ("lastReceiptJson" IS NULL OR length("lastReceiptJson") BETWEEN 2 AND 1024),
    CHECK ("reportedRole" IN ('runtime', 'builder', 'both')),
    CHECK (length("capabilitiesJson") BETWEEN 2 AND 1024 AND length("version") BETWEEN 1 AND 64),
    CHECK ("docker" IN (0, 1))
);

CREATE UNIQUE INDEX "Agent_actorId_key" ON "Agent"("actorId");
CREATE UNIQUE INDEX "Agent_credentialHash_key" ON "Agent"("credentialHash");
CREATE INDEX "Agent_workspaceId_disabled_idx" ON "Agent"("workspaceId", "disabled");
CREATE UNIQUE INDEX "Agent_workspaceId_incarnation_key" ON "Agent"("workspaceId", "incarnation");
CREATE UNIQUE INDEX "AgentEnrollment_tokenHash_key" ON "AgentEnrollment"("tokenHash");
CREATE UNIQUE INDEX "AgentEnrollment_attemptId_key" ON "AgentEnrollment"("attemptId");
CREATE INDEX "AgentEnrollment_workspaceId_expiresAt_idx" ON "AgentEnrollment"("workspaceId", "expiresAt");
CREATE INDEX "AgentSession_leaseExpiresAt_idx" ON "AgentSession"("leaseExpiresAt");

COMMIT;
