-- CreateTable
CREATE TABLE "ConfigDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "etag" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "servicesJson" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConfigDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigDraft_projectId_targetKey_fkey" FOREIGN KEY ("projectId", "targetKey") REFERENCES "Target" ("projectId", "targetKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigDraft_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigDraft_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "parentId" TEXT,
    "servicesJson" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfigVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigVersion_projectId_targetKey_fkey" FOREIGN KEY ("projectId", "targetKey") REFERENCES "Target" ("projectId", "targetKey") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigVersion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ConfigDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfigVersion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL DEFAULT 'directory',
    "repositoryJson" TEXT,
    "repositorySecret" TEXT,
    "sourceRevision" INTEGER NOT NULL DEFAULT 1,
    "appName" TEXT,
    "rootPath" TEXT NOT NULL,
    "configPath" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "projectIdentity" TEXT NOT NULL,
    "lastVersion" TEXT NOT NULL DEFAULT '0.0.0',
    "createdByActorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_createdByActorId_fkey" FOREIGN KEY ("createdByActorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("configPath", "createdAt", "createdByActorId", "id", "lastVersion", "name", "projectIdentity", "rootPath", "targetKey", "updatedAt", "workspaceId") SELECT "configPath", "createdAt", "createdByActorId", "id", "lastVersion", "name", "projectIdentity", "rootPath", "targetKey", "updatedAt", "workspaceId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_workspaceId_rootPath_key" ON "Project"("workspaceId", "rootPath");
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT,
    "targetKey" TEXT NOT NULL,
    "baseReleaseId" TEXT,
    "selectionJson" TEXT NOT NULL,
    "privateSnapshot" TEXT,
    "configVersionId" TEXT,
    "snapshotJson" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Plan_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Plan" ("actorId", "baseReleaseId", "createdAt", "expiresAt", "fingerprint", "id", "kind", "projectId", "selectionJson", "snapshotJson", "targetKey", "version") SELECT "actorId", "baseReleaseId", "createdAt", "expiresAt", "fingerprint", "id", "kind", "projectId", "selectionJson", "snapshotJson", "targetKey", "version" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE INDEX "Plan_projectId_createdAt_idx" ON "Plan"("projectId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ConfigDraft_projectId_targetKey_createdAt_idx" ON "ConfigDraft"("projectId", "targetKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_draftId_key" ON "ConfigVersion"("draftId");

-- CreateIndex
CREATE INDEX "ConfigVersion_projectId_targetKey_createdAt_idx" ON "ConfigVersion"("projectId", "targetKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_projectId_targetKey_version_key" ON "ConfigVersion"("projectId", "targetKey", "version");
