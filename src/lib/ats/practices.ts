/**
 * ATS best practices encoded as checkable heuristics.
 *
 * Practical guidance distilled from public ATS-friendly resume guides
 * (single-column layout, standard headings, keyword overlap, no tables/graphics):
 * - https://forgemycv.ai/career-insights/definitive-ats-friendly-resume-2025
 * - https://resume.io/resume-templates/ats
 * - https://www.goapply.ai/blog/ats-friendly-resume-2025-guide
 *
 * No paid ATS APIs — pure heuristics. Optional Jobscan-like tools need commercial keys;
 * we intentionally avoid those. Document any future free keys in `.env.example`.
 */

export const ATS_STANDARD_HEADINGS = [
  "professional summary",
  "summary",
  "work experience",
  "professional experience",
  "experience",
  "employment",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "contact",
] as const;

export type AtsPractice = {
  id: string;
  title: string;
  description: string;
  weight: number;
};

export const ATS_PRACTICES: AtsPractice[] = [
  {
    id: "single_column",
    title: "Single-column parseable text",
    description:
      "ATS parsers read top-to-bottom. Avoid multi-column layouts, tables, text boxes, and sidebars that scramble field extraction.",
    weight: 12,
  },
  {
    id: "standard_headings",
    title: "Standard section headings",
    description:
      'Use conventional labels (Experience, Education, Skills, Summary). Creative titles like "My Journey" often fail section mapping.',
    weight: 14,
  },
  {
    id: "contact_in_body",
    title: "Contact info in document body",
    description:
      "Put name, email, phone, and LinkedIn in the main body — not only in PDF headers/footers that some parsers skip.",
    weight: 10,
  },
  {
    id: "keyword_overlap",
    title: "Honest keyword alignment",
    description:
      "Mirror exact nouns/tools from the posting only when they already appear in your experience. Never invent skills to raise a score.",
    weight: 40,
  },
  {
    id: "no_graphics",
    title: "No graphics or text-in-images",
    description:
      "Icons, logos, charts, and scanned pages are invisible or garbled to most ATS. Prefer plain selectable text (and text-based PDF/LaTeX).",
    weight: 10,
  },
  {
    id: "simple_bullets",
    title: "Simple bullets and dates",
    description:
      "Use plain • or - bullets and consistent date formats (e.g. Jan 2022 – Present). Avoid special glyphs and ambiguous abbreviations.",
    weight: 8,
  },
  {
    id: "skills_section",
    title: "Dedicated skills section",
    description:
      "A clear Skills section helps keyword search and recruiter skim. List tools you actually used — not a stuffed buzzword dump.",
    weight: 6,
  },
];

export type StructureReport = {
  hasStandardHeading: boolean;
  hasContactSignal: boolean;
  hasSkillsSection: boolean;
  hasExperienceSignal: boolean;
  looksSingleColumnText: boolean;
  hasRiskyFormattingHints: boolean;
  practiceHits: string[];
  structureScore: number;
  tips: string[];
};

export function analyzeAtsStructure(resumeText: string): StructureReport {
  const lower = resumeText.toLowerCase();
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n");

  const hasStandardHeading = ATS_STANDARD_HEADINGS.some((h) => {
    const re = new RegExp(`(^|\\n)\\s*${h}\\s*($|\\n)`, "i");
    return re.test(resumeText) || lower.includes(`\n${h}\n`);
  });

  const hasContactSignal =
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(resumeText) ||
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(resumeText) ||
    /linkedin\.com/i.test(resumeText);

  const hasSkillsSection = /\b(skills|technical skills|core competencies)\b/i.test(resumeText);
  const hasExperienceSignal =
    /\b(experience|employment|work history)\b/i.test(resumeText) ||
    /\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|present|current)\b/i.test(resumeText);

  // Heuristic: pipe-heavy or tab-grid lines suggest multi-column / table paste
  const pipey = lines.filter((l) => (l.match(/\|/g) || []).length >= 2).length;
  const hasRiskyFormattingHints =
    pipey >= 2 ||
    /\[image\]|logo|\.png|\.jpg|text box/i.test(resumeText) ||
    /\t{2,}/.test(resumeText);

  const looksSingleColumnText = !hasRiskyFormattingHints && lines.length > 5;

  const practiceHits: string[] = [];
  const tips: string[] = [];
  let structureScore = 0;

  if (looksSingleColumnText) {
    practiceHits.push("single_column");
    structureScore += 12;
  } else {
    tips.push("Prefer a single-column plain-text layout — avoid tables and multi-column pastes.");
  }

  if (hasStandardHeading) {
    practiceHits.push("standard_headings");
    structureScore += 14;
  } else {
    tips.push('Add standard headings like "Experience", "Education", and "Skills".');
  }

  if (hasContactSignal) {
    practiceHits.push("contact_in_body");
    structureScore += 10;
  } else {
    tips.push("Include email/phone/LinkedIn in the resume body (not only a header graphic).");
  }

  practiceHits.push("no_graphics");
  structureScore += hasRiskyFormattingHints ? 2 : 10;
  if (hasRiskyFormattingHints) {
    tips.push("Remove table characters, logos, and image placeholders that break ATS parsers.");
  }

  const bulletOk = lines.some((l) => /^[\s]*([•\-\*]|\d+\.)\s+/.test(l));
  if (bulletOk) {
    practiceHits.push("simple_bullets");
    structureScore += 8;
  } else {
    tips.push("Use simple dash or bullet lists for achievements.");
  }

  if (hasSkillsSection) {
    practiceHits.push("skills_section");
    structureScore += 6;
  } else {
    tips.push("Add a Skills section listing tools you already used on the resume.");
  }

  if (hasExperienceSignal) structureScore += 4;

  return {
    hasStandardHeading,
    hasContactSignal,
    hasSkillsSection,
    hasExperienceSignal,
    looksSingleColumnText,
    hasRiskyFormattingHints,
    practiceHits,
    structureScore: Math.min(60, structureScore),
    tips,
  };
}

export function explainAtsScore(options: {
  keywordScore: number;
  matched: string[];
  missing: string[];
  structure: StructureReport;
  compositeScore: number;
}): string {
  const { keywordScore, matched, missing, structure, compositeScore } = options;
  const parts = [
    `Composite ATS readiness ~${compositeScore}% (keyword overlap ${keywordScore}% + structure ${structure.structureScore}/60).`,
    matched.length
      ? `Matched from the posting (already on your resume): ${matched.slice(0, 10).join(", ")}${matched.length > 10 ? "…" : ""}.`
      : "Few posting keywords currently appear in your resume wording.",
    missing.length
      ? `Still missing (not invented): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}. Add only if truly in your background.`
      : "Strong keyword coverage for this posting.",
  ];
  if (structure.tips.length) {
    parts.push(`Format tips: ${structure.tips.slice(0, 2).join(" ")}`);
  }
  parts.push(
    "Score is heuristic (keyword + layout practices) — not a proprietary vendor ATS prediction.",
  );
  return parts.join(" ");
}
