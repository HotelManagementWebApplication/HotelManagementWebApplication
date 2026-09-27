import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../../shared/api/auth";
import { apiClient } from "../../shared/api/client";
import { useCustomerSession } from "./useCustomerSession";

vi.mock("../../shared/api/auth", () => ({
  authApi: { customerProfile: vi.fn() },
}));

vi.mock("../../shared/api/client", () => ({
  apiClient: {
    store: {
      get: vi.fn(),
      getIdentity: vi.fn(),
      clear: vi.fn(),
    },
  },
}));

describe("useCustomerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.store.get).mockReturnValue(null);
    vi.mocked(apiClient.store.getIdentity!).mockReturnValue(null);
  });

  it("restores a saved customer session after validating its profile", async () => {
    vi.mocked(apiClient.store.get).mockReturnValue({ access_token: "saved-token" } as ReturnType<typeof apiClient.store.get>);
    vi.mocked(apiClient.store.getIdentity!).mockReturnValue("customer");
    vi.mocked(authApi.customerProfile).mockResolvedValue({} as Awaited<ReturnType<typeof authApi.customerProfile>>);

    const { result } = renderHook(() => useCustomerSession());

    await waitFor(() => expect(authApi.customerProfile).toHaveBeenCalledOnce());
    expect(result.current[0]).toBe(true);
  });

  it("clears an invalid saved customer session", async () => {
    vi.mocked(apiClient.store.get).mockReturnValue({ access_token: "expired-token" } as ReturnType<typeof apiClient.store.get>);
    vi.mocked(apiClient.store.getIdentity!).mockReturnValue("customer");
    vi.mocked(authApi.customerProfile).mockRejectedValue(new Error("expired"));

    const { result } = renderHook(() => useCustomerSession());

    await waitFor(() => expect(result.current[0]).toBe(false));
    expect(apiClient.store.clear).toHaveBeenCalledOnce();
  });

  it("does not call the customer profile endpoint when there is no customer token", async () => {
    const { result } = renderHook(() => useCustomerSession());

    await act(async () => {});

    expect(result.current[0]).toBe(false);
    expect(authApi.customerProfile).not.toHaveBeenCalled();
  });
});
