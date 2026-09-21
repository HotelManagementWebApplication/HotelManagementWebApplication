import { describe, it, expect } from "vitest";
import { normalizeVietnameseText, isMojibake, sanitizePayload } from "./encoding";

function toLatin1String(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

describe("encoding utility", () => {
  it("detects and repairs Vietnamese Mojibake from CP1252/Latin1", () => {
    // Row 1 from user screenshot:
    // "Kiá»ƒm tra Ä‘iá» u hÃ²a khÃ´ng lÃ m láº¡nh"
    const originalText1 = "Kiểm tra điều hòa không làm lạnh";
    const mojibake1 = toLatin1String(originalText1);
    expect(isMojibake(mojibake1)).toBe(true);
    expect(normalizeVietnameseText(mojibake1)).toBe(originalText1);

    // Row 2 from user screenshot:
    // "Kiá»ƒm tra thiáº¿t bá»‹ sau vá»‡ sinh"
    const originalText2 = "Kiểm tra thiết bị sau vệ sinh";
    const mojibake2 = toLatin1String(originalText2);
    expect(isMojibake(mojibake2)).toBe(true);
    expect(normalizeVietnameseText(mojibake2)).toBe(originalText2);
  });

  it("leaves valid Vietnamese text untouched", () => {
    const validText = "Phòng 101 – Tiêu chuẩn hai giường, sửa điều hòa";
    expect(isMojibake(validText)).toBe(false);
    expect(normalizeVietnameseText(validText)).toBe(validText);
  });

  it("handles null, undefined, empty, and non-string values safely", () => {
    expect(normalizeVietnameseText("")).toBe("");
    expect(normalizeVietnameseText(undefined)).toBeUndefined();
    expect(normalizeVietnameseText(null)).toBeNull();
  });

  it("recursively sanitizes JSON objects and arrays", () => {
    const mojibake = toLatin1String("Kiểm tra thiết bị");
    const payload = {
      id: 1,
      name: mojibake,
      nested: {
        description: mojibake,
        count: 10,
        tags: [mojibake, "hợp lệ"],
      },
    };

    const sanitized = sanitizePayload(payload);
    expect(sanitized.name).toBe("Kiểm tra thiết bị");
    expect(sanitized.nested.description).toBe("Kiểm tra thiết bị");
    expect(sanitized.nested.tags[0]).toBe("Kiểm tra thiết bị");
    expect(sanitized.nested.tags[1]).toBe("hợp lệ");
    expect(sanitized.nested.count).toBe(10);
  });
});
