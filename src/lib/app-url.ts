/** Canonical production PWA entry (root `/`). */
export const PRODUCTION_APP_URL = "https://job-hunt-copilot-blush.vercel.app";

function isProtectedDeploymentHost(hostOrUrl: string): boolean {
  // Preview/deployment hosts like *.vercel.app under the project team often require Vercel SSO.
  return /job-hunt-copilot-[a-z0-9]+-bhargav7675s-projects\.vercel\.app/i.test(
    hostOrUrl,
  );
}

/**
 * Public URL for opening the app on another device (phone).
 * Prefers NEXT_PUBLIC_APP_URL; otherwise the live origin (or production fallback on localhost).
 * Never returns SSO-protected deployment URLs — those break the installed PWA / QR link.
 */
export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv && !isProtectedDeploymentHost(fromEnv)) return fromEnv;

  if (typeof window !== "undefined") {
    const { origin } = window.location;
    if (
      !/localhost|127\.0\.0\.1/.test(origin) &&
      !isProtectedDeploymentHost(origin)
    ) {
      return origin;
    }
  }

  return PRODUCTION_APP_URL;
}
