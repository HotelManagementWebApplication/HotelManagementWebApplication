import { describe, expect, it } from "vitest";
import { formatUsd, formatVnd, formatVndNumber } from "./money";

describe("money formatting", () => {
  it("uses one Vietnamese đồng representation", () => {
    expect(formatVnd(100000)).toBe("100.000 ₫");
    expect(formatVndNumber(100000)).toBe("100.000");
  });

  it("does not label US dollars as Vietnamese đồng", () => {
    expect(formatUsd(25.5)).toBe("$25.50");
  });
});
