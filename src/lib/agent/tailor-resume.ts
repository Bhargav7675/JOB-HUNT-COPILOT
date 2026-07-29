import { hasLlmKey, llmJson, type LlmConfig } from "@/lib/llm";
import { buildAtsReport, scoreAtsMatch, type AtsKeywordReport } from "@/lib/ats";
import {
  ANTI_HALLUCINATION_SYSTEM_RULES,
  guardAgainstHallucination,
} from "./hallucination-guard";
import { tailoredResumeToLatex } from "@/lib/resume-formats";
import type { RankedJob } from "./types";

export type TailoredResumeResult = {
  tailoredResumeText: string;
  tailoredLatex: string;
  resumeSuggestions: string;
  changeSummary: string;
  atsBefore: AtsKeywordReport;
  atsAfter: AtsKeywordReport;
  atsExplanation: string;
  guardLog: string[];
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
function heuristicTailor(
  resumeText: string,
  job: RankedJob,
  atsBefore: AtsKeywordReport,
  fullName: string,
): TailoredResumeResult {
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n");
  const header = lines.slice(0, Math.min(8, lines.length));
  const bodyLines = lines.slice(header.length);

  const isBullet = (l: string) => /^[\s]*([•\-\*\u2022]|·|\d+\.)\s+/.test(l);
  const bullets = bodyLines.filter(isBullet);
  const nonBullets = bodyLines.filter((l) => !isBullet(l));

  const rankedBullets = [...bullets].sort(
    (a, b) => blockScore(b, atsBefore.keywords) - blockScore(a, atsBefore.keywords),
  );

  const tailoredLines = [...header];

  const matchPhrase = atsBefore.matched.slice(0, 6).join(", ");
  if (matchPhrase) {
    tailoredLines.push("");
    tailoredLines.push("PROFESSIONAL SUMMARY");
    tailoredLines.push(
      `Targeting ${job.title} at ${job.company}. Strengths already evidenced in background: ${matchPhrase}.`,
    );
  }

  if (rankedBullets.length) {
    tailoredLines.push("");
    tailoredLines.push("EXPERIENCE");
    tailoredLines.push(...rankedBullets);
  }
  if (nonBullets.length) {
    tailoredLines.push("");
    tailoredLines.push(...nonBullets);
  }

  if (atsBefore.matched.length) {
    tailoredLines.push("");
    tailoredLines.push("SKILLS");
    tailoredLines.push(atsBefore.matched.slice(0, 18).join(" · "));
  }

  const rawText = tailoredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const guarded = guardAgainstHallucination(resumeText, rawText);
  const tailoredResumeText = guarded.text;
  const atsAfter = scoreAtsMatch(tailoredResumeText, atsBefore.keywords);

  const stillMissing = atsAfter.missing.slice(0, 8);
  const changeSummary = [
    `Reordered content to surface role-relevant bullets for ${job.title}.`,
    `ATS keyword match ${atsBefore.score}% → ${atsAfter.score}%` +
      (atsAfter.compositeScore != null ? ` (composite ~${atsAfter.compositeScore}%).` : "."),
    stillMissing.length
      ? `Keywords still absent from your background (not invented): ${stillMissing.join(", ")}.`
      : `Strong keyword coverage for this posting.`,
    guarded.log.length ? `Guard stripped ${guarded.log.length} hallucinated fragment(s).` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const resumeSuggestions = [
    `Lead with bullets that already mention: ${atsBefore.matched.slice(0, 5).join(", ") || "role-relevant wins"}.`,
    stillMissing.length
      ? `Do not fabricate: ${stillMissing.slice(0, 5).join(", ")}. Only add if truly in your experience, using your normal wording.`
      : `Mirror exact phrases from the posting where they already match your work.`,
    `Keep single-column plain text / LaTeX / text PDF — ATS parsers prefer clean parseable layout (no tables/graphics).`,
    ...(atsAfter.structure?.tips.slice(0, 2) || []),
  ].join("\n");

  const tailoredLatex = tailoredResumeToLatex({
    fullName,
    company: job.company,
    title: job.title,
    resumeText: tailoredResumeText,
  });

  return {
    tailoredResumeText,
    tailoredLatex,
    resumeSuggestions,
    changeSummary,
    atsBefore,
    atsAfter,
    atsExplanation: atsAfter.explanation || changeSummary,
    guardLog: guarded.log,
  };
}

export async function tailorResumeForRole(options: {
  resumeText: string;
  job: RankedJob;
  fullName?: string;
  llm?: LlmConfig;
  openaiApiKey?: string | null;
}): Promise<TailoredResumeResult> {
  const fullName = options.fullName || "Candidate";
  const atsBefore = buildAtsReport(options.resumeText, options.job);
  const fallback = heuristicTailor(options.resumeText, options.job, atsBefore, fullName);
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

${ANTI_HALLUCINATION_SYSTEM_RULES}

ADDITIONAL RULES:
1. Preserve the candidate's wording style, tense, and section format as closely as possible.
2. Produce a complete plain-text resume tailored to ONE job posting.
3. Optimize for ATS: single-column plain text, standard headings (Experience, Education, Skills, Summary), weave in keywords ONLY when honest reflections of existing experience.
4. Reorder bullets so the most role-relevant proof points come first under each role.
5. Keep contact/header lines intact.
6. Never invent employers, degrees, metrics, or tools.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            instructions: {
              goal: "Tailor resume for ATS + human hiring manager while keeping original voice/format. NEVER invent facts.",
              returnShape: {
                tailoredResumeText: "full plain-text resume",
                changeSummary: "2-4 sentences of what changed and why",
                resumeSuggestions: "3-5 short bullets of remaining honest improvements",
                keywordsUsed: ["keyword phrases intentionally surfaced from existing experience only"],
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
              note: "Missing keywords must NOT be invented. Leave them missing.",
            },
            originalResume: options.resumeText.slice(0, 12000),
          }),
        },
      ],
      { temperature: 0.15 },
    );

    if (!parsed.tailoredResumeText || parsed.tailoredResumeText.trim().length < 80) {
      return fallback;
    }

    const guarded = guardAgainstHallucination(options.resumeText, parsed.tailoredResumeText.trim());
    const tailoredResumeText = guarded.text;
    const atsAfter = scoreAtsMatch(tailoredResumeText, atsBefore.keywords);

    const changeSummary = [
      parsed.changeSummary?.trim() ||
        `Tailored for ${options.job.title}. ATS ${atsBefore.score}% → ${atsAfter.score}%.`,
      guarded.log.length
        ? `Post-guard removed ${guarded.log.length} unsupported fragment(s) not grounded in your resume.`
        : "Passed anti-hallucination guard (no unsupported employers/skills/degrees added).",
    ].join(" ");

    const tailoredLatex = tailoredResumeToLatex({
      fullName,
      company: options.job.company,
      title: options.job.title,
      resumeText: tailoredResumeText,
    });

    return {
      tailoredResumeText,
      tailoredLatex,
      changeSummary,
      resumeSuggestions: parsed.resumeSuggestions?.trim() || fallback.resumeSuggestions,
      atsBefore,
      atsAfter,
      atsExplanation: atsAfter.explanation || changeSummary,
      guardLog: guarded.log,
    };
  } catch {
    return fallback;
  }
}

export function resumeDownloadName(job: RankedJob, fullName: string) {
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `${safe(fullName)}_${safe(job.company)}_${safe(job.title)}_ATS.txt`.slice(0, 120);
}
