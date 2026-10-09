import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { authApi } from "./auth";

afterEach(() => vi.restoreAllMocks());

describe("backend auth contract", () => {
  it("uses exact employee and customer login paths and bodies", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 900, refresh_expires_in: 86400 });
    await authApi.employeeLogin({ employee_id: "E1", password: "secret" });
    await authApi.customerLogin({ phone: "0900000000", password: "secret" });
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/login", { method: "POST", body: { employee_id: "E1", password: "secret" }, skipAuth: true });
    expect(request).toHaveBeenNthCalledWith(2, "/api/auth/customers/login", { method: "POST", body: { phone: "0900000000", password: "secret" }, skipAuth: true });
  });

  it("fetches customer profile separately and does not treat token response as profile", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ account: { id: 1 }, guest: { id: 2 } });
    const profile = await authApi.customerProfile();
    expect(profile).toEqual({ account: { id: 1 }, guest: { id: 2 } });
    expect(request).toHaveBeenCalledWith("/api/auth/customers/me");
  });

  it("fetches the employee profile from the exact backend endpoint with canonical response shape", async () => {
    const response = { employee_id: "E1", full_name: "Manager", role: "MANAGER" as const, permissions: ["AUDIT_READ"] };
    const request = vi.spyOn(apiClient, "request").mockResolvedValue(response);
    await expect(authApi.employeeProfile()).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith("/api/auth/me");
  });

  it("allows SMTP-backed OTP requests enough time for Gmail delivery", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({ message: "Sent" });
    await authApi.sendRegistrationOtp("guest@example.test");
    await authApi.sendForgotOtp("guest@example.test");
    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/otp/send-register", {
      method: "POST", body: { email: "guest@example.test" }, skipAuth: true, timeoutMs: 45000,
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/auth/otp/send-forgot-password", {
      method: "POST", body: { email: "guest@example.test" }, skipAuth: true, timeoutMs: 45000,
    });
  });
});
