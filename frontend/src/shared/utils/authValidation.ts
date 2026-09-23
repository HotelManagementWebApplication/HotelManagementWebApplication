import { ApiError } from "../api/client";

export type AccountClassification =
  | { valid: true; type: "phone" | "email" | "employee" }
  | { valid: false; type: "invalid" };

/**
 * Phân loại và kiểm tra tính hợp lệ của tài khoản đăng nhập:
 * - Số điện thoại: Định dạng số điện thoại Việt Nam (10 chữ số bắt đầu bằng 0, hoặc +84/84) hoặc quốc tế hợp lệ.
 * - Email: Định dạng email tiêu chuẩn có chứa '@' và tên miền hợp lệ.
 * - Mã nhân viên / Tên tài khoản: Chữ và số, có thể chứa dấu '.', '_', '-', độ dài 2-30 ký tự, không chứa khoảng trắng hoặc ký tự đặc biệt khác.
 */
export function classifyAccount(identity: string): AccountClassification {
  const trimmed = identity.trim();
  if (!trimmed) {
    return { valid: false, type: "invalid" };
  }

  // 1. Email: chứa '@'
  if (trimmed.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return { valid: true, type: "email" };
    }
    return { valid: false, type: "invalid" };
  }

  // 2. Số điện thoại: bắt đầu bằng '+', '0', '84', hoặc thuần chữ số
  if (trimmed.startsWith("+") || /^\d+$/.test(trimmed)) {
    // SĐT Việt Nam: 10 chữ số bắt đầu bằng 0, hoặc +84 / 84 theo sau bởi 9 chữ số
    // SĐT Quốc tế: + theo sau bởi 9-15 chữ số
    const vnPhoneRegex = /^(0|\+84|84)[1-9]\d{8,9}$/;
    const intlPhoneRegex = /^\+[1-9]\d{8,14}$/;
    if (vnPhoneRegex.test(trimmed) || intlPhoneRegex.test(trimmed)) {
      return { valid: true, type: "phone" };
    }
    return { valid: false, type: "invalid" };
  }

  // 3. Mã nhân viên / Username:
  // Ký tự chữ, số, dấu '.', '_', '-', từ 2 đến 30 ký tự, không chứa khoảng trắng hay ký tự đặc biệt
  const employeeIdRegex = /^[a-zA-Z0-9_.-]{2,30}$/;
  if (employeeIdRegex.test(trimmed)) {
    return { valid: true, type: "employee" };
  }

  return { valid: false, type: "invalid" };
}

/**
 * Chuẩn hóa thông báo lỗi xác thực sang tiếng Việt:
 * - Lỗi sai thông tin đăng nhập (401 / INVALID_CREDENTIALS) -> "Sai tài khoản hoặc mật khẩu"
 * - Lỗi định dạng tài khoản / dữ liệu không hợp lệ (400, 422, PHONE_INVALID, VALIDATION_ERROR) -> "Tài khoản không hợp lệ"
 */
export function formatAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "ACCOUNT_LOCKED") {
      return "Tài khoản đã bị tạm khóa do nhập sai nhiều lần.";
    }
    if (error.code === "ACCOUNT_DISABLED") {
      return "Tài khoản đã bị vô hiệu hóa.";
    }
    if (
      error.code === "PHONE_INVALID" ||
      error.code === "INVALID_REQUEST" ||
      error.code === "VALIDATION_ERROR" ||
      error.status === 400 ||
      error.status === 422
    ) {
      return "Tài khoản không hợp lệ";
    }
    if (
      error.code === "INVALID_CREDENTIALS" ||
      error.message === "INVALID_CREDENTIALS" ||
      error.status === 401
    ) {
      return "Sai tài khoản hoặc mật khẩu";
    }
    if (error.code === "API_UNAVAILABLE") {
      return "Không thể kết nối hệ thống. Vui lòng thử lại sau ít phút.";
    }
    if (error.message && error.message !== "INVALID_CREDENTIALS") return "Đăng nhập không thành công. Vui lòng thử lại.";
  }

  if (error instanceof Error) {
    if (
      error.message === "INVALID_CREDENTIALS" ||
      error.message.includes("INVALID_CREDENTIALS")
    ) {
      return "Sai tài khoản hoặc mật khẩu";
    }
    return "Đăng nhập không thành công. Vui lòng thử lại.";
  }

  return "Sai tài khoản hoặc mật khẩu";
}
