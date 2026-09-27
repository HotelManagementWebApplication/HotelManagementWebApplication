import { describe, expect, it } from "vitest";
import { formatDateTimeVi, formatDateVi, localDateTimeValue, localDateValue, parseApiDate } from "./localDate";

describe("local date input formatting", () => {
  it("keeps the browser's calendar date instead of converting through UTC", () => {
    const earlyMorning = new Date(2026, 8, 23, 2, 5, 7);
    expect(localDateValue(earlyMorning)).toBe("2026-09-23");
    expect(localDateTimeValue(earlyMorning)).toBe("2026-09-23T02:05");
    expect(localDateTimeValue(earlyMorning, true)).toBe("2026-09-23T02:05:07");
  });

  it("parses API calendar dates at local midnight", () => {
    const date = parseApiDate("2026-09-27");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 8, 27, 0]);
    expect(formatDateVi("2026-09-27")).toBe("27/09/2026");
    expect(formatDateTimeVi("2026-09-27T14:05:00")).toBe("14:05, 27/09/2026");
  });
});
