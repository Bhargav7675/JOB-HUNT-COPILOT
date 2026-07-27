import { hasLlmKey, llmJson, type LlmConfig } from "@/lib/llm";
import { buildAtsReport, scoreAtsMatch, type AtsKeywordReport } from "./ats";
import type { RankedJob } from "./types";

export type TailoredResumeResult = {
  tailoredResumeText: string;
  resumeSuggestions: string;
  changeSummary: string;
  atsBefore: AtsKeywordReport;
  atsAfter: AtsKeywordReport;
};

function blockScore(block: string, keywords: string[]) {
  const lower = block.toLowerCase();
  return keywords.reduce((sum, kw) => sum + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
}

/**
 * Heuristic tailor: preserves original wording exactly, reorders blocks/bullets
 * so ATS-relevant content surfaces first, and lightly mirrors JD keywords already
 * present in the candidate's vocabulary.
 */
function heuristicTailor(resumeText: string, job: RankedJob, atsBefore: AtsKeywordReport): TailoredResumeResult {
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n");
  const header = lines.slice(0, Math.min(8, lines.length));
  const bodyLines = lines.slice(header.length);

  const isBullet = (l: string) => /^[\s]*([•\-\*\u2022]|·|\d+\.)\s+/.test(l);
  const bullets = bodyLines.filter(isBullet);
  const nonBullets = bodyLines.filter((l) => !isBullet(l));

  const rankedBullets = [...bullets].sort(
    (a, b) => blockScore(b, atsBefore.keywords) - blockScore(a, atsBefore.keywords),
  );

  // Keep original non-bullet structure order but put high-scoring bullets near top of experience
  const tailoredLines = [...header];

  // Role-targeted professional summary (only using existing matched keywords)
  const matchPhrase = atsBefore.matched.slice(0, 6).join(", ");
  if (matchPhrase) {
    tailoredLines.push("");
    tailoredLines.push("PROFESSIONAL SUMMARY");
    tailoredLines.push(
      `Targeting ${job.title} at ${job.company}. Strengths already evidenced in background: ${matchPhrase}.`,
    );
  }

  // Preserve remaining content with reordered bullets first
  if (rankedBullets.length) {
    tailoredLines.push("");
    tailoredLines.push(...rankedBullets);
  }
  if (nonBullets.length) {
    tailoredLines.push("");
    tailoredLines.push(...nonBullets);
  }

  // Soft keyword bank: only keywords already matched (never invent skills)
  if (atsBefore.matched.length) {
    tailoredLines.push("");
    tailoredLines.push("ATS KEYWORDS (from existing experience)");
    tailoredLines.push(atsBefore.matched.slice(0, 18).join(" · "));
  }

  const tailoredResumeText = tailoredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const atsAfter = scoreAtsMatch(tailoredResumeText, atsBefore.keywords);

  const stillMissing = atsAfter.missing.slice(0, 8);
  const changeSummary = [
    `Reordered content to surface role-relevant bullets for ${job.title}.`,
    `ATS match ${atsBefore.score}% → ${atsAfter.score}%.`,
    stillMissing.length
      ? `Keywords still absent from your background (not invented): ${stillMissing.join(", ")}.`
      : `Strong keyword coverage for this posting.`,
  ].join(" ");

  const resumeSuggestions = [
    `Lead with bullets that already mention: ${atsBefore.matched.slice(0, 5).join(", ") || "role-relevant wins"}.`,
    stillMissing.length
      ? `Do not fabricate: ${stillMissing.slice(0, 5).join(", ")}. Only add if truly in your experience, using your normal wording.`
      : `Mirror exact phrases from the posting where they already match your work.`,
    `Keep your original voice and section format — ATS parsers prefer clean plain text.`,
  ].join("\n");

  return {
    tailoredResumeText,
    resumeSuggestions,
    changeSummary,
    atsBefore,
    atsAfter,
  };
}

export async function tailorResumeForRole(options: {
  resumeText: string;
  job: RankedJob;
  llm?: LlmConfig;
  openaiApiKey?: string | null;
}): Promise<TailoredResumeResult> {
  const atsBefore = buildAtsReport(options.resumeText, options.job);
  const fallback = heuristicTailor(options.resumeText, options.job, atsBefore);
  const llm: LlmConfig = options.llm || { apiKey: options.openaiApiKey };

  if (!hasLlmKey(llm)) return fallback;

  try {
    const parsed = await llmJson<{
      tailoredResumeText?: string;
      changeSummary?: string;
      resumeSuggestions?: string;
      keywordsUsed?: string[];
    }>(
      llm,
      [
        {
          role: "system",
          content: `You are an elite resume writer specializing in ATS optimization.

HARD RULES:
1. NEVER invent jobs, degrees, tools, metrics, or skills not clearly supported by the original resume.
2. Preserve the candidate's wording style, tense, and section format as closely as possible.
3. Produce a complete plain-text resume tailored to ONE job posting.
4. Optimize for ATS: weave in missing keywords ONLY when they are honest synonyms/reflections of existing experience.
5. Reorder bullets so the most role-relevant proof points come first under each role.
6. Keep contact/header lines intact.
7. Return JSON only.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            instructions: {
              goal: "Tailor resume for ATS + human hiring manager while keeping original voice/format",
              returnShape: {
                tailoredResumeText: "full plain-text resume",
                changeSummary: "2-4 sentences of what changed and why",
                resumeSuggestions: "3-5 short bullets of remaining honest improvements",
                keywordsUsed: ["keyword phrases intentionally surfaced"],
              },
            },
            job: {
              title: options.job.title,
              company: options.job.company,
              description: options.job.description.slice(0, 3500),
              skillMatches: options.job.skillMatches,
              skillGaps: options.job.skillGaps,
            },
            ats: {
              targetKeywords: atsBefore.keywords.slice(0, 35),
              currentlyMatched: atsBefore.matched.slice(0, 25),
              currentlyMissing: atsBefore.missing.slice(0, 25),
              scoreBefore: atsBefore.score,
            },
            originalResume: options.resumeText.slice(0, 12000),
          }),
        },
      ],
      { temperature: 0.25 },
    );

    if (!parsed.tailoredResumeText || parsed.tailoredResumeText.trim().length < 80) {
      return fallback;
    }

    const tailoredResumeText = parsed.tailoredResumeText.trim();
    const atsAfter = scoreAtsMatch(tailoredResumeText, atsBefore.keywords);

    return {
      tailoredResumeText,
      changeSummary:
        parsed.changeSummary?.trim() ||
        `Tailored for ${options.job.title}. ATS ${atsBefore.score}% → ${atsAfter.score}%.`,
      resumeSuggestions: parsed.resumeSuggestions?.trim() || fallback.resumeSuggestions,
      atsBefore,
      atsAfter,
    };
  } catch {
    return fallback;
  }
}

export function resumeDownloadName(job: RankedJob, fullName: string) {
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `${safe(fullName)}_${safe(job.company)}_${safe(job.title)}_ATS.txt`.slice(0, 120);
}
