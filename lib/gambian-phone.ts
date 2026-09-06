export const GAMBIA_CALLING_CODE = "+220";

// The national plan is moving from 7 to 9 digits. During the
// transition, accept both the legacy number and the new operator
// prefixed number so existing accounts continue to work.
export const GAMBIA_LOCAL_NUMBER_MIN_LENGTH = 7;
export const GAMBIA_LOCAL_NUMBER_MAX_LENGTH = 9;

export function sanitizeGambianLocalNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, GAMBIA_LOCAL_NUMBER_MAX_LENGTH);
}

export function isValidGambianLocalNumber(value: string) {
  return /^(?:[1-9][0-9]{6}|(?:83|86|87)[1-9][0-9]{6})$/.test(value);
}

export function toGambianPhoneNumber(localNumber: string) {
  return `${GAMBIA_CALLING_CODE}${localNumber}`;
}

export function gambianLocalNumberFromStored(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (/^220(?:[1-9][0-9]{6}|(?:83|86|87)[1-9][0-9]{6})$/.test(digits)) {
    return digits.slice(3);
  }

  if (/^[1-9][0-9]{6}$/.test(digits)) {
    return digits;
  }

  return "";
}
