ALTER TABLE "Actor" ADD COLUMN "username" TEXT;
ALTER TABLE "Actor" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Actor" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Actor_username_key" ON "Actor"("username");
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuthSession_actorId_idx" ON "AuthSession"("actorId");
