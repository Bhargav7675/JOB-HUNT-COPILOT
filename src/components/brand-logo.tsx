import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg" | "hero";
  showWordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: 28,
  md: 34,
  lg: 42,
  hero: 96,
} as const;

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = true,
  className = "",
}: BrandLogoProps) {
  const px = sizes[size];
  const mark = (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <Image
        src="/logo.png"
        alt="Job Hunt Copilot"
        width={px}
        height={px}
        priority
        className="shrink-0 rounded-[22%] shadow-[0_8px_20px_rgba(15,118,110,0.22)]"
        style={{ width: px, height: px }}
      />
      {showWordmark ? (
        <span
          className={`display truncate leading-none text-[var(--ink)] ${
            size === "hero"
              ? "text-[2rem] sm:text-[2.75rem]"
              : size === "lg"
                ? "text-[1.55rem] sm:text-[1.85rem]"
                : size === "md"
                  ? "text-[1.35rem] sm:text-[1.65rem]"
                  : "text-lg"
          }`}
        >
          Job Hunt Copilot
        </span>
      ) : null}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex min-w-0 transition-opacity hover:opacity-90">
      {mark}
    </Link>
  );
}
