-- Allocate deterministic project-local display versions without changing IDs.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
ALTER TABLE "Project" ADD COLUMN "lastVersion" TEXT NOT NULL DEFAULT '0.0.0';
ALTER TABLE "Plan" ADD COLUMN "version" TEXT;

CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "phase" TEXT NOT NULL DEFAULT 'provision',
    "cancelState" TEXT NOT NULL DEFAULT 'none',
    "recoveryState" TEXT NOT NULL DEFAULT 'none',
    "cleanupState" TEXT NOT NULL DEFAULT 'pending',
    "activeScope" TEXT,
    "idempotencyKey" TEXT,
    "actorId" TEXT NOT NULL,
    "remoteReleaseId" TEXT,
    "previousReleaseId" TEXT,
    "error" TEXT,
    "outputJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" (
    "id", "projectId", "planId", "kind", "version", "status", "phase", "cancelState",
    "recoveryState", "cleanupState", "activeScope", "idempotencyKey", "actorId",
    "remoteReleaseId", "previousReleaseId", "error", "outputJson", "createdAt", "startedAt", "finishedAt"
)
SELECT "id", "projectId", "planId", "kind",
    '0.0.' || ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id"),
    "status", "phase", "cancelState", "recoveryState", "cleanupState", "activeScope",
    "idempotencyKey", "actorId", "remoteReleaseId", "previousReleaseId", "error", "outputJson",
    "createdAt", "startedAt", "finishedAt"
FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_activeScope_key" ON "Task"("activeScope");
CREATE UNIQUE INDEX "Task_idempotencyKey_key" ON "Task"("idempotencyKey");
CREATE UNIQUE INDEX "Task_projectId_version_key" ON "Task"("projectId", "version");
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");
UPDATE "Project" SET "lastVersion" = '0.0.' || (SELECT COUNT(*) FROM "Task" WHERE "Task"."projectId" = "Project"."id");
-- Legacy plans can have been reused by multiple attempts: detail uses Task.version.
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
