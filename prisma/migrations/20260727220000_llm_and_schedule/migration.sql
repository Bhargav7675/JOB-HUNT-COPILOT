-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Profile" ADD COLUMN "llmModel" TEXT;
ALTER TABLE "Profile" ADD COLUMN "llmBaseUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "scheduleTimezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Profile" ADD COLUMN "scheduleHourLocal" INTEGER NOT NULL DEFAULT 8;

-- Backfill preferred local hour from prior UTC setting
UPDATE "Profile" SET "scheduleHourLocal" = "overnightHourUtc";
