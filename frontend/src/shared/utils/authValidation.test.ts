import { describe, it, expect } from "vitest";
import { classifyAccount, formatAuthError } from "./authValidation";
import { ApiError } from "../api/client";

describe("classifyAccount", () => {
  it("classifies valid phone numbers correctly", () => {
    expect(classifyAccount("0901234567")).toEqual({ valid: true, type: "phone" });
    expect(classifyAccount("0900000001")).toEqual({ valid: true, type: "phone" });
    expect(classifyAccount("+84901234567")).toEqual({ valid: true, type: "phone" });
    expect(classifyAccount("84901234567")).toEqual({ valid: true, type: "phone" });
  });

  it("marks invalid phone numbers as invalid", () => {
    expect(classifyAccount("090")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("0123")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("+84")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("12345")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("0000000000")).toEqual({ valid: false, type: "invalid" });
  });

  it("classifies valid emails correctly", () => {
    expect(classifyAccount("frontdesk@hotel.com")).toEqual({ valid: true, type: "email" });
    expect(classifyAccount("admin@hotel.com")).toEqual({ valid: true, type: "email" });
    expect(classifyAccount("user.name@domain.vn")).toEqual({ valid: true, type: "email" });
  });

  it("marks invalid emails as invalid", () => {
    expect(classifyAccount("admin@")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("admin@domain")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("@domain.com")).toEqual({ valid: false, type: "invalid" });
  });

  it("classifies valid employee IDs correctly", () => {
    expect(classifyAccount("FRONTDESK")).toEqual({ valid: true, type: "employee" });
    expect(classifyAccount("MANAGER")).toEqual({ valid: true, type: "employee" });
    expect(classifyAccount("HR")).toEqual({ valid: true, type: "employee" });
    expect(classifyAccount("STAFF")).toEqual({ valid: true, type: "employee" });
    expect(classifyAccount("NV_01")).toEqual({ valid: true, type: "employee" });
  });

  it("marks invalid accounts / usernames as invalid", () => {
    expect(classifyAccount("")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("   ")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("a")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("user name")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("admin#123")).toEqual({ valid: false, type: "invalid" });
    expect(classifyAccount("<script>")).toEqual({ valid: false, type: "invalid" });
  });
});

describe("formatAuthError", () => {
  it("translates INVALID_CREDENTIALS to 'Sai tài khoản hoặc mật khẩu'", () => {
    const apiError = new ApiError(401, { code: "INVALID_CREDENTIALS", message: "INVALID_CREDENTIALS" });
    expect(formatAuthError(apiError)).toBe("Sai tài khoản hoặc mật khẩu");

    const genericError = new Error("INVALID_CREDENTIALS");
    expect(formatAuthError(genericError)).toBe("Sai tài khoản hoặc mật khẩu");
  });

  it("translates validation errors to 'Tài khoản không hợp lệ'", () => {
    const badRequest = new ApiError(400, { code: "PHONE_INVALID", message: "Phone is invalid" });
    expect(formatAuthError(badRequest)).toBe("Tài khoản không hợp lệ");

    const invalidReq = new ApiError(400, { code: "INVALID_REQUEST", message: "Invalid request data" });
    expect(formatAuthError(invalidReq)).toBe("Tài khoản không hợp lệ");
  });

  it("translates account locked / disabled", () => {
    const locked = new ApiError(401, { code: "ACCOUNT_LOCKED", message: "Account locked" });
    expect(formatAuthError(locked)).toBe("Tài khoản đã bị tạm khóa do nhập sai nhiều lần.");

    const disabled = new ApiError(401, { code: "ACCOUNT_DISABLED", message: "Account disabled" });
    expect(formatAuthError(disabled)).toBe("Tài khoản đã bị vô hiệu hóa.");
  });

  it("shows a normal connection message for API_UNAVAILABLE", () => {
    const unavailable = new ApiError(0, { code: "API_UNAVAILABLE", message: "Không thể kết nối API tại the current website." });
    expect(formatAuthError(unavailable)).toBe("Không thể kết nối hệ thống. Vui lòng thử lại sau ít phút.");
  });
});
