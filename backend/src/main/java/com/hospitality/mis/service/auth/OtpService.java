package com.hospitality.mis.service.auth;

import com.hospitality.mis.common.exception.DomainException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Dịch vụ quản lý mã xác thực OTP dùng cho đăng ký và khôi phục mật khẩu.
 * Sinh mã ngẫu nhiên 6 chữ số, lưu tạm thời hết hạn sau 2 phút, và kiểm tra giới hạn số lần nhập sai.
 */
@Service
public class OtpService {
    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    /** Thời gian hiệu lực của mã OTP: đúng 2 phút */
    public static final Duration OTP_EXPIRY_DURATION = Duration.ofMinutes(2);

    /** Số lần nhập sai tối đa cho phép trước khi hủy mã */
    public static final int MAX_FAILED_ATTEMPTS = 5;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, OtpEntry> otpStorage = new ConcurrentHashMap<>();

    private record OtpEntry(
            String code,
            Instant expiresAt,
            AtomicInteger failedAttempts
    ) {
        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    /**
     * Tạo khóa lưu trữ OTP theo mục đích và địa chỉ email đã chuẩn hóa.
     */
    private String buildKey(String email, OtpPurpose purpose) {
        if (email == null || purpose == null) {
            throw new DomainException("INVALID_OTP_REQUEST", "Email và mục đích OTP không được để trống");
        }
        return purpose.name() + ":" + email.trim().toLowerCase();
    }

    /**
     * Sinh mã OTP 6 chữ số ngẫu nhiên cho email và mục đích chỉ định.
     * Lưu tạm thời trong bộ nhớ với thời gian sống 2 phút.
     */
    public String generateOtp(String email, OtpPurpose purpose) {
        cleanExpiredEntries();
        String key = buildKey(email, purpose);

        // Sinh mã 6 chữ số ngẫu nhiên từ 000000 đến 999999
        int randomNum = secureRandom.nextInt(1_000_000);
        String otpCode = String.format("%06d", randomNum);

        Instant expiresAt = Instant.now().plus(OTP_EXPIRY_DURATION);
        otpStorage.put(key, new OtpEntry(otpCode, expiresAt, new AtomicInteger(0)));

        log.info("Đã tạo mã OTP cho [{}] ({}), hết hạn lúc {}", email, purpose, expiresAt);
        return otpCode;
    }

    /**
     * Xác minh mã OTP do người dùng cung cấp.
     * Kiểm tra thời hạn 2 phút và số lần nhập sai tối đa.
     * Nếu mã đúng, mã sẽ bị hủy ngay lập tức (dùng 1 lần duy nhất).
     */
    public void verifyOtp(String email, String rawOtp, OtpPurpose purpose) {
        cleanExpiredEntries();
        String key = buildKey(email, purpose);
        OtpEntry entry = otpStorage.get(key);

        if (entry == null || entry.isExpired()) {
            otpStorage.remove(key);
            throw new DomainException("OTP_EXPIRED_OR_INVALID", "Mã xác thực không hợp lệ hoặc đã hết hạn (2 phút). Vui lòng yêu cầu mã mới.");
        }

        if (entry.failedAttempts.get() >= MAX_FAILED_ATTEMPTS) {
            otpStorage.remove(key);
            throw new DomainException("OTP_MAX_ATTEMPTS_EXCEEDED", "Bạn đã nhập sai mã xác thực quá số lần quy định. Vui lòng yêu cầu mã mới.");
        }

        String inputCode = rawOtp != null ? rawOtp.trim() : "";
        if (!entry.code.equals(inputCode)) {
            int currentFailed = entry.failedAttempts.incrementAndGet();
            int remaining = MAX_FAILED_ATTEMPTS - currentFailed;
            if (remaining <= 0) {
                otpStorage.remove(key);
                throw new DomainException("OTP_MAX_ATTEMPTS_EXCEEDED", "Bạn đã nhập sai mã xác thực quá số lần quy định. Vui lòng yêu cầu mã mới.");
            }
            throw new DomainException("OTP_INCORRECT", "Mã xác thực không chính xác. Bạn còn " + remaining + " lần thử.");
        }

        // Xác thực thành công: xóa mã khỏi bộ nhớ để chống replay
        otpStorage.remove(key);
        log.info("Xác thực mã OTP thành công cho [{}] ({})", email, purpose);
    }

    /**
     * Dọn dẹp các mã OTP đã hết hạn trong bộ nhớ.
     */
    private void cleanExpiredEntries() {
        Instant now = Instant.now();
        otpStorage.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
    }
}
