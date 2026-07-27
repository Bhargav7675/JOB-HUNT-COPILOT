-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "experienceYears" INTEGER NOT NULL DEFAULT 3;

-- Prefer newly opened roles by default
UPDATE "Profile" SET "maxAgeDays" = 2 WHERE "maxAgeDays" > 2;
