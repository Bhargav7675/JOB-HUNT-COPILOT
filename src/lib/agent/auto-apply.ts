import fs from "fs/promises";
import os from "os";
import path from "path";
import type { Browser, Page } from "playwright-core";

export type ApplicantProfile = {
  fullName: string;
  email: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  locationPref?: string | null;
  resumeText: string;
  tailoredResumeText?: string | null;
};

export type AutoApplyResult = {
  status: "submitted" | "failed" | "unsupported";
  method: string;
  confirmationText?: string;
  error?: string;
  applyUrl: string;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || fullName,
    last: parts.length > 1 ? parts.slice(1).join(" ") : "Applicant",
  };
}

async function launchBrowser(): Promise<Browser> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    const chromiumMod = await import("@sparticuz/chromium");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium: any = (chromiumMod as any).default ?? chromiumMod;
    const { chromium: playwrightChromium } = await import("playwright-core");
    return playwrightChromium.launch({
      args: chromium.args as string[],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright-core");
  // Prefer locally installed Playwright browser
  try {
    const playwright = await import("playwright");
    return playwright.chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function writeResumeFile(text: string, fullName: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jhc-resume-"));
  const filePath = path.join(dir, `${fullName.replace(/[^\w]+/g, "_")}_resume.txt`);
  await fs.writeFile(filePath, text, "utf8");
  return { dir, filePath };
}

async function fillIfExists(page: Page, selectors: string[], value?: string | null) {
  if (!value) return false;
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0) {
      try {
        await loc.fill(value, { timeout: 2500 });
        return true;
      } catch {
        // try next
      }
    }
  }
  return false;
}

async function uploadResume(page: Page, filePath: string) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();
  if (count === 0) return false;
  await inputs.first().setInputFiles(filePath);
  return true;
}

async function clickSubmit(page: Page) {
  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
    'button:has-text("Send application")',
    'button:has-text("Submit application")',
    'a:has-text("Submit application")',
  ];
  for (const selector of candidates) {
    const loc = page.locator(selector).first();
    if ((await loc.count()) > 0) {
      try {
        await loc.click({ timeout: 3000 });
        return true;
      } catch {
        // continue
      }
    }
  }
  return false;
}

function detectMethod(url: string, source: string) {
  const u = url.toLowerCase();
  if (u.includes("greenhouse.io") || source === "Greenhouse") return "playwright-greenhouse";
  if (u.includes("lever.co") || source === "Lever") return "playwright-lever";
  if (u.includes("ashbyhq.com")) return "playwright-ashby";
  if (u.includes("jobs.ashbyhq.com")) return "playwright-ashby";
  return "playwright-generic";
}

async function detectSuccess(page: Page) {
  const text = ((await page.locator("body").innerText().catch(() => "")) || "").toLowerCase();
  const successHints = [
    "thank you for applying",
    "application submitted",
    "thanks for applying",
    "we have received your application",
    "application received",
    "successfully submitted",
    "thanks for your interest",
  ];
  if (successHints.some((h) => text.includes(h))) {
    return text.slice(0, 280);
  }
  return null;
}

export async function autoApplyToRole(options: {
  applyUrl: string;
  source: string;
  applicant: ApplicantProfile;
}): Promise<AutoApplyResult> {
  const method = detectMethod(options.applyUrl, options.source);
  const { first, last } = splitName(options.applicant.fullName);
  const resumeBody = options.applicant.tailoredResumeText || options.applicant.resumeText;

  let browser: Browser | null = null;
  let tempDir: string | null = null;

  try {
    const resume = await writeResumeFile(resumeBody, options.applicant.fullName);
    tempDir = resume.dir;
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(options.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);

    // Many boards need an "Apply" click first
    const applyEntry = page.locator('a:has-text("Apply"), button:has-text("Apply"), a:has-text("Apply for this job")').first();
    if ((await applyEntry.count()) > 0) {
      try {
        await applyEntry.click({ timeout: 3000 });
        await page.waitForTimeout(1200);
      } catch {
        // already on form
      }
    }

    await fillIfExists(page, [
      'input[name="job_application[first_name]"]',
      'input[name="first_name"]',
      'input[name="firstName"]',
      'input[autocomplete="given-name"]',
      'input[placeholder*="First" i]',
    ], first);

    await fillIfExists(page, [
      'input[name="job_application[last_name]"]',
      'input[name="last_name"]',
      'input[name="lastName"]',
      'input[autocomplete="family-name"]',
      'input[placeholder*="Last" i]',
    ], last);

    await fillIfExists(page, [
      'input[name="name"]',
      'input[name="full_name"]',
      'input[name="fullName"]',
      'input[autocomplete="name"]',
    ], options.applicant.fullName);

    await fillIfExists(page, [
      'input[name="job_application[email]"]',
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ], options.applicant.email);

    await fillIfExists(page, [
      'input[name="job_application[phone]"]',
      'input[name="phone"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ], options.applicant.phone);

    await fillIfExists(page, [
      'input[name="job_application[location]"]',
      'input[name="location"]',
      'input[placeholder*="Location" i]',
    ], options.applicant.locationPref);

    await fillIfExists(page, [
      'input[name="urls[LinkedIn]"]',
      'input[name="linkedin"]',
      'input[name="linkedIn"]',
      'input[placeholder*="LinkedIn" i]',
      'input[aria-label*="LinkedIn" i]',
    ], options.applicant.linkedinUrl);

    // Cover / additional info: short honest note
    await fillIfExists(page, [
      'textarea[name="job_application[cover_letter]"]',
      'textarea[name="comments"]',
      'textarea[name="additional_information"]',
      'textarea[placeholder*="cover" i]',
      "textarea",
    ], `Applying for this role with a tailored resume. Happy to share more detail quickly.`);

    const uploaded = await uploadResume(page, resume.filePath);
    const clicked = await clickSubmit(page);
    await page.waitForTimeout(2500);

    const confirmation = await detectSuccess(page);
    if (confirmation) {
      return {
        status: "submitted",
        method,
        confirmationText: confirmation,
        applyUrl: options.applyUrl,
      };
    }

    // If we filled + uploaded + clicked, treat as submitted with low confidence confirmation
    if (uploaded && clicked) {
      return {
        status: "submitted",
        method,
        confirmationText: "Form submitted (no explicit thank-you page detected). Verify in your email.",
        applyUrl: options.applyUrl,
      };
    }

    if (!uploaded && !clicked) {
      return {
        status: "unsupported",
        method,
        error: "Could not locate a standard apply form/file upload on this page (CAPTCHA or custom ATS).",
        applyUrl: options.applyUrl,
      };
    }

    return {
      status: "failed",
      method,
      error: "Form interaction incomplete — board may require login, CAPTCHA, or extra required fields.",
      applyUrl: options.applyUrl,
    };
  } catch (error) {
    return {
      status: "failed",
      method,
      error: error instanceof Error ? error.message : "Auto-apply failed",
      applyUrl: options.applyUrl,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function isLikelyAutoApplySupported(url: string, source: string) {
  const method = detectMethod(url, source);
  return method !== "playwright-generic" || /greenhouse|lever|ashby|workable|smartrecruiters|jobvite/i.test(url);
}
