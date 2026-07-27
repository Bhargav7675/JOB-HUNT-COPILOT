# Job Hunt Copilot

Job-hunt agent: private accounts, ranked roles, verified contacts when available, ATS-tailored resumes, and auto-apply on supported boards.

## Live app

**https://job-hunt-copilot-blush.vercel.app**

Each person:
1. Creates an account (email + password, no Google)
2. Completes onboarding (location, years of experience, resume + one-line brief)
3. Hits **Run agent now**

## What it does

1. **Scouts** newly opened US roles from Remotive, Arbeitnow, RemoteOK, Jobicy, Greenhouse, Lever, optional Adzuna — filtered by your location and experience  

2. **Ranks** against each user’s resume  
3. **Finds contacts** via Hunter.io when keyed — otherwise LinkedIn search (never invents emails)  
4. **Drafts** coffee-chat outreach  
5. **Suggests** honest resume tweaks  

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
| `OPENAI_API_KEY` | Optional | Better ranking + outreach |
| `HUNTER_API_KEY` | Optional | Verified emails |

## Overnight

Vercel Cron runs daily at **08:00 UTC** (`vercel.json`). Users can also run manually anytime.

## Important

If you used Prisma `create-db`, **claim the database** so it doesn’t auto-delete:
https://create-db.prisma.io/claim?projectID=proj_qy4w76defwx9aqntr94qs964
