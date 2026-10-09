package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.DepositPaymentDatabase;
import com.hospitality.mis.dto.billing.DepositPaymentWebhookDtos;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.HexFormat;

/** Xác minh callback cọc, ghi ledger một lần và xác nhận booking. */
@Service
public class DepositPaymentWebhookService {
    private final DepositPaymentDatabase database;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final String secret;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public DepositPaymentWebhookService(DepositPaymentDatabase database,
                                        org.springframework.context.ApplicationEventPublisher events,
                                        @Value("${hotel.payment.webhook-secret:}") String secret) {
        this.database = database;
        this.events = events;
        this.secret = secret;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }

    public DepositPaymentWebhookDtos.Response accept(DepositPaymentWebhookDtos.Request request, String signature) {
        if (request == null || request.status()==null || !"SUCCESS".equalsIgnoreCase(request.status().trim()))
            throw error("PAYMENT_NOT_SUCCESS", "Callback cọc không ở trạng thái thành công");
        verifySignature(request, signature);
        String eventId = request.providerEventId().trim();
        var completed=database.finalizeWebhook(request.paymentCode().trim(),request.amount(),request.reference().trim(),
                eventId,LocalDateTime.now(clock));
        if(!completed.replay())events.publishEvent(new BookingDepositPaidEvent(completed.email(),completed.reservationId(),
                request.amount(),completed.rooms(),request.reference().trim()));
        return new DepositPaymentWebhookDtos.Response(completed.accepted(),completed.reservationId(),
                englishReservationStatus(completed.reservationStatus()),"COMPLETED");
    }

    private void verifySignature(DepositPaymentWebhookDtos.Request request, String signature) {
        if (secret == null || secret.isBlank()) throw error("PAYMENT_WEBHOOK_NOT_CONFIGURED", "Payment webhook chưa được cấu hình");
        if (signature == null || signature.isBlank()) throw error("PAYMENT_SIGNATURE_INVALID", "Thiếu chữ ký payment callback");
        String canonical = request.providerEventId().trim() + "|" + request.paymentCode().trim() + "|"
                + request.amount().toPlainString() + "|" + request.status().trim().toUpperCase() + "|" + request.reference().trim();
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), signature.trim().toLowerCase().getBytes(StandardCharsets.US_ASCII)))
                throw error("PAYMENT_SIGNATURE_INVALID", "Chữ ký payment callback không hợp lệ");
        } catch (java.security.GeneralSecurityException exception) {
            throw new DomainException("PAYMENT_SIGNATURE_INVALID", "Không thể xác minh chữ ký payment callback");
        }
    }

    private String englishReservationStatus(String value) {
        return switch(value){case "Bản nháp"->"DRAFT";case "Đã thanh toán cọc"->"DEPOSIT_PAID";
            case "Đã xác nhận"->"CONFIRMED";case "Đã nhận phòng"->"CHECKED_IN";
            case "Đã trả phòng"->"CHECKED_OUT";case "Đã hủy"->"CANCELLED";
            case "Không đến"->"NO_SHOW";default->value;};
    }

    private DomainException error(String code, String message) { return new DomainException(code, message); }
}
