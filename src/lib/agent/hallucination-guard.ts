/**
 * Post-process tailored resume text so LLM output cannot introduce employers,
 * degrees, tools, or skill claims absent from the source resume.
 * Fuzzy token match is allowed; invented proper nouns / skill phrases are stripped.
 */

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "our",
  "will", "have", "has", "was", "were", "been", "into", "about", "over", "under",
  "role", "roles", "job", "jobs", "team", "work", "working", "experience", "years",
  "ability", "strong", "including", "using", "across", "such", "other", "their",
  "they", "them", "who", "what", "when", "where", "which", "while", "should", "must",
  "need", "needs", "required", "preferred", "well", "also", "more", "most", "than",
  "then", "able", "based", "make", "made", "ensure", "help", "good", "great", "best",
  "new", "within", "through", "per", "via", "all", "any", "can", "may", "targeting",
  "strengths", "already", "evidenced", "background", "professional", "summary",
  "keywords", "existing", "ats", "honest", "improvements", "present",
]);

/** Tokens that often appear in invented resume claims (tools / credentials — not verbs). */
const CLAIMISH =
  /\b(certified|certificate|bachelor|master|mba|phd|doctorate|degree|university|college|internship|aws|gcp|azure|kubernetes|terraform|salesforce|hubspot|tableau|snowflake|databricks|pytorch|tensorflow|langchain|openai|anthropic|figma|jira|typescript|react|next\.js|node\.js)\b/i;

export type GuardResult = {
  text: string;
  strippedLines: string[];
  strippedTokens: string[];
  log: string[];
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.\/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+(\.\d+)?%?$/.test(t));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function tokenInSource(tok: string, sourceSet: Set<string>, sourceList: string[]): boolean {
  if (sourceSet.has(tok)) return true;
  // Fuzzy: allow 1-edit for longer tokens (typos / pluralization)
  if (tok.length >= 5) {
    for (const s of sourceList) {
      if (Math.abs(s.length - tok.length) > 1) continue;
      if (editDistance(tok, s) <= 1) return true;
    }
  }
  // Substring containment for compound skills (e.g. "react" in "reactjs")
  for (const s of sourceList) {
    if (s.length >= 4 && tok.length >= 4 && (s.includes(tok) || tok.includes(s))) return true;
  }
  return false;
}

/** Extract Title-Case / ALLCAPS employer-like phrases (2+ words or long single token). */
function extractProperPhrases(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const phrases: string[] = [];
  const re = /\b([A-Z][a-zA-Z0-9&'.+-]*(?:\s+[A-Z][a-zA-Z0-9&'.+-]*)+)\b/g;
  for (const line of lines) {
    let m: RegExpExecArray | null;
    const copy = line;
    re.lastIndex = 0;
    while ((m = re.exec(copy))) {
      const p = m[1].trim();
      if (p.length < 4) continue;
      if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(p)) {
        continue;
      }
      phrases.push(normalize(p));
    }
  }
  return [...new Set(phrases)];
}

function phraseSupported(phrase: string, sourceNorm: string, sourcePhrases: Set<string>): boolean {
  if (sourcePhrases.has(phrase)) return true;
  if (sourceNorm.includes(phrase)) return true;
  // Allow if every significant token appears in source
  const parts = phrase.split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
  if (parts.length === 0) return true;
  return parts.every((p) => sourceNorm.includes(p));
}

/**
 * Validate tailored resume against source. Strips unsupported bullet/summary lines
 * and removes unsupported claim tokens from otherwise-kept lines.
 */
