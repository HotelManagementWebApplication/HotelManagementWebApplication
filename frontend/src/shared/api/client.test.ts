import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, type TokenPair, type TokenStore } from "./client";

const token = (access_token = "old", refresh_token = "refresh") => ({ access_token, refresh_token, token_type: "Bearer", expires_in: 900, refresh_expires_in: 86400 });
const store = (initial = token()): TokenStore => {
  let value: TokenPair | null = initial;
  return { get: () => value, set: tokens => { value = tokens; }, clear: () => { value = null; } };
};
const response = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.restoreAllMocks());

describe("ApiClient", () => {
  it("adds bearer, JSON and idempotency headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { ok: true })); vi.stubGlobal("fetch", fetchMock);
    await new ApiClient("https://api.test", store()).request("/reservations", { method: "POST", body: { room_id: "r1" }, idempotencyKey: "key-1" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer old", "Content-Type": "application/json", "Idempotency-Key": "key-1" });
  });

  it("refreshes once for concurrent 401s and retries both requests", async () => {
    let calls = 0; const fetchMock = vi.fn().mockImplementation((url: string) => { calls++; if (url.endsWith("/api/auth/refresh")) return Promise.resolve(response(200, token("new", "new-refresh"))); return Promise.resolve(calls <= 2 ? response(401) : response(200, { ok: true })); }); vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("https://api.test", store());
    await Promise.all([client.request("/a"), client.request("/b")]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/refresh"))).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("logs out remotely and always clears local tokens", async () => {
    const tokenStore = store(); const fetchMock = vi.fn().mockResolvedValue(response(204)); vi.stubGlobal("fetch", fetchMock);
    await new ApiClient("https://api.test", tokenStore).logout();
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/api/auth/logout", expect.objectContaining({ body: JSON.stringify({ refresh_token: "refresh" }) })); expect(tokenStore.get()).toBeNull();
  });

  it("turns browser network failures into an actionable API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(new ApiClient("https://api.mamresort.example").request("/api/public/rooms"))
      .rejects.toMatchObject({ status: 0, code: "API_UNAVAILABLE" });
  });

  it.each([400, 401, 403, 409, 422, 429])("maps HTTP %s to ApiError", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, { code: "status_error", message: "bad" })));
    const promise = new ApiClient("https://api.test", store()).request("/failure", { retryOnUnauthorized: false });
    await expect(promise).rejects.toMatchObject({ status, code: "status_error" });
    try { await promise; } catch (error) { expect(error).toBeInstanceOf(ApiError); }
  });

  it.each([400, 422])("classifies HTTP %s as validation", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, { code: "VALIDATION_ERROR", message: "Invalid request data", details: ["field: invalid"] })));
    await expect(new ApiClient("https://api.test", store()).request("/failure", { retryOnUnauthorized: false })).rejects.toSatisfy((error: unknown) => error instanceof ApiError && error.isValidation);
  });
});
