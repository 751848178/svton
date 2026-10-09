-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "configPath" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "projectIdentity" TEXT NOT NULL,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_createdByActorId_fkey" FOREIGN KEY ("createdByActorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "displayName" TEXT,
    CONSTRAINT "Target_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "displayName" TEXT,
    "entryUrl" TEXT,
    CONSTRAINT "Service_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "baseReleaseId" TEXT,
    "selectionJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Plan_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL DEFAULT '',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detailJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemoteJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL DEFAULT '',
    "agentRole" TEXT NOT NULL,
    "urlRef" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "logOffset" INTEGER NOT NULL DEFAULT 0,
    "eventOffset" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemoteJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "stageKey" TEXT,
    "serviceKey" TEXT,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL DEFAULT '',
    "relativePath" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LogArchive_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "leaseRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detailJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourceLease_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Audit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_rootPath_key" ON "Project"("workspaceId", "rootPath");

-- CreateIndex
CREATE UNIQUE INDEX "Target_projectId_targetKey_key" ON "Target"("projectId", "targetKey");

-- CreateIndex
CREATE UNIQUE INDEX "Service_projectId_serviceKey_key" ON "Service"("projectId", "serviceKey");

-- CreateIndex
CREATE INDEX "Plan_projectId_createdAt_idx" ON "Plan"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_activeScope_key" ON "Task"("activeScope");

-- CreateIndex
CREATE UNIQUE INDEX "Task_idempotencyKey_key" ON "Task"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_taskId_stageKey_serviceKey_attempt_key" ON "Stage"("taskId", "stageKey", "serviceKey", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteJob_taskId_urlRef_jobId_key" ON "RemoteJob"("taskId", "urlRef", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_taskId_seq_key" ON "Event"("taskId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "LogArchive_taskId_stageKey_serviceKey_key" ON "LogArchive"("taskId", "stageKey", "serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceLease_taskId_provider_leaseRef_key" ON "ResourceLease"("taskId", "provider", "leaseRef");

-- CreateIndex
CREATE INDEX "Audit_workspaceId_createdAt_idx" ON "Audit"("workspaceId", "createdAt");
