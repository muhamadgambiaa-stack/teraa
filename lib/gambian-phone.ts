export const GAMBIA_CALLING_CODE = "+220";

export function sanitizeGambianLocalNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

export function isValidGambianLocalNumber(value: string) {
  return /^[1-9][0-9]{6}$/.test(value);
}

export function toGambianPhoneNumber(localNumber: string) {
  return `${GAMBIA_CALLING_CODE}${localNumber}`;
}

export function gambianLocalNumberFromStored(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (/^220[1-9][0-9]{6}$/.test(digits)) {
    return digits.slice(3);
  }

  if (/^[1-9][0-9]{6}$/.test(digits)) {
    return digits;
  }

  return "";
}
