import { hasLlmKey, llmJson, type LlmConfig } from "@/lib/llm";
import type { RankedJob, ScoutedJob } from "./types";

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "our",
  "will", "have", "has", "was", "were", "been", "into", "about", "over", "under",
  "role", "roles", "job", "jobs", "team", "work", "working", "experience", "years",
  "ability", "strong", "including", "using", "across", "such", "other", "their",
]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function heuristicRank(resumeText: string, brief: string, job: ScoutedJob): RankedJob {
  const resumeTokens = new Set(tokens(resumeText));
  const briefTokens = tokens(brief);
  const jobTokens = tokens(`${job.title} ${job.description}`);
  const uniqueJob = [...new Set(jobTokens)];

  const matches = uniqueJob.filter((t) => resumeTokens.has(t)).slice(0, 12);
  const gaps = uniqueJob.filter((t) => !resumeTokens.has(t)).slice(0, 8);
  const briefHits = briefTokens.filter((t) =>
    `${job.title} ${job.description}`.toLowerCase().includes(t),
  ).length;

  const overlap = uniqueJob.length ? matches.length / Math.min(uniqueJob.length, 40) : 0;
  const briefBoost = briefTokens.length ? briefHits / briefTokens.length : 0;
  const titleBoost = briefTokens.some((t) => job.title.toLowerCase().includes(t)) ? 12 : 0;

  const titleTokens = tokens(job.title);
  const titleOverlap = titleTokens.filter((t) => resumeTokens.has(t) || briefTokens.includes(t)).length;
  const titleBriefHits = briefTokens.filter((t) => job.title.toLowerCase().includes(t)).length;

  const matchScore = Math.round(
    Math.min(
      98,
      Math.max(
        28,
        overlap * 40 +
          briefBoost * 22 +
          titleBoost +
          titleBriefHits * 8 +
          titleOverlap * 3 +
          matches.length * 0.5,
      ),
    ),
  );

  return {
    ...job,
    matchScore,
    rankReason: matches.length
      ? `Strong overlap on ${matches.slice(0, 4).join(", ")}${gaps.length ? `; gaps: ${gaps.slice(0, 3).join(", ")}` : ""}`
      : `Partial brief alignment; review description carefully before pursuing.`,
    skillMatches: matches,
    skillGaps: gaps,
  };
}

export async function rankJobs(options: {
  resumeText: string;
  brief: string;
  jobs: ScoutedJob[];
  llm?: LlmConfig;
  /** @deprecated use llm */
  openaiApiKey?: string | null;
}): Promise<RankedJob[]> {
  const { resumeText, brief, jobs } = options;
  const llm: LlmConfig = options.llm || { apiKey: options.openaiApiKey };
  const heuristic = jobs.map((j) => heuristicRank(resumeText, brief, j));

  if (!hasLlmKey(llm) || jobs.length === 0) {
    return heuristic.sort((a, b) => b.matchScore - a.matchScore);
  }

  try {
    const payload = jobs.slice(0, 40).map((j, i) => ({
      i,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description.slice(0, 1800),
    }));

    const parsed = await llmJson<{
      rankings?: Array<{
        i: number;
        matchScore: number;
        rankReason: string;
        skillMatches?: string[];
        skillGaps?: string[];
      }>;
    }>(
      llm,
      [
        {
          role: "system",
          content:
            'You are an expert technical recruiter. Score job fit honestly 0-100. Never invent resume experience. Return JSON: {"rankings":[{"i":0,"matchScore":72,"rankReason":"...","skillMatches":["..."],"skillGaps":["..."]}]}',
        },
        {
          role: "user",
          content: JSON.stringify({
            searchBrief: brief,
            resume: resumeText.slice(0, 9000),
            jobs: payload,
          }),
        },
      ],
      { temperature: 0.2 },
    );

    const byIndex = new Map((parsed.rankings ?? []).map((r) => [r.i, r]));
    const ranked = jobs.map((job, i) => {
      const ai = byIndex.get(i);
      const fallback = heuristic[i];
      if (!ai) return fallback;
      return {
        ...job,
        matchScore: Math.max(0, Math.min(100, Math.round(ai.matchScore))),
        rankReason: ai.rankReason || fallback.rankReason,
        skillMatches: ai.skillMatches?.length ? ai.skillMatches : fallback.skillMatches,
        skillGaps: ai.skillGaps?.length ? ai.skillGaps : fallback.skillGaps,
      };
    });

    return ranked.sort((a, b) => b.matchScore - a.matchScore);
  } catch {
    return heuristic.sort((a, b) => b.matchScore - a.matchScore);
  }
}
