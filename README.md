# Job Hunt Copilot

Job-hunt agent: private accounts, ranked roles, verified contacts when available, ATS-tailored resumes (plain text + **LaTeX** + **PDF**), and application autofill on supported career portals.

## Live app

**https://job-hunt-copilot-blush.vercel.app**

Each person:
1. Creates an account (email + password, no Google)
2. Completes onboarding (location, years of experience, resume + one-line brief + optional autofill)
3. Hits **Run agent now**

## What it does

1. **Scouts** open / newly posted roles from **connected boards** (honest coverage — not “all jobs on the internet”):
   - Aggregators: Remotive, Arbeitnow, RemoteOK, Jobicy, optional Adzuna US
   - Company ATS boards: Greenhouse, Lever, Ashby (expanded board lists)
   - Federal: USAJOBS (optional free API key)
   - Filtered by your **location** and **years of experience**; prefers freshly posted roles (`maxAgeDays`)
2. **Ranks** against each user’s real resume (LLM + heuristics; never invents skills)
3. **ATS-tailors** the resume with anti-hallucination guardrails, then exports:
   - Plain text
   - **LaTeX** (`.tex`, single-column `article` class)
   - **PDF** (real downloadable text-based PDF)
4. **Finds contacts** via Hunter.io when keyed — otherwise LinkedIn search (never invents emails)
5. **Drafts** coffee-chat outreach (copy-only — never auto-sends email)
6. **Autofills** applications on Greenhouse / Lever / Ashby when enabled and score thresholds are met

Scout run logs list which portals were queried and how many roles each returned.

### No LLM hallucination (resumes)

Tailoring and ranking prompts require **only facts present in the uploaded/pasted resume**. A post-processor strips lines/tokens that introduce unsupported employers, degrees, or skill claims. Missing JD keywords stay missing — they are never fabricated to raise the ATS score.

### ATS scoring

Heuristic keyword overlap + structure checks (standard headings, contact in body, single-column text, skills section). Based on public ATS-friendly practices — not a paid vendor “magic score.” See `src/lib/ats/`.

## Local development

```bash
npm install
cp .env.example .env   # fill DATABASE_URL, SESSION_SECRET, CRON_SECRET
npx prisma migrate dev
npm run dev
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Signs login cookies |
| `CRON_SECRET` | Yes | Protects `/api/cron/run` |
| `OPENAI_API_KEY` | Optional | Better ranking + outreach (or set per-user in Settings) |
| `HUNTER_API_KEY` | Optional | Verified emails |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Optional | Adzuna US job search (free tier) |
| `USAJOBS_API_KEY` | Optional | Federal USAJOBS API (free registration) |
| `USAJOBS_USER_AGENT` | Optional | Email registered with USAJOBS |

No commercial ATS APIs are required. Resume PDF/LaTeX are generated locally in-app.

## Overnight

Vercel Cron runs daily at **08:00 UTC** (`vercel.json`). Users can also run manually anytime.

## Important

If you used Prisma `create-db`, **claim the database** so it doesn’t auto-delete:
https://create-db.prisma.io/claim?projectID=proj_qy4w76defwx9aqntr94qs964
