"use client";

import { useId, useState, type ReactNode } from "react";

export function CollapsibleSearchFilters({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="sm:hidden w-full rounded-lg border px-3 py-2.5 text-sm font-medium flex items-center justify-between bg-white"
        style={{ borderColor: "var(--sand)", color: "var(--ink)" }}
      >
        <span>
          Filters{activeCount > 0 ? ` (${activeCount} active)` : ""}
        </span>
        <ChevronIcon open={open} />
      </button>

      <div id={panelId} className={`${open ? "block" : "hidden"} sm:block`}>
        {children}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
