-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "atsKeywordsMatched" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "atsKeywordsMissing" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "atsScoreAfter" INTEGER,
ADD COLUMN     "atsScoreBefore" INTEGER,
ADD COLUMN     "resumeChangeSummary" TEXT,
ADD COLUMN     "tailoredResumeText" TEXT;
