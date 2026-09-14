"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

export function PendingSubmitButton({
  label,
  pendingLabel,
  className,
  style,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  style?: CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      style={style}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
