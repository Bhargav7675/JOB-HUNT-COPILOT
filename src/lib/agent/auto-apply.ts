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

async function fillByLabel(page: Page, labelPatterns: RegExp[], value?: string | null) {
  if (!value) return false;
  for (const pattern of labelPatterns) {
    try {
      const byLabel = page.getByLabel(pattern).first();
      if ((await byLabel.count()) > 0) {
        await byLabel.fill(value, { timeout: 2500 });
        return true;
      }
    } catch {
      // continue
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
    'button:has-text("Submit application")',
    'button:has-text("Submit Application")',
    'button:has-text("Send application")',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
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
  if (u.includes("ashbyhq.com") || u.includes("jobs.ashbyhq.com") || source === "Ashby") {
    return "playwright-ashby";
  }
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
    "application has been submitted",
  ];
  if (successHints.some((h) => text.includes(h))) {
    return text.slice(0, 280);
  }
  return null;
}

async function openApplyForm(page: Page) {
  const applyEntry = page
    .locator(
      'a:has-text("Apply for this job"), button:has-text("Apply for this job"), a:has-text("Apply now"), button:has-text("Apply now"), a:has-text("Apply"), button:has-text("Apply")',
    )
    .first();
  if ((await applyEntry.count()) > 0) {
    try {
      await applyEntry.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
    } catch {
      // already on form
    }
  }
}

async function autofillApplicantFields(page: Page, applicant: ApplicantProfile, first: string, last: string) {
  let filled = 0;

  const fill = async (ok: boolean) => {
    if (ok) filled += 1;
  };

  // Greenhouse / Lever / Ashby common name fields
  await fill(
    await fillIfExists(page, [
      'input[name="job_application[first_name]"]',
      'input[name="first_name"]',
      'input[name="firstName"]',
      'input[id*="first" i]',
      'input[autocomplete="given-name"]',
      'input[placeholder*="First" i]',
    ], first) || (await fillByLabel(page, [/first name/i, /^first$/i], first)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="job_application[last_name]"]',
      'input[name="last_name"]',
      'input[name="lastName"]',
      'input[id*="last" i]',
      'input[autocomplete="family-name"]',
      'input[placeholder*="Last" i]',
    ], last) || (await fillByLabel(page, [/last name/i, /^last$/i], last)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="name"]',
      'input[name="full_name"]',
      'input[name="fullName"]',
      'input[autocomplete="name"]',
      'input[placeholder*="Full name" i]',
    ], applicant.fullName) || (await fillByLabel(page, [/full name/i, /^name$/i], applicant.fullName)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="job_application[email]"]',
      'input[name="email"]',
      'input[name="emailAddress"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ], applicant.email) || (await fillByLabel(page, [/e-?mail/i], applicant.email)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="job_application[phone]"]',
      'input[name="phone"]',
      'input[name="phoneNumber"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ], applicant.phone) || (await fillByLabel(page, [/phone/i, /mobile/i], applicant.phone)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="job_application[location]"]',
      'input[name="location"]',
      'input[name="currentLocation"]',
      'input[placeholder*="Location" i]',
      'input[placeholder*="City" i]',
    ], applicant.locationPref) || (await fillByLabel(page, [/location/i, /city.*state/i], applicant.locationPref)),
  );

  await fill(
    await fillIfExists(page, [
      'input[name="urls[LinkedIn]"]',
      'input[name="job_application[urls][LinkedIn]"]',
      'input[name="linkedin"]',
      'input[name="linkedIn"]',
      'input[name="linkedinUrl"]',
      'input[placeholder*="LinkedIn" i]',
      'input[aria-label*="LinkedIn" i]',
    ], applicant.linkedinUrl) || (await fillByLabel(page, [/linkedin/i], applicant.linkedinUrl)),
  );

  // Website / portfolio often accepts LinkedIn when no separate site exists
  await fillIfExists(page, [
    'input[name="urls[Portfolio]"]',
    'input[name="urls[Website]"]',
    'input[name="website"]',
    'input[name="portfolio"]',
    'input[placeholder*="Website" i]',
    'input[placeholder*="Portfolio" i]',
  ], applicant.linkedinUrl);

  // Cover / additional info — prefer named fields over the first textarea
  await fillIfExists(page, [
    'textarea[name="job_application[cover_letter]"]',
    'textarea[name="cover_letter"]',
    'textarea[name="coverLetter"]',
    'textarea[name="comments"]',
    'textarea[name="additional_information"]',
    'textarea[name="additionalInformation"]',
    'textarea[placeholder*="cover" i]',
    'textarea[aria-label*="cover" i]',
    'textarea[aria-label*="additional" i]',
  ], `Applying for this role with a tailored resume. Happy to share more detail quickly.`);

  return filled;
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

    await openApplyForm(page);

    const filled = await autofillApplicantFields(page, options.applicant, first, last);
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

    // Autofill-only success when board requires manual review (CAPTCHA etc.) but fields were filled
    if (filled >= 3 && uploaded && !clicked) {
      return {
        status: "failed",
        method,
        error: "Autofilled profile/resume fields but could not submit (CAPTCHA, login, or extra required questions).",
        applyUrl: options.applyUrl,
      };
    }

    if (!uploaded && !clicked && filled < 2) {
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
  return (
    method !== "playwright-generic" ||
    /greenhouse|lever|ashby|workable|smartrecruiters|jobvite/i.test(url)
  );
}
