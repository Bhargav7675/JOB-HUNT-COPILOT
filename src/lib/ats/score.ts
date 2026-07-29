import type { RankedJob } from "@/lib/agent/types";
import {
  analyzeAtsStructure,
  explainAtsScore,
  type StructureReport,
} from "./practices";

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "our", "will",
  "have", "has", "was", "were", "been", "into", "about", "over", "under", "role", "roles",
  "job", "jobs", "team", "work", "working", "experience", "years", "ability", "strong",
  "including", "using", "across", "such", "other", "their", "they", "them", "who", "what",
  "when", "where", "which", "while", "should", "must", "need", "needs", "required",
  "requirements", "preferred", "plus", "etc", "etcetera", "well", "also", "more", "most",
  "than", "then", "able", "based", "make", "made", "ensure", "helps", "help", "good",
  "great", "best", "new", "within", "through", "per", "via", "all", "any", "can", "may",
]);

const PHRASE_HINTS = [
  "product management",
  "product manager",
  "project management",
  "machine learning",
  "artificial intelligence",
  "data science",
  "data analysis",
  "go to market",
  "go-to-market",
  "user research",
  "a/b testing",
  "cross functional",
  "cross-functional",
  "stakeholder management",
  "road map",
  "roadmap",
  "customer success",
  "software engineering",
  "full stack",
  "full-stack",
  "front end",
  "front-end",
  "back end",
  "back-end",
  "natural language",
  "large language",
  "prompt engineering",
  "system design",
  "ci/cd",
];

export type AtsKeywordReport = {
  keywords: string[];
  matched: string[];
  missing: string[];
  /** Keyword-only overlap 0–100 */
  score: number;
  /** Keyword + structure composite 0–100 */
  compositeScore?: number;
  structure?: StructureReport;
  explanation?: string;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractAtsKeywords(jobDescription: string, title = ""): string[] {
  const hay = normalize(`${title}\n${jobDescription}`);
  const found = new Set<string>();

  for (const phrase of PHRASE_HINTS) {
    if (hay.includes(phrase)) found.add(phrase);
  }

  const tokenList = hay
    .split(/[^a-z0-9+#.\/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));

  const freq = new Map<string, number>();
  for (const t of tokenList) freq.set(t, (freq.get(t) || 0) + 1);

  [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([t]) => found.add(t));

  return [...found].slice(0, 45);
}

export function scoreAtsMatch(resumeText: string, keywords: string[]): AtsKeywordReport {
  const resume = normalize(resumeText);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (resume.includes(kw.toLowerCase())) matched.push(kw);
    else missing.push(kw);
  }

  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  const structure = analyzeAtsStructure(resumeText);
  // Weight: ~70% keywords, ~30% structure (structure max 60 → scale to 30)
  const compositeScore = Math.round(score * 0.7 + (structure.structureScore / 60) * 30);
  const explanation = explainAtsScore({
    keywordScore: score,
    matched,
    missing,
    structure,
    compositeScore,
  });

  return {
    keywords,
    matched,
    missing,
    score,
    compositeScore,
    structure,
    explanation,
  };
}

export function buildAtsReport(resumeText: string, job: RankedJob): AtsKeywordReport {
  const keywords = extractAtsKeywords(job.description, job.title);
  return scoreAtsMatch(resumeText, keywords);
}
