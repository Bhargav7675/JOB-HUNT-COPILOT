import { hasLlmKey, llmChat, llmJson, type LlmConfig } from "@/lib/llm";
import type { EnrichedContact, OutreachContent, RankedJob } from "./types";

function templateOutreach(options: {
  fullName: string;
  voiceNotes?: string | null;
  job: RankedJob;
  contact: EnrichedContact;
}): OutreachContent {
  const { fullName, voiceNotes, job, contact } = options;
  const firstRaw = contact.fullName.split(" ")[0] || "there";
  const first =
    /^(hiring|peer|contact|team|recruiter)$/i.test(firstRaw) || contact.fullName.includes(" at ")
      ? "there"
      : firstRaw;
  const matchBit = job.skillMatches.slice(0, 2).join(" and ") || "this space";
  const subject = `Quick note — ${job.title} at ${job.company}`;
  const body = [
    `Hi ${first},`,
    ``,
    `I came across the ${job.title} role at ${job.company} and it lined up closely with my background in ${matchBit}.`,
    ``,
    `Would you be open to a short coffee chat about the team and what you're looking for? Happy to work around your schedule.`,
    ``,
    voiceNotes ? `(Tone note for me: ${voiceNotes})` : ``,
    `Best,`,
    fullName,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { subject, body };
}

function llmFrom(options: { llm?: LlmConfig; openaiApiKey?: string | null }): LlmConfig {
  return options.llm || { apiKey: options.openaiApiKey };
}

export async function draftOutreach(options: {
  fullName: string;
  voiceNotes?: string | null;
  resumeText: string;
  job: RankedJob;
  contact: EnrichedContact;
  llm?: LlmConfig;
  openaiApiKey?: string | null;
}): Promise<OutreachContent> {
  const fallback = templateOutreach(options);
  const llm = llmFrom(options);
  if (!hasLlmKey(llm)) return fallback;

  try {
    const parsed = await llmJson<{ subject?: string; body?: string }>(
      llm,
      [
        {
          role: "system",
          content:
            'Write a short, specific, human coffee-chat outreach email. No fluff, no spammy claims, never invent experience. Return JSON {"subject":"...","body":"..."}. Body should be under 120 words.',
        },
        {
          role: "user",
          content: JSON.stringify({
            candidateName: options.fullName,
            voiceNotes: options.voiceNotes,
            resumeHighlights: options.resumeText.slice(0, 2500),
            role: {
              title: options.job.title,
              company: options.job.company,
              matchReason: options.job.rankReason,
              skillMatches: options.job.skillMatches,
            },
            contact: {
              name: options.contact.fullName,
              title: options.contact.title,
            },
          }),
        },
      ],
      { temperature: 0.5 },
    );
    if (!parsed.subject || !parsed.body) return fallback;
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    return fallback;
  }
}

export async function suggestResumeTweaks(options: {
  resumeText: string;
  job: RankedJob;
  llm?: LlmConfig;
  openaiApiKey?: string | null;
}): Promise<string> {
  const llm = llmFrom(options);
  const heuristic = [
    `Reorder bullets to lead with: ${options.job.skillMatches.slice(0, 3).join(", ") || "role-relevant wins"}.`,
    options.job.skillGaps.length
      ? `Do not invent skills. If you have adjacent experience for gaps (${options.job.skillGaps.slice(0, 3).join(", ")}), reframe existing wins — never fabricate.`
      : `Surface quantified outcomes near the top of your most recent role.`,
    `Mirror language from the posting for tools you already used.`,
  ].join("\n");

  if (!hasLlmKey(llm)) return heuristic;

  try {
    const text = await llmChat(
      llm,
      [
        {
          role: "system",
          content:
            "Suggest targeted, honest resume tweaks for one role. Never invent experience. Return plain text with 3-5 short bullets.",
        },
        {
          role: "user",
          content: JSON.stringify({
            resume: options.resumeText.slice(0, 6000),
            job: {
              title: options.job.title,
              company: options.job.company,
              description: options.job.description.slice(0, 2500),
              skillMatches: options.job.skillMatches,
              skillGaps: options.job.skillGaps,
            },
          }),
        },
      ],
      { temperature: 0.3 },
    );
    return text || heuristic;
  } catch {
    return heuristic;
  }
}
