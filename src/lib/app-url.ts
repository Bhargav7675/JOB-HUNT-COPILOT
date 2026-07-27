/** Canonical production PWA entry (root `/`). */
export const PRODUCTION_APP_URL = "https://job-hunt-copilot-blush.vercel.app";

/**
 * Public URL for opening the app on another device (phone).
 * Prefers NEXT_PUBLIC_APP_URL; otherwise the live origin (or production fallback on localhost).
 */
export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const { origin } = window.location;
    if (!/localhost|127\.0\.0\.1/.test(origin)) return origin;
  }

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return PRODUCTION_APP_URL;
}
