-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoApplyMinAtsScore" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "autoApplyMinScore" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "maxAutoAppliesPerRun" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "method" TEXT,
    "error" TEXT,
    "confirmationText" TEXT,
    "applyUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_profileId_status_idx" ON "Application"("profileId", "status");

-- CreateIndex
CREATE INDEX "Application_roleId_idx" ON "Application"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_profileId_roleId_key" ON "Application"("profileId", "roleId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
