import type { ScoutedJob } from "./types";

export type ScoutOptions = {
  brief: string;
  location?: string | null;
  experienceYears?: number | null;
  maxAgeDays: number;
  adzunaAppId?: string | null;
  adzunaAppKey?: string | null;
};

function withinDays(date: Date | null | undefined, maxAgeDays: number) {
  if (!date) return true;
  const ageMs = Date.now() - date.getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

const US_HINTS = [
  "united states",
  "usa",
  "u.s.",
  "u.s.a",
  "remote - us",
  "remote us",
  "us remote",
  "us only",
  "nationwide",
  "north america",
  // states + common cities
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware",
  "florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky",
  "louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi",
  "missouri","montana","nebraska","nevada","hampshire","jersey","mexico","york","carolina",
  "dakota","ohio","oklahoma","oregon","pennsylvania","rhode","tennessee","texas","utah",
  "vermont","virginia","washington","wisconsin","wyoming","district of columbia","dc",
  "new york","san francisco","sf","bay area","los angeles","seattle","austin","chicago",
  "boston","denver","atlanta","miami","dallas","houston","phoenix","san diego","san jose",
  "brooklyn","manhattan","nyc","la ","sf ",
];

function isUsRelevant(job: ScoutedJob) {
  const loc = `${job.location ?? ""} ${job.description.slice(0, 500)}`.toLowerCase();
  if (!loc.trim()) return true; // unknown location — keep and let rank decide
  // Exclude clearly non-US geos when stated
  const nonUs = ["india","europe","uk only","united kingdom","germany","france","canada only","latam","emea only","apac"];
  if (nonUs.some((n) => loc.includes(n)) && !US_HINTS.some((h) => loc.includes(h))) return false;
  if (/remote/i.test(loc) && !/europe|uk|india|emea|apac|latam/i.test(loc)) return true;
  return US_HINTS.some((h) => loc.includes(h)) || /,\s*[A-Z]{2}\b/.test(job.location || "");
}

function matchesLocation(job: ScoutedJob, location?: string | null) {
  if (!location?.trim()) return true;
  const pref = location.toLowerCase();
  const hay = `${job.location ?? ""} ${job.title} ${job.description.slice(0, 1200)}`.toLowerCase();
  const tokens = pref
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && !["the", "and", "for", "with", "area", "based"].includes(t));
  if (tokens.length === 0) return true;
  // Remote preference
  if (tokens.includes("remote") && /remote/i.test(hay)) return true;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= 1;
}

function seniorityBuckets(years: number) {
  if (years <= 2) return { labels: ["junior", "entry", "associate", "new grad", "intern", "early career"], avoid: ["principal", "staff", "director", "vp", "head of"] };
  if (years <= 5) return { labels: ["mid", "intermediate", "junior", "associate"], avoid: ["principal", "distinguished", "vp "] };
  if (years <= 9) return { labels: ["senior", "sr", "mid", "lead"], avoid: ["intern", "new grad"] };
  return { labels: ["senior", "staff", "principal", "lead", "director", "head"], avoid: ["intern", "new grad", "junior"] };
}

function matchesExperience(job: ScoutedJob, experienceYears?: number | null) {
  if (experienceYears == null || Number.isNaN(experienceYears)) return true;
  const hay = `${job.title} ${job.description.slice(0, 2500)}`.toLowerCase();
  const { labels, avoid } = seniorityBuckets(experienceYears);
  const avoided = avoid.some((a) => hay.includes(a));
  const matched = labels.some((l) => hay.includes(l));
  // Soft filter: drop clearly mismatched seniority when title/description is explicit
  if (avoided && !matched && /(junior|senior|staff|principal|director|intern|entry)/i.test(job.title)) {
    return false;
  }
  return true;
}

function matchesBrief(job: ScoutedJob, brief: string) {
  const title = job.title.toLowerCase();
  const hay = `${job.title} ${job.company} ${job.location ?? ""} ${job.description}`.toLowerCase();
  const tokens = brief
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && !["the", "and", "for", "with", "roles", "role", "jobs", "job", "looking"].includes(t));

  if (tokens.length === 0) return true;

  const locationish = new Set([
    "remote", "hybrid", "onsite", "san", "francisco", "new", "york", "bay", "area",
    "united", "states", "usa", "uk", "london", "seattle", "austin", "chicago",
  ]);
  const core = tokens.filter((t) => !locationish.has(t));
  const coreForTitle = core.length ? core : tokens;
  const titleHit = coreForTitle.some((t) => title.includes(t));
  if (!titleHit) return false;

  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

