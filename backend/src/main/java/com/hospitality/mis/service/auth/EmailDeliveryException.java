package com.hospitality.mis.service.auth;

/** Lỗi gửi email OTP để API không báo gửi thành công khi SMTP thất bại. */
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message) {
        super(message);
    }

    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
