package com.hospitality.mis.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.auth.OtpPurpose;
import com.hospitality.mis.service.auth.OtpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpServiceTest {

    private OtpService otpService;

    @BeforeEach
    void setUp() {
        otpService = new OtpService();
    }

    @Test
    @DisplayName("Sinh mã OTP 6 chữ số hợp lệ")
    void generateOtp_shouldReturnSixDigitCode() {
        String code = otpService.generateOtp("guest@example.com", OtpPurpose.REGISTER);
        assertThat(code).isNotNull();
        assertThat(code).matches("^\\d{6}$");
    }

    @Test
    @DisplayName("Xác thực OTP thành công với mã đúng và không thể tái sử dụng")
    void verifyOtp_successAndOneTimeUse() {
        String email = "guest@example.com";
        String code = otpService.generateOtp(email, OtpPurpose.REGISTER);

        // Lần 1: Thành công
        otpService.verifyOtp(email, code, OtpPurpose.REGISTER);

        // Lần 2: Đã bị xóa (chống replay) -> Báo lỗi
        assertThatThrownBy(() -> otpService.verifyOtp(email, code, OtpPurpose.REGISTER))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("không hợp lệ hoặc đã hết hạn");
    }

    @Test
    @DisplayName("Báo lỗi khi nhập sai mã và đếm số lần thử còn lại")
    void verifyOtp_wrongCode_decrementsRemainingAttempts() {
        String email = "guest@example.com";
        otpService.generateOtp(email, OtpPurpose.REGISTER);

        // Nhập sai lần 1
        assertThatThrownBy(() -> otpService.verifyOtp(email, "000000", OtpPurpose.REGISTER))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("Mã xác thực không chính xác. Bạn còn 4 lần thử.");

        // Nhập sai lần 2
        assertThatThrownBy(() -> otpService.verifyOtp(email, "111111", OtpPurpose.REGISTER))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("Mã xác thực không chính xác. Bạn còn 3 lần thử.");
    }

    @Test
    @DisplayName("Khóa mã OTP khi nhập sai quá 5 lần quy định")
    void verifyOtp_lockoutAfterMaxFailedAttempts() {
        String email = "guest@example.com";
        otpService.generateOtp(email, OtpPurpose.REGISTER);

        for (int i = 0; i < 4; i++) {
            final int index = i;
            assertThatThrownBy(() -> otpService.verifyOtp(email, "99999" + index, OtpPurpose.REGISTER))
                    .isInstanceOf(DomainException.class);
        }

        // Lần thứ 5 sai -> Hủy mã và báo lỗi quá số lần
        assertThatThrownBy(() -> otpService.verifyOtp(email, "999999", OtpPurpose.REGISTER))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("quá số lần quy định");
    }

    @Test
    @DisplayName("Không dùng lẫn mã của các mục đích khác nhau")
    void verifyOtp_purposeIsolation() {
        String email = "guest@example.com";
        String code = otpService.generateOtp(email, OtpPurpose.REGISTER);

        // Dùng mã REGISTER để verify FORGOT_PASSWORD -> Báo lỗi
        assertThatThrownBy(() -> otpService.verifyOtp(email, code, OtpPurpose.FORGOT_PASSWORD))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("không hợp lệ hoặc đã hết hạn");
    }
}
