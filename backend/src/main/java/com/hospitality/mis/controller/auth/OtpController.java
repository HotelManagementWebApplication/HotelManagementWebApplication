package com.hospitality.mis.controller.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountDatabase;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.service.auth.EmailService;
import com.hospitality.mis.service.auth.OtpPurpose;
import com.hospitality.mis.service.auth.OtpService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller xử lý các yêu cầu gửi mã xác thực OTP qua Gmail.
 */
@RestController
@RequestMapping("/api/auth/otp")
public class OtpController {

    private final OtpService otpService;
    private final EmailService emailService;
    private final CustomerAccountDatabase customerAccounts;

    public OtpController(OtpService otpService, EmailService emailService, CustomerAccountDatabase customerAccounts) {
        this.otpService = otpService;
        this.emailService = emailService;
        this.customerAccounts = customerAccounts;
    }

    /**
     * Gửi mã OTP xác thực đăng ký tài khoản khách hàng mới.
     * Hỗ trợ cả /send-register và /send-registration.
     */
    @PostMapping({"/send-register", "/send-registration"})
    public ResponseEntity<Map<String, String>> sendRegisterOtp(@Valid @RequestBody CustomerAccountDtos.OtpSendRequest request) {
        String email = request.email().trim().toLowerCase();

        // Kiểm tra email đã có tài khoản khách hàng đăng ký trước đó chưa
        if (customerAccounts.email(email).isPresent()) {
            throw new DomainException("EMAIL_ALREADY_IN_USE", "Địa chỉ email này đã được sử dụng cho một tài khoản khác.");
        }

        String otp = otpService.generateOtp(email, OtpPurpose.REGISTER);
        emailService.sendRegisterOtp(email, otp);

        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 2 phút."));
    }

    /**
     * Gửi mã OTP xác thực đổi / quên mật khẩu cho tài khoản khách hàng.
     */
    @PostMapping("/send-forgot-password")
    public ResponseEntity<Map<String, String>> sendForgotPasswordOtp(@Valid @RequestBody CustomerAccountDtos.OtpSendRequest request) {
        String email = request.email().trim().toLowerCase();

        // Kiểm tra email có liên kết với tài khoản khách hàng nào không
        if (!customerAccounts.email(email).isPresent()) {
            throw new DomainException("ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản khách hàng nào liên kết với email này.");
        }

        String otp = otpService.generateOtp(email, OtpPurpose.FORGOT_PASSWORD);
        emailService.sendForgotPasswordOtp(email, otp);

        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 2 phút."));
    }
}
