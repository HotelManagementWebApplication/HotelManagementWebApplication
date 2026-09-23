import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import { customerApi } from "../shared/api/customer";
import { authApi } from "../shared/api/auth";

describe("LoginPage Authentication Error Handling", () => {
  const onBack = vi.fn();
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    onLogin.mockReset();
    onBack.mockReset();
    sessionStorage.clear();
    vi.spyOn(customerApi, "register").mockResolvedValue({ id: 1 });
    vi.spyOn(authApi, "sendRegistrationOtp").mockResolvedValue({ message: "Sent", devOtp: "123456" });
    vi.spyOn(authApi, "sendForgotOtp").mockResolvedValue({ message: "Sent", devOtp: "123456" });
    vi.spyOn(authApi, "resetPasswordWithOtp").mockResolvedValue();
  });

  it("shows required error when fields are empty", async () => {
    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    const submitBtn = screen.getByRole("button", { name: /đăng nhập/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Vui lòng nhập đầy đủ thông tin đăng nhập.")).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows 'Tài khoản không hợp lệ' when username format is invalid", async () => {
    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    const userInput = screen.getByPlaceholderText("Nhập email, số điện thoại hoặc mã NV");
    const passwordInput = screen.getByPlaceholderText("Nhập mật khẩu của bạn");
    const submitBtn = screen.getByRole("button", { name: /đăng nhập/i });

    // 1. Invalid phone number (e.g. 090)
    fireEvent.change(userInput, { target: { value: "090" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Tài khoản không hợp lệ")).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();

    // 2. Invalid email (e.g. admin@)
    fireEvent.change(userInput, { target: { value: "admin@" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Tài khoản không hợp lệ")).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();

    // 3. Invalid characters with spaces
    fireEvent.change(userInput, { target: { value: "user name" } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Tài khoản không hợp lệ")).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows 'Sai tài khoản hoặc mật khẩu' when credentials are incorrect", async () => {
    onLogin.mockResolvedValue("Sai tài khoản hoặc mật khẩu");

    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    const userInput = screen.getByPlaceholderText("Nhập email, số điện thoại hoặc mã NV");
    const passwordInput = screen.getByPlaceholderText("Nhập mật khẩu của bạn");
    const submitBtn = screen.getByRole("button", { name: /đăng nhập/i });

    fireEvent.change(userInput, { target: { value: "0900000001" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("0900000001", "wrongpass");
    expect(await screen.findByText("Sai tài khoản hoặc mật khẩu")).toBeTruthy();
  });

  it("translates thrown INVALID_CREDENTIALS error to 'Sai tài khoản hoặc mật khẩu'", async () => {
    onLogin.mockRejectedValue(new Error("INVALID_CREDENTIALS"));

    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    const userInput = screen.getByPlaceholderText("Nhập email, số điện thoại hoặc mã NV");
    const passwordInput = screen.getByPlaceholderText("Nhập mật khẩu của bạn");
    const submitBtn = screen.getByRole("button", { name: /đăng nhập/i });

    fireEvent.change(userInput, { target: { value: "FRONTDESK" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitBtn);

    expect(onLogin).toHaveBeenCalledWith("FRONTDESK", "wrongpass");
    expect(await screen.findByText("Sai tài khoản hoặc mật khẩu")).toBeTruthy();
  });

  it("completes customer registration with mandatory email and OTP verification", async () => {
    onLogin.mockResolvedValue(null);

    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    // Mở modal đăng ký
    const registerOpenBtn = screen.getByRole("button", { name: /đăng ký thành viên mới/i });
    fireEvent.click(registerOpenBtn);

    expect(screen.getByText("Đăng Ký Thành Viên Đặc Quyền")).toBeTruthy();

    // Điền thông tin bước 1
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Nguyễn Văn A"), { target: { value: "Nguyễn Văn A" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: khachhang@gmail.com"), { target: { value: "khachhang@gmail.com" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 0912345678"), { target: { value: "0912345678" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 048090001234"), { target: { value: "048090001234" } });
    fireEvent.change(screen.getByPlaceholderText("Tối thiểu 8 ký tự"), { target: { value: "password123" } });

    // Nhấn tiếp tục nhận OTP
    const nextBtn = screen.getByRole("button", { name: /tiếp tục & nhận mã otp/i });
    fireEvent.click(nextBtn);

    // Kiểm tra đã sang bước 2 OTP
    expect(await screen.findByText("Xác Thực Mã OTP")).toBeTruthy();
    expect(screen.getByText("khachhang@gmail.com")).toBeTruthy();

    // Điền mã OTP
    const otpInput = screen.getByPlaceholderText("••••••");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    // Xác nhận đăng ký
    const confirmBtn = screen.getByRole("button", { name: /xác nhận & hoàn tất đăng ký/i });
    fireEvent.click(confirmBtn);

    expect(await screen.findByText("Đăng ký thành công!")).toBeTruthy();
  });

  it("handles forgot password flow via Email OTP", async () => {
    render(<LoginPage onLogin={onLogin} onBack={onBack} />);

    // Mở modal quên mật khẩu
    const forgotBtn = screen.getByRole("button", { name: /quên mật khẩu\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByText("Quên Mật Khẩu")).toBeTruthy();

    // Bước 1: Nhập email
    const emailInput = screen.getByPlaceholderText("Ví dụ: khachhang@gmail.com");
    fireEvent.change(emailInput, { target: { value: "khachhang@gmail.com" } });

    const sendOtpBtn = screen.getByRole("button", { name: /gửi mã otp khôi phục/i });
    fireEvent.click(sendOtpBtn);

    // Bước 2: Thiết lập mật khẩu mới
    expect(await screen.findByText("Thiết Lập Mật Khẩu Mới")).toBeTruthy();

    const otpInput = screen.getByPlaceholderText("••••••");
    const newPwInput = screen.getByPlaceholderText("Tối thiểu 8 ký tự");
    const confirmPwInput = screen.getByPlaceholderText("Xác nhận lại mật khẩu mới");

    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.change(newPwInput, { target: { value: "newsecret123" } });
    fireEvent.change(confirmPwInput, { target: { value: "newsecret123" } });

    const resetBtn = screen.getByRole("button", { name: /xác nhận đổi mật khẩu/i });
    fireEvent.click(resetBtn);

    // Bước 3: Thành công
    expect(await screen.findByText("Đổi Mật Khẩu Thành Công")).toBeTruthy();

    // Click Đăng nhập ngay
    const loginNowBtn = screen.getByRole("button", { name: /đăng nhập ngay/i });
    fireEvent.click(loginNowBtn);

    // Modal đóng và email được điền vào username
    const mainUserInput = screen.getByPlaceholderText("Nhập email, số điện thoại hoặc mã NV") as HTMLInputElement;
    expect(mainUserInput.value).toBe("khachhang@gmail.com");
  });
});
