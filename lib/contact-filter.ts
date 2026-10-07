/*
 * Detects phone numbers, messaging apps, emails and links in free text
 * so buyers and sellers keep chats, payments and deals inside Teraa.
 *
 * Shared by server actions and client forms (no server-only imports).
 * The database trigger in supabase/migrations/20261008000000_block_contact_sharing.sql
 * enforces the main rules even if someone bypasses the app.
 */

export const CONTACT_BLOCK_MESSAGE =
  "For your protection, keep payments and chat on Teraa. Please remove phone numbers, WhatsApp, emails and links.";

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const KEYWORD_PATTERN =
  /(whats\s?app|whatsap|watsapp|wa\.me|telegram|t\.me|viber|call me|text me|my number|my phone|contact me|outside (the )?app|outside teraa|off teraa|pay me directly)/;

const EMAIL_PATTERN =
  /[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9-]+\s?(\.|\(dot\)|\[dot\])\s?[a-z]{2,}/;

const LINK_PATTERN =
  /(https?:\/\/|www\.)|\b[a-z0-9-]+\.(com|net|org|gm|me|app|link|co)\b/;

function normalise(text: string): string {
  let t = text.toLowerCase();

  // Our own site is allowed.
  t = t.replace(/getteraa\.com/g, " ");

  // Prices such as "GMD 1500000" are not phone numbers.
  t = t.replace(/(gmd|dalasis?)\s*[0-9][0-9 ]*/g, " ");

  // "seven seven three" -> "773"
  t = t.replace(
    /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (word) => NUMBER_WORDS[word],
  );

  // Remove spaces, dots, dashes and brackets between digits.
  // Commas are kept so "1,500,000" is not treated as a number run.
  t = t.replace(/([0-9])[\s.\-()]+(?=[0-9])/g, "$1");

  return t;
}

export function containsContactInfo(text: string | null | undefined): boolean {
  if (!text) return false;

  const t = normalise(text);

  return (
    /[0-9]{7,}/.test(t) ||
    KEYWORD_PATTERN.test(t) ||
    EMAIL_PATTERN.test(t) ||
    LINK_PATTERN.test(t)
  );
}
