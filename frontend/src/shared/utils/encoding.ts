/**
 * CP1252 / ISO-8859-1 byte mapping table for restoring UTF-8 bytes that were
 * accidentally decoded as Windows-1252 / Latin1 (Mojibake).
 */
const CP1252_MAP: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

/**
 * Regex identifying common Vietnamese UTF-8 Mojibake sequences resulting from
 * UTF-8 byte streams being parsed as CP1252 / ISO-8859-1.
 * e.g., "Kiá»ƒm tra Ä‘iá»u hÃ²a khÃ´ng lÃ m láº¡nh"
 */
const VIETNAMESE_MOJIBAKE_REGEX = /(?:á»|áº|Ã¡|Ã|Ã¢|Ã£|Ã¨|Ã©|Ãª|Ã¬|Ã­|Ã²|Ã³|Ã´|Ãµ|Ã¹|Ãº|Ã½|Ä‘|Äƒ|Ä©|Æ¡|Æ°|á»ƒ|á» |á»‹|á»‡|áº¡|áº¿)/;

export function isMojibake(str: unknown): boolean {
  return typeof str === "string" && VIETNAMESE_MOJIBAKE_REGEX.test(str);
}

/**
 * Automatically detects and repairs Vietnamese Mojibake strings.
 * If the string does not have mojibake or fails UTF-8 decoding, it is returned untouched.
 */
export function normalizeVietnameseText(str: string): string;
export function normalizeVietnameseText(str: string | undefined): string | undefined;
export function normalizeVietnameseText(str: string | null): string | null;
export function normalizeVietnameseText(str: string | undefined | null): string | undefined | null {
  if (!str || typeof str !== "string") return str;
  if (!isMojibake(str)) return str;

  try {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 255) {
        bytes.push(code);
      } else if (CP1252_MAP[code] !== undefined) {
        bytes.push(CP1252_MAP[code]);
      } else {
        return str;
      }
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return str;
  }
}

/**
 * Recursively traverses objects and arrays to repair any Mojibake strings.
 */
export function sanitizePayload<T>(data: T): T {
  if (typeof data === "string") {
    return normalizeVietnameseText(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizePayload) as unknown as T;
  }
  if (data !== null && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizePayload(value);
    }
    return result as T;
  }
  return data;
}
