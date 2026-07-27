import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function domainFromCompany(company: string): string | null {
  const cleaned = company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "");
  if (!cleaned || cleaned.length < 2) return null;
  return `${cleaned}.com`;
}

export function truncate(text: string, max = 240) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function scoreColor(score: number) {
  if (score >= 80) return "text-[#0a4f49] bg-[rgba(15,118,110,0.12)] border-[rgba(15,118,110,0.28)]";
  if (score >= 65) return "text-[#115e59] bg-[rgba(15,118,110,0.08)] border-[rgba(15,118,110,0.2)]";
  if (score >= 50) return "text-[#92400e] bg-[rgba(180,83,9,0.1)] border-[rgba(180,83,9,0.22)]";
  return "text-[#475569] bg-[rgba(71,85,105,0.08)] border-[rgba(71,85,105,0.18)]";
}
