import { vi } from "vitest";

if (typeof window !== "undefined") {
  if (typeof window.alert !== "function") {
    Object.defineProperty(window, "alert", { configurable: true, value: vi.fn() });
  }
  if (typeof window.confirm !== "function") {
    Object.defineProperty(window, "confirm", { configurable: true, value: vi.fn(() => true) });
  }
}