function passesFilters(job: ScoutedJob, options: ScoutOptions) {
  return (
    withinDays(job.postedAt, options.maxAgeDays) &&
    isUsRelevant(job) &&
    matchesBrief(job, options.brief) &&
    matchesLocation(job, options.location) &&
    matchesExperience(job, options.experienceYears)
  );
}

export async function scoutRemotive(options: ScoutOptions): Promise<ScoutedJob[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs", {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      url: string;
      title: string;
      company_name: string;
      candidate_required_location?: string;
      description?: string;
      publication_date?: string;
      job_type?: string;
    }>;
  };

  return (data.jobs ?? [])
    .map((j) => {
      const postedAt = j.publication_date ? new Date(j.publication_date) : null;
      return {
        externalId: `remotive:${j.id}`,
        source: "Remotive",
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location || "Remote",
        remoteType: "remote",
        url: j.url,
        description: (j.description || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
        postedAt,
      } satisfies ScoutedJob;
    })
    .filter((j) => passesFilters(j, options));
}

export async function scoutArbeitnow(options: ScoutOptions): Promise<ScoutedJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      slug: string;
      url: string;
      title: string;
      company_name: string;
      location?: string;
      description?: string;
      created_at?: number;
      remote?: boolean;
    }>;
  };

  return (data.data ?? [])
    .map((j) => {
      const postedAt = j.created_at ? new Date(j.created_at * 1000) : null;
      return {
        externalId: `arbeitnow:${j.slug}`,
        source: "Arbeitnow",
        title: j.title,
        company: j.company_name,
        location: j.location || (j.remote ? "Remote" : undefined),
        remoteType: j.remote ? "remote" : "onsite",
        url: j.url,
        description: (j.description || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
        postedAt,
      } satisfies ScoutedJob;
    })
    .filter((j) => passesFilters(j, options));
}

export async function scoutRemoteOK(options: ScoutOptions): Promise<ScoutedJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "JobHuntCopilot/1.0" },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    id?: string | number;
    url?: string;
    position?: string;
    company?: string;
    location?: string;
    description?: string;
    date?: string;
    tags?: string[];
  }>;

  return data
    .filter((j) => j.id && j.position && j.company)
    .map((j) => {
      const postedAt = j.date ? new Date(j.date) : null;
      return {
        externalId: `remoteok:${j.id}`,
        source: "RemoteOK",
        title: j.position!,
        company: j.company!,
        location: j.location || "Remote",
        remoteType: "remote",
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        description: (j.description || (j.tags || []).join(", ")).replace(/<[^>]+>/g, " ").slice(0, 8000),
        postedAt,
      } satisfies ScoutedJob;
    })
    .filter((j) => passesFilters(j, options));
}

export async function scoutJobicy(options: ScoutOptions): Promise<ScoutedJob[]> {
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50", {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "JobHuntCopilot/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      jobs?: Array<{
        id: number | string;
        url: string;
        jobTitle: string;
        companyName: string;
        jobGeo?: string;
        jobDescription?: string;
        pubDate?: string;
      }>;
    };
    return (data.jobs ?? [])
      .map((j) => ({
        externalId: `jobicy:${j.id}`,
        source: "Jobicy",
        title: j.jobTitle,
        company: j.companyName,
        location: j.jobGeo || "Remote",
        remoteType: "remote" as const,
        url: j.url,
        description: (j.jobDescription || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
        postedAt: j.pubDate ? new Date(j.pubDate) : null,
      }))
      .filter((j) => passesFilters(j, options));
  } catch {
    return [];
  }
}

export async function scoutAdzuna(options: ScoutOptions): Promise<ScoutedJob[]> {
  const id = options.adzunaAppId || process.env.ADZUNA_APP_ID;
  const key = options.adzunaAppKey || process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];

  const what = encodeURIComponent(options.brief.slice(0, 80));
  const where = encodeURIComponent((options.location || "United States").slice(0, 80));
  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${id}&app_key=${key}&results_per_page=50&what=${what}&where=${where}&max_days_old=${options.maxAgeDays}&sort_by=date&content-type=application/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      id: string | number;
      title: string;
      company?: { display_name?: string };
      location?: { display_name?: string };
      description?: string;
      redirect_url?: string;
      created?: string;
      contract_time?: string;
    }>;
  };

  return (data.results ?? [])
    .map((j) => ({
      externalId: `adzuna:${j.id}`,
      source: "Adzuna US",
      title: j.title,
      company: j.company?.display_name || "Unknown",
      location: j.location?.display_name,
      remoteType: /remote/i.test(`${j.title} ${j.location?.display_name ?? ""}`) ? "remote" : "hybrid",
      url: j.redirect_url || `https://www.adzuna.com/details/${j.id}`,
      description: (j.description || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
      postedAt: j.created ? new Date(j.created) : null,
    }))
    .filter((j) => passesFilters(j, options));
}

