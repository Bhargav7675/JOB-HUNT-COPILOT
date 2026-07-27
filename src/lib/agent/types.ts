export type ScoutedJob = {
  externalId: string;
  source: string;
  title: string;
  company: string;
  location?: string;
  remoteType?: string;
  url: string;
  description: string;
  postedAt?: Date | null;
};

export type RankedJob = ScoutedJob & {
  matchScore: number;
  rankReason: string;
  skillMatches: string[];
  skillGaps: string[];
};

export type EnrichedContact = {
  fullName: string;
  title?: string;
  email?: string | null;
  emailStatus: "verified" | "unverified" | "unknown" | "unavailable";
  confidence: number;
  linkedinUrl?: string | null;
  source: string;
};

export type OutreachContent = {
  subject: string;
  body: string;
};

export type PipelineProgress = {
  stage: string;
  message: string;
  at: string;
};
