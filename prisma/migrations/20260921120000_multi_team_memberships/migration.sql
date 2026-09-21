CREATE TABLE "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");

ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId")
SELECT 'membership_' || "id", "workspaceId", "id"
FROM "User"
WHERE "workspaceId" IS NOT NULL
ON CONFLICT ("workspaceId", "userId") DO NOTHING;