/** Public Greenhouse boards — major US tech / product companies */
const GREENHOUSE_BOARDS = [
  "airbnb", "stripe", "discord", "figma", "notion", "openai", "anthropic", "datadog",
  "cloudflare", "vercel", "ramp", "brex", "plaid", "coinbase", "robinhood", "doordash",
  "instacart", "affirm", "chime", "scaleai", "databricks", "snowflake", "twilio",
  "dropbox", "asana", "airtable", "calendly", "gusto", "rippling", "gitlab", "hashicorp",
  "mongodb", "elastic", "okta", "duolingo", "reddit", "pinterest", "block", "nuro",
];

export async function scoutGreenhouse(options: ScoutOptions): Promise<ScoutedJob[]> {
  const results: ScoutedJob[] = [];
  await Promise.all(
    GREENHOUSE_BOARDS.map(async (board) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          jobs?: Array<{
            id: number;
            title: string;
            absolute_url: string;
            updated_at?: string;
            location?: { name?: string };
            content?: string;
          }>;
        };
        for (const j of data.jobs ?? []) {
          const postedAt = j.updated_at ? new Date(j.updated_at) : null;
          const job: ScoutedJob = {
            externalId: `greenhouse:${board}:${j.id}`,
            source: "Greenhouse",
            title: j.title,
            company: board.charAt(0).toUpperCase() + board.slice(1),
            location: j.location?.name,
            remoteType: /remote/i.test(j.location?.name || "") ? "remote" : "hybrid",
            url: j.absolute_url,
            description: (j.content || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
            postedAt,
          };
          if (passesFilters(job, { ...options, maxAgeDays: Math.max(options.maxAgeDays, 3) })) {
            results.push(job);
          }
        }
      } catch {
        // board may be unavailable — skip
      }
    }),
  );
  return results;
}

const LEVER_COMPANIES = [
  "netflix", "spotify", "twitch", "palantir", "eventbrite", "box", "shopify",
  "fing", "wealthfront", "mixpanel", "quillbot", "activecampaign",
];

export async function scoutLever(options: ScoutOptions): Promise<ScoutedJob[]> {
  const results: ScoutedJob[] = [];
  await Promise.all(
    LEVER_COMPANIES.map(async (company) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: string;
          text: string;
          hostedUrl: string;
          createdAt?: number;
          categories?: { location?: string; commitment?: string };
          descriptionPlain?: string;
          description?: string;
        }>;
        for (const j of data) {
          const postedAt = j.createdAt ? new Date(j.createdAt) : null;
          const job: ScoutedJob = {
            externalId: `lever:${company}:${j.id}`,
            source: "Lever",
            title: j.text,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.categories?.location,
            remoteType: /remote/i.test(j.categories?.location || "") ? "remote" : "hybrid",
            url: j.hostedUrl,
            description: (j.descriptionPlain || j.description || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
            postedAt,
          };
          if (passesFilters(job, { ...options, maxAgeDays: Math.max(options.maxAgeDays, 5) })) {
            results.push(job);
          }
        }
      } catch {
        // skip
      }
    }),
  );
  return results;
}

export async function scoutAllJobs(options: ScoutOptions): Promise<ScoutedJob[]> {
  const batches = await Promise.allSettled([
    scoutRemotive(options),
    scoutArbeitnow(options),
    scoutRemoteOK(options),
    scoutJobicy(options),
    scoutAdzuna(options),
    scoutGreenhouse(options),
    scoutLever(options),
  ]);

  const merged: ScoutedJob[] = [];
  const seen = new Set<string>();

  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    for (const job of batch.value) {
      const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
      if (seen.has(key) || seen.has(job.externalId)) continue;
      seen.add(key);
      seen.add(job.externalId);
      merged.push(job);
    }
  }

  // Newest first — prioritize newly opened roles
  return merged.sort((a, b) => {
    const at = a.postedAt?.getTime() ?? 0;
    const bt = b.postedAt?.getTime() ?? 0;
    return bt - at;
  });
}
