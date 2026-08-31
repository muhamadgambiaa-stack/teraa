"use client";

import {
  GAMBIA_CALLING_CODE,
  sanitizeGambianLocalNumber,
} from "@/lib/gambian-phone";

type GambianPhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function GambianPhoneInput({
  value,
  onChange,
  className = "",
}: GambianPhoneInputProps) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg border bg-white focus-within:ring-2 ${className}`}
      style={{ borderColor: "var(--sand)" }}
    >
      <span
        className="flex items-center border-r bg-gray-50 px-3 text-sm font-medium text-gray-600"
        style={{ borderColor: "var(--sand)" }}
        aria-label="Gambia calling code"
      >
        {GAMBIA_CALLING_CODE}
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required
        minLength={7}
        maxLength={7}
        pattern="[1-9][0-9]{6}"
        title="Enter exactly 7 digits. The first digit cannot be zero."
        placeholder="7123456"
        value={value}
        onChange={(event) =>
          onChange(sanitizeGambianLocalNumber(event.target.value))
        }
        className="min-w-0 flex-1 px-3 py-3 text-sm outline-none"
      />
    </div>
  );
}
