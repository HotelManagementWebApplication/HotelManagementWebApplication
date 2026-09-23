import { describe, expect, it } from "vitest";
import { localDateTimeValue, localDateValue } from "./localDate";

describe("local date input formatting", () => {
  it("keeps the browser's calendar date instead of converting through UTC", () => {
    const earlyMorning = new Date(2026, 8, 23, 2, 5, 7);
    expect(localDateValue(earlyMorning)).toBe("2026-09-23");
    expect(localDateTimeValue(earlyMorning)).toBe("2026-09-23T02:05");
    expect(localDateTimeValue(earlyMorning, true)).toBe("2026-09-23T02:05:07");
  });
});
