import Link from "next/link";

type BackButtonProps = {
  href: string;
  label?: string;
  iconOnly?: boolean;
};

export function BackButton({
  href,
  label = "Back",
  iconOnly = false,
}: BackButtonProps) {
  return (
    <Link
      href={href}
      aria-label={iconOnly ? label : undefined}
      className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2.5 text-sm font-semibold transition hover:bg-[#f7f2e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173c63] focus-visible:ring-offset-2"
      style={{ color: "var(--ink)" }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 shrink-0"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {iconOnly ? null : <span>{label}</span>}
    </Link>
  );
}
