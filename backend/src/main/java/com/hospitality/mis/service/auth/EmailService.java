package com.hospitality.mis.service.auth;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.math.BigDecimal;

/**
 * Dịch vụ gửi email thông báo và mã OTP qua Gmail SMTP.
 * Gửi thất bại thì trả lỗi cho caller, không báo thành công giả hoặc ghi OTP ra log.
 */
@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Gửi email mã xác thực đăng ký tài khoản mới.
     */
    public void sendRegisterOtp(String toEmail, String otp) {
        String subject = "MaM Hotel - Mã xác thực đăng ký tài khoản";
        String htmlContent = buildEmailTemplate(
                "Xác thực đăng ký tài khoản",
                "Cảm ơn quý khách đã chọn MaM Hotel. Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc đăng ký tài khoản:",
                otp
        );
        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    /**
     * Gửi email mã xác thực đặt lại mật khẩu.
     */
    public void sendForgotPasswordOtp(String toEmail, String otp) {
        String subject = "MaM Hotel - Mã xác thực đặt lại mật khẩu";
        String htmlContent = buildEmailTemplate(
                "Yêu cầu đặt lại mật khẩu",
                "Chúng tôi nhận được yêu cầu đặt lại mật khẩu từ quý khách. Vui lòng sử dụng mã OTP dưới đây để tiếp tục:",
                otp
        );
        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    /** Gửi xác nhận sau khi cổng thanh toán đã ghi nhận tiền cọc. */
    public void sendBookingDepositConfirmation(String toEmail, Long reservationId, BigDecimal amount,
                                               String roomSummary, String paymentReference) {
        String formattedAmount = amount == null ? "0 ₫"
                : String.format(java.util.Locale.forLanguageTag("vi-VN"), "%,.0f ₫", amount);
        String html = """
            <!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f6f3ed;padding:24px;color:#292524">
              <div style="max-width:560px;margin:auto;background:white;border:1px solid #e7e0d3;border-radius:16px;padding:28px">
                <div style="font-size:22px;font-weight:700">MaM Hotel</div>
                <p style="color:#8c6d37;font-weight:700">Thanh toán tiền cọc thành công</p>
                <p>Booking <strong>BK-%s</strong> đã được xác nhận giữ phòng.</p>
                <p>Phòng: <strong>%s</strong><br>Số tiền cọc: <strong>%s</strong><br>Mã giao dịch: <strong>%s</strong></p>
                <p style="font-size:13px;color:#78716c">Khoản cọc này sẽ được trừ khỏi tổng hóa đơn khi trả phòng.</p>
              </div>
            </body></html>
            """.formatted(reservationId, roomSummary, formattedAmount, paymentReference);
        sendHtmlEmail(toEmail, "MaM Hotel - Xác nhận thanh toán cọc BK-" + reservationId, html);
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        if (mailSender == null || isBlank(mailUsername) || isBlank(mailPassword)) {
            throw new EmailDeliveryException("Email OTP chưa được cấu hình SMTP.");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailUsername.trim(), "MaM Hotel");
            helper.setTo(toEmail.trim());
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Đã gửi email OTP thành công đến: {}", toEmail);
        } catch (MessagingException | UnsupportedEncodingException | MailException ex) {
            log.error("Không thể gửi email OTP qua SMTP tới {} ({}).", toEmail, ex.getClass().getSimpleName());
            throw new EmailDeliveryException("Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.", ex);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String buildEmailTemplate(String title, String description, String otp) {
        return """
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 24px; }
                    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
                    .header { text-align: center; border-bottom: 1px solid #eef2f6; padding-bottom: 20px; }
                    .brand { font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.5px; }
                    .badge { display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #3730a3; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 8px; }
                    .content { padding: 24px 0; color: #334155; line-height: 1.6; }
                    .otp-box { text-align: center; margin: 24px 0; padding: 18px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; }
                    .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; }
                    .warning { font-size: 13px; color: #64748b; text-align: center; margin-top: 12px; }
                    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #eef2f6; padding-top: 20px; margin-top: 24px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="brand">🏝️ MaM Hotel</div>
                        <div class="badge">%s</div>
                    </div>
                    <div class="content">
                        <p>%s</p>
                        <div class="otp-box">
                            <div class="otp-code">%s</div>
                            <div class="warning">⏱️ Mã có hiệu lực trong vòng <strong>2 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</div>
                        </div>
                        <p>Nếu quý khách không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ của MaM Hotel.</p>
                    </div>
                    <div class="footer">
                        &copy; MaM Hotel & Spa. Mọi quyền được bảo lưu.<br>
                        Hệ thống tự động, vui lòng không trả lời thư này.
                    </div>
                </div>
            </body>
            </html>
            """.formatted(title, description, otp);
    }
}
