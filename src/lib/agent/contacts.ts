import { domainFromCompany } from "@/lib/utils";
import type { EnrichedContact, RankedJob } from "./types";

type HunterEmail = {
  value?: string;
  type?: string;
  confidence?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
  verification?: { status?: string };
};

async function hunterDomainSearch(
  domain: string,
  apiKey: string,
): Promise<HunterEmail[]> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: { emails?: HunterEmail[] } };
  return data.data?.emails ?? [];
}

async function hunterVerify(email: string, apiKey: string): Promise<"verified" | "unverified" | "unknown"> {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return "unknown";
  const data = (await res.json()) as { data?: { status?: string; result?: string } };
  const status = (data.data?.status || data.data?.result || "").toLowerCase();
  if (status === "valid" || status === "verified") return "verified";
  if (status === "invalid" || status === "webmail") return "unverified";
  return "unknown";
}

function linkedinPeopleSearch(company: string, roleHint: string) {
  const q = encodeURIComponent(`${roleHint} ${company}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
}

/**
 * Never invent / guess emails. Only return emails from Hunter verification path.
 * Otherwise provide LinkedIn search + unavailable email status.
 */
export async function findContacts(options: {
  job: RankedJob;
  hunterApiKey?: string | null;
}): Promise<EnrichedContact[]> {
  const { job, hunterApiKey } = options;
  const key = hunterApiKey || process.env.HUNTER_API_KEY;
  const domain = domainFromCompany(job.company);
  const hiringManagerSearch = linkedinPeopleSearch(job.company, "hiring manager recruiter");
  const peerSearch = linkedinPeopleSearch(job.company, job.title.split(" ").slice(0, 3).join(" "));

  if (!key || !domain) {
    return [
      {
        fullName: `Hiring lead at ${job.company}`,
        title: "Hiring Manager / Recruiter",
        email: null,
        emailStatus: "unavailable",
        confidence: 0,
        linkedinUrl: hiringManagerSearch,
        source: "linkedin-search",
      },
      {
        fullName: `Peer / team member at ${job.company}`,
        title: job.title,
        email: null,
        emailStatus: "unavailable",
        confidence: 0,
        linkedinUrl: peerSearch,
        source: "linkedin-search",
      },
    ];
  }

  try {
    const emails = await hunterDomainSearch(domain, key);
    const preferred = emails
      .filter((e) => e.value)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 3);

    if (preferred.length === 0) {
      return [
        {
          fullName: `Hiring lead at ${job.company}`,
          title: "Hiring Manager / Recruiter",
          email: null,
          emailStatus: "unavailable",
          confidence: 0,
          linkedinUrl: hiringManagerSearch,
          source: "hunter-empty",
        },
      ];
    }

    const contacts: EnrichedContact[] = [];
    for (const e of preferred) {
      const email = e.value!;
      const verification = await hunterVerify(email, key);
      // HARD RULE: never trust unverified invented patterns — only Hunter results, marked honestly
      contacts.push({
        fullName: [e.first_name, e.last_name].filter(Boolean).join(" ") || `Contact at ${job.company}`,
        title: e.position || "Team member",
        email: verification === "verified" || verification === "unknown" ? email : null,
        emailStatus: verification === "verified" ? "verified" : verification === "unverified" ? "unverified" : "unknown",
        confidence: (e.confidence ?? 0) / 100,
        linkedinUrl: e.linkedin || hiringManagerSearch,
        source: "hunter.io",
      });
    }

    // If no verified/unknown emails survived, keep LinkedIn fallback
    if (contacts.every((c) => !c.email)) {
      contacts.push({
        fullName: `Hiring lead at ${job.company}`,
        title: "Hiring Manager / Recruiter",
        email: null,
        emailStatus: "unavailable",
        confidence: 0,
        linkedinUrl: hiringManagerSearch,
        source: "linkedin-search",
      });
    }

    return contacts;
  } catch {
    return [
      {
        fullName: `Hiring lead at ${job.company}`,
        title: "Hiring Manager / Recruiter",
        email: null,
        emailStatus: "unavailable",
        confidence: 0,
        linkedinUrl: hiringManagerSearch,
        source: "fallback",
      },
    ];
  }
}
