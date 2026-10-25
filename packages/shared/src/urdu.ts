// Arabic-keyboard letters → their Urdu-keyboard equivalents, so both spellings match.
const LETTER_MAP: Record<string, string> = {
  ي: 'ی', // ي → ی
  ك: 'ک', // ك → ک
  ه: 'ہ', // ه → ہ
};

export function normalizeUrdu(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[يكه]/g, (c) => LETTER_MAP[c])
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildSearchText(
  parts: Array<string | null | undefined>,
): string {
  return normalizeUrdu(parts.filter(Boolean).join(' '));
}