export function guardAgainstHallucination(sourceResume: string, tailoredResume: string): GuardResult {
  const sourceNorm = normalize(sourceResume);
  const sourceTokList = tokens(sourceResume);
  const sourceSet = new Set(sourceTokList);
  const sourcePhrases = new Set(extractProperPhrases(sourceResume));

  const strippedLines: string[] = [];
  const strippedTokens: string[] = [];
  const log: string[] = [];

  const lines = tailoredResume.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  const isSectionHeading = (l: string) =>
    /^[A-Z][A-Z\s/&-]{2,40}$/.test(l.trim()) ||
    /^(professional summary|work experience|experience|education|skills|projects|certifications|ats keywords)/i.test(
      l.trim(),
    );

  const isBullet = (l: string) => /^[\s]*([•\-\*\u2022]|·|\d+\.)\s+/.test(l);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (isSectionHeading(trimmed)) {
      out.push(line);
      continue;
    }

    // Preserve contact/header lines that largely appear in source
    const lineNorm = normalize(trimmed);
    if (sourceNorm.includes(lineNorm) || lineNorm.length < 12) {
      out.push(line);
      continue;
    }

    const novelPhrases = extractProperPhrases(trimmed).filter(
      (p) => !phraseSupported(p, sourceNorm, sourcePhrases),
    );

    const lineToks = tokens(trimmed);
    const novelClaimToks = lineToks.filter(
      (t) => CLAIMISH.test(t) && !tokenInSource(t, sourceSet, sourceTokList),
    );

    // Aggressive: if a bullet invents multiple unsupported claim tokens or a novel employer phrase, drop it
    if ((isBullet(line) || /targeting\b/i.test(trimmed)) && (novelPhrases.length >= 1 || novelClaimToks.length >= 2)) {
      strippedLines.push(trimmed);
      log.push(
        `Stripped line (hallucination risk): "${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}"` +
          (novelPhrases.length ? ` novelPhrases=[${novelPhrases.join("; ")}]` : "") +
          (novelClaimToks.length ? ` novelTokens=[${novelClaimToks.join(", ")}]` : ""),
      );
      continue;
    }

    // Soft: remove individual unsupported claim tokens from the line
    let cleaned = trimmed;
    for (const tok of novelClaimToks) {
      const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      if (re.test(cleaned)) {
        cleaned = cleaned.replace(re, "").replace(/\s{2,}/g, " ").replace(/\s([,;.])/g, "$1").trim();
        strippedTokens.push(tok);
        log.push(`Stripped token "${tok}" from line: "${trimmed.slice(0, 80)}…"`);
      }
    }

    // Drop novel multi-word employer-like phrases from non-bullet prose
    for (const phrase of novelPhrases) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (re.test(cleaned)) {
        cleaned = cleaned.replace(re, "").replace(/\s{2,}/g, " ").trim();
        strippedTokens.push(phrase);
        log.push(`Stripped phrase "${phrase}" (not in source resume)`);
      }
    }

    if (!cleaned || cleaned.length < 3) {
      strippedLines.push(trimmed);
      log.push(`Dropped emptied line after token strip: "${trimmed.slice(0, 100)}"`);
      continue;
    }

    // Preserve original bullet prefix if we cleaned a bullet
    if (isBullet(line) && !isBullet(cleaned)) {
      const prefix = line.match(/^[\s]*([•\-\*\u2022]|·|\d+\.)\s+/)?.[0] || "- ";
      out.push(prefix + cleaned);
    } else if (cleaned === trimmed) {
      out.push(line);
    } else {
      out.push(cleaned);
    }
  }

  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (log.length) {
    console.info(
      `[hallucination-guard] stripped ${strippedLines.length} lines, ${strippedTokens.length} tokens`,
      log.slice(0, 20),
    );
  }

  return {
    text: text.length >= 40 ? text : tailoredResume.trim(),
    strippedLines,
    strippedTokens: [...new Set(strippedTokens)],
    log,
  };
}

export const ANTI_HALLUCINATION_SYSTEM_RULES = `HARD ANTI-HALLUCINATION RULES (non-negotiable):
1. ONLY use facts present in resumeText / originalResume. Never invent skills, jobs, employers, degrees, dates, metrics, tools, certifications, or titles.
2. If the job description asks for X and the resume does not support X, omit X or rephrase EXISTING experience — never fabricate X.
3. Synonyms are allowed ONLY when they honestly reflect the same underlying experience already on the resume.
4. Do not add employers, schools, or projects that are not in the source resume.
5. Prefer omitting a keyword over inventing evidence for it.
6. Return JSON only.`;
