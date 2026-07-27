import type { ScoutedJob } from "./types";

export type ScoutOptions = {
  brief: string;
  location?: string | null;
  experienceYears?: number | null;
  visaSponsorship?: boolean | null;
  maxAgeDays: number;
  adzunaAppId?: string | null;
  adzunaAppKey?: string | null;
  usajobsApiKey?: string | null;
  usajobsUserAgent?: string | null;
};

export type PortalScoutStat = {
  name: string;
  count: number;
  status: "ok" | "empty" | "error" | "skipped";
  detail?: string;
};

export type VisaFilterResult = {
  needed: boolean;
  mode: "off" | "hard" | "soft";
  matched: number;
  total: number;
  message?: string;
};

export type ScoutResult = {
  jobs: ScoutedJob[];
  portals: PortalScoutStat[];
  visaFilter: VisaFilterResult;
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
  // Broad US preference — keep US-relevant roles
  if (tokens.includes("united") || tokens.includes("states") || tokens.includes("usa")) {
    return isUsRelevant(job);
  }
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

const VISA_SPONSORSHIP_PATTERNS = [
  /visa\s+sponsorship/i,
  /sponsorship\s+available/i,
  /will\s+sponsor/i,
  /sponsors?\s+(?:h-?1b|visas?|work\s+visa|green\s+card)/i,
  /(?:h-?1b|h1b)\s+(?:visa\s+)?(?:sponsor|sponsorship|transfer)/i,
  /work\s+visa/i,
  /sponsor\s+visa/i,
  /green\s+card\s+sponsorship/i,
  /\bopt\b/i,
  /stem\s+opt/i,
  /work\s+authorization\s+sponsorship/i,
  /immigration\s+sponsorship/i,
  /open\s+to\s+sponsorship/i,
  /provides?\s+sponsorship/i,
];

export function mentionsVisaSponsorship(job: Pick<ScoutedJob, "title" | "company" | "description" | "location">) {
  const hay = `${job.title} ${job.company} ${job.location ?? ""} ${job.description}`.slice(0, 12000);
  return VISA_SPONSORSHIP_PATTERNS.some((re) => re.test(hay));
}

/** Hard-filter for sponsorship signals; soften to prefer (not empty) when too few matches. */
export function applyVisaSponsorshipFilter(
  jobs: ScoutedJob[],
  needed?: boolean | null,
): { jobs: ScoutedJob[]; visaFilter: VisaFilterResult } {
  if (!needed) {
    return { jobs, visaFilter: { needed: false, mode: "off", matched: 0, total: jobs.length } };
  }

  const matched = jobs.filter(mentionsVisaSponsorship);
  const total = jobs.length;
  const minKeep = Math.min(5, Math.max(3, Math.ceil(total * 0.15)));

  if (matched.length >= minKeep || (total > 0 && matched.length === total)) {
    return {
      jobs: matched,
      visaFilter: {
        needed: true,
        mode: "hard",
        matched: matched.length,
        total,
        message: `Visa sponsorship filter: kept ${matched.length} of ${total} roles mentioning sponsorship`,
      },
    };
  }

  // Soften: sponsorship mentions first, then the rest — avoid hard-empty
  const rest = jobs.filter((j) => !mentionsVisaSponsorship(j));
  return {
    jobs: [...matched, ...rest],
    visaFilter: {
      needed: true,
      mode: "soft",
      matched: matched.length,
      total,
      message: `Visa sponsorship filter softened: only ${matched.length} of ${total} mentioned sponsorship — preferring those, keeping others`,
    },
  };
}

function displayName(token: string) {
  return token
    .split(/[-_]/)
    .map((p) => (p.length <= 3 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

async function settlePortal(
  name: string,
  fn: () => Promise<ScoutedJob[]>,
  skipReason?: string,
): Promise<{ jobs: ScoutedJob[]; stat: PortalScoutStat }> {
  if (skipReason) {
    return { jobs: [], stat: { name, count: 0, status: "skipped", detail: skipReason } };
  }
  try {
    const jobs = await fn();
    return {
      jobs,
      stat: {
        name,
        count: jobs.length,
        status: jobs.length > 0 ? "ok" : "empty",
      },
    };
  } catch (error) {
    return {
      jobs: [],
      stat: {
        name,
        count: 0,
        status: "error",
        detail: error instanceof Error ? error.message.slice(0, 120) : "failed",
      },
    };
  }
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

/** Public Greenhouse boards — major US tech / product / career sites */
const GREENHOUSE_BOARDS = [
  "airbnb", "stripe", "discord", "figma", "notion", "openai", "anthropic", "datadog",
  "cloudflare", "vercel", "ramp", "brex", "plaid", "coinbase", "robinhood", "doordash",
  "instacart", "affirm", "chime", "scaleai", "databricks", "snowflake", "twilio",
  "dropbox", "asana", "airtable", "calendly", "gusto", "rippling", "gitlab", "hashicorp",
  "mongodb", "elastic", "okta", "duolingo", "reddit", "pinterest", "block", "nuro",
  "hubspot", "square", "lyft", "uber", "coursera", "grammarly", "canva",
  "linear", "retool", "sentry", "segment", "roblox", "nvidia",
  "intel", "amd", "cisco", "salesforce", "adobe", "intuit", "paypal", "ebay",
];

export async function scoutGreenhouse(options: ScoutOptions): Promise<ScoutedJob[]> {
  const results: ScoutedJob[] = [];
  const age = Math.max(options.maxAgeDays, 3);
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
            company: displayName(board),
            location: j.location?.name,
            remoteType: /remote/i.test(j.location?.name || "") ? "remote" : "hybrid",
            url: j.absolute_url,
            description: (j.content || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
            postedAt,
          };
          if (passesFilters(job, { ...options, maxAgeDays: age })) {
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
  "nubank", "grammarly", "duolingo", "notion", "figma", "canva",
  "postman", "zapier", "attentive", "homerun", "lattice", "gousto",
];

export async function scoutLever(options: ScoutOptions): Promise<ScoutedJob[]> {
  const results: ScoutedJob[] = [];
  const age = Math.max(options.maxAgeDays, 5);
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
            company: displayName(company),
            location: j.categories?.location,
            remoteType: /remote/i.test(j.categories?.location || "") ? "remote" : "hybrid",
            url: j.hostedUrl,
            description: (j.descriptionPlain || j.description || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
            postedAt,
          };
          if (passesFilters(job, { ...options, maxAgeDays: age })) {
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

/** Public Ashby job boards (US startups / growth companies) */
const ASHBY_BOARDS = [
  "openai", "anthropic", "notion", "linear", "ramp", "mercury", "rippling",
  "vercel", "retool", "cursor", "perplexity", "huggingface", "togetherai",
  "benchling", "airtable", "superhuman", "loom", "notionlabs", "ashby",
  "watershed", "navan", "flexport", "brex", "deel", "remotecom",
];

export async function scoutAshby(options: ScoutOptions): Promise<ScoutedJob[]> {
  const results: ScoutedJob[] = [];
  const age = Math.max(options.maxAgeDays, 5);
  await Promise.all(
    ASHBY_BOARDS.map(async (board) => {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "JobHuntCopilot/1.0" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          jobs?: Array<{
            id: string;
            title: string;
            location?: string;
            secondaryLocations?: string[];
            department?: string;
            team?: string;
            publishedAt?: string;
            updatedAt?: string;
            jobUrl?: string;
            applyUrl?: string;
            isListed?: boolean;
            descriptionPlain?: string;
            descriptionHtml?: string;
          }>;
        };
        for (const j of data.jobs ?? []) {
          if (j.isListed === false) continue;
          const postedAt = j.publishedAt || j.updatedAt ? new Date(j.publishedAt || j.updatedAt!) : null;
          const loc = [j.location, ...(j.secondaryLocations || [])].filter(Boolean).join(" / ");
          const job: ScoutedJob = {
            externalId: `ashby:${board}:${j.id}`,
            source: "Ashby",
            title: j.title,
            company: displayName(board),
            location: loc || undefined,
            remoteType: /remote/i.test(loc) ? "remote" : "hybrid",
            url: j.jobUrl || j.applyUrl || `https://jobs.ashbyhq.com/${board}/${j.id}`,
            description: (j.descriptionPlain || j.descriptionHtml || "").replace(/<[^>]+>/g, " ").slice(0, 8000),
            postedAt,
          };
          if (passesFilters(job, { ...options, maxAgeDays: age })) {
            results.push(job);
          }
        }
      } catch {
        // board may be private / renamed
      }
    }),
  );
  return results;
}

/** USAJOBS — federal career portal (free API key required) */
export async function scoutUsaJobs(options: ScoutOptions): Promise<ScoutedJob[]> {
  const apiKey = options.usajobsApiKey || process.env.USAJOBS_API_KEY;
  const userAgent =
    options.usajobsUserAgent ||
    process.env.USAJOBS_USER_AGENT ||
    process.env.USAJOBS_EMAIL ||
    "";
  if (!apiKey || !userAgent) return [];

  const keyword = encodeURIComponent(options.brief.slice(0, 80));
  const location = encodeURIComponent((options.location || "United States").slice(0, 80));
  const days = Math.min(Math.max(options.maxAgeDays, 1), 30);
  const url =
    `https://data.usajobs.gov/api/search?Keyword=${keyword}&LocationName=${location}` +
    `&DatePosted=${days}&ResultsPerPage=50&SortField=DatePosted&SortDirection=Desc`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    headers: {
      Host: "data.usajobs.gov",
      "User-Agent": userAgent,
      "Authorization-Key": apiKey,
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    SearchResult?: {
      SearchResultItems?: Array<{
        MatchedObjectId?: string;
        MatchedObjectDescriptor?: {
          PositionID?: string;
          PositionTitle?: string;
          PositionURI?: string;
          ApplyURI?: string[];
          OrganizationName?: string;
          DepartmentName?: string;
          PositionLocationDisplay?: string;
          UserArea?: { Details?: { JobSummary?: string } };
          PublicationStartDate?: string;
          PositionStartDate?: string;
        };
      }>;
    };
  };

  return (data.SearchResult?.SearchResultItems ?? [])
    .map((item) => {
      const d = item.MatchedObjectDescriptor;
      if (!d?.PositionTitle) return null;
      const id = item.MatchedObjectId || d.PositionID || d.PositionTitle;
      const posted = d.PublicationStartDate || d.PositionStartDate;
      const job: ScoutedJob = {
        externalId: `usajobs:${id}`,
        source: "USAJOBS",
        title: d.PositionTitle,
        company: d.OrganizationName || d.DepartmentName || "US Federal",
        location: d.PositionLocationDisplay || "United States",
        remoteType: /remote|telework/i.test(d.PositionLocationDisplay || "") ? "remote" : "onsite",
        url: d.ApplyURI?.[0] || d.PositionURI || `https://www.usajobs.gov/job/${id}`,
        description: (d.UserArea?.Details?.JobSummary || "").slice(0, 8000),
        postedAt: posted ? new Date(posted) : null,
      };
      return job;
    })
    .filter((j): j is ScoutedJob => j != null)
    .filter((j) => passesFilters(j, options));
}

function mergeJobs(batches: ScoutedJob[][]): ScoutedJob[] {
  const merged: ScoutedJob[] = [];
  const seen = new Set<string>();

  for (const batch of batches) {
    for (const job of batch) {
      const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
      if (seen.has(key) || seen.has(job.externalId)) continue;
      seen.add(key);
      seen.add(job.externalId);
      merged.push(job);
    }
  }

  return merged.sort((a, b) => {
    const at = a.postedAt?.getTime() ?? 0;
    const bt = b.postedAt?.getTime() ?? 0;
    return bt - at;
  });
}

export async function scoutAllJobs(options: ScoutOptions): Promise<ScoutResult> {
  const hasAdzuna = Boolean(
    (options.adzunaAppId || process.env.ADZUNA_APP_ID) &&
      (options.adzunaAppKey || process.env.ADZUNA_APP_KEY),
  );
  const hasUsaJobs = Boolean(
    (options.usajobsApiKey || process.env.USAJOBS_API_KEY) &&
      (options.usajobsUserAgent || process.env.USAJOBS_USER_AGENT || process.env.USAJOBS_EMAIL),
  );

  const settled = await Promise.all([
    settlePortal("Remotive", () => scoutRemotive(options)),
    settlePortal("Arbeitnow", () => scoutArbeitnow(options)),
    settlePortal("RemoteOK", () => scoutRemoteOK(options)),
    settlePortal("Jobicy", () => scoutJobicy(options)),
    settlePortal(
      "Adzuna US",
      () => scoutAdzuna(options),
      hasAdzuna ? undefined : "missing ADZUNA_APP_ID/KEY",
    ),
    settlePortal(`Greenhouse (${GREENHOUSE_BOARDS.length} boards)`, () => scoutGreenhouse(options)),
    settlePortal(`Lever (${LEVER_COMPANIES.length} boards)`, () => scoutLever(options)),
    settlePortal(`Ashby (${ASHBY_BOARDS.length} boards)`, () => scoutAshby(options)),
    settlePortal(
      "USAJOBS",
      () => scoutUsaJobs(options),
      hasUsaJobs ? undefined : "missing USAJOBS_API_KEY + USAJOBS_USER_AGENT",
    ),
  ]);

  const merged = mergeJobs(settled.map((s) => s.jobs));
  const { jobs, visaFilter } = applyVisaSponsorshipFilter(merged, options.visaSponsorship);

  return {
    jobs,
    portals: settled.map((s) => s.stat),
    visaFilter,
  };
}

export function formatPortalLog(portals: PortalScoutStat[]) {
  return portals
    .map((p) => {
      if (p.status === "skipped") return `${p.name}: skipped (${p.detail})`;
      if (p.status === "error") return `${p.name}: error (${p.detail})`;
      return `${p.name}: ${p.count}`;
    })
    .join(" · ");
}
