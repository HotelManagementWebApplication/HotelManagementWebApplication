import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { publicApi } from "./public";

afterEach(() => vi.restoreAllMocks());

describe("public customer read contract", () => {
  it("uses exact anonymous catalog, detail, availability and services paths", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue([]);
    await publicApi.rooms();
    await publicApi.room("R/101");
    await publicApi.availability("2031-01-10T14:00:00", "2031-01-11T12:00:00", "STD");
    await publicApi.services();
    expect(request).toHaveBeenNthCalledWith(1, "/api/public/rooms");
    expect(request).toHaveBeenNthCalledWith(2, "/api/public/rooms/R%2F101");
    expect(request).toHaveBeenNthCalledWith(3, "/api/public/rooms/availability?from=2031-01-10T14%3A00%3A00&to=2031-01-11T12%3A00%3A00&type=STD");
    expect(request).toHaveBeenNthCalledWith(4, "/api/public/services");
  });

  it("rejects a blank room ID before making a request", async () => {
    const request = vi.spyOn(apiClient, "request");
    await expect(publicApi.room("   ")).rejects.toThrow("roomId must be a non-blank public room ID");
    expect(request).not.toHaveBeenCalled();
  });
});
