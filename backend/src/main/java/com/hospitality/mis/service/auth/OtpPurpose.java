package com.hospitality.mis.service.auth;

/**
 * Mục đích sử dụng mã xác thực OTP.
 */
public enum OtpPurpose {
    /** Xác thực đăng ký tài khoản khách hàng mới */
    REGISTER,
    /** Xác thực đổi / quên mật khẩu */
    FORGOT_PASSWORD
}
