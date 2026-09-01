"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export function ScrollToLatestMessage({
  messageCount,
}: {
  messageCount: number;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  return <div ref={endRef} aria-hidden="true" />;
}

export function SendMessageButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="min-w-[72px] min-h-10 rounded-full px-4 py-2 text-sm text-white font-medium shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "var(--indigo)" }}
    >
      {pending ? "Sending…" : "Send"}
    </button>
  );
}
