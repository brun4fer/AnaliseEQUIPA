ALTER TABLE "User"
ADD COLUMN "ssoSubject" TEXT;

CREATE UNIQUE INDEX "User_ssoSubject_key" ON "User"("ssoSubject");
