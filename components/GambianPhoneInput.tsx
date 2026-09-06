"use client";

import {
  GAMBIA_CALLING_CODE,
  GAMBIA_LOCAL_NUMBER_MAX_LENGTH,
  GAMBIA_LOCAL_NUMBER_MIN_LENGTH,
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
        minLength={GAMBIA_LOCAL_NUMBER_MIN_LENGTH}
        maxLength={GAMBIA_LOCAL_NUMBER_MAX_LENGTH}
        pattern="(?:[1-9][0-9]{6}|(?:83|86|87)[1-9][0-9]{6})"
        title="Enter 7 digits, or the new 9-digit number beginning with 83, 86 or 87."
        placeholder="831234567"
        value={value}
        onChange={(event) =>
          onChange(sanitizeGambianLocalNumber(event.target.value))
        }
        className="min-w-0 flex-1 px-3 py-3 text-sm outline-none"
      />
    </div>
  );
}
