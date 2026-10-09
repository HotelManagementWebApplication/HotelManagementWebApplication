package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.DepositPaymentDatabase;
import com.hospitality.mis.dto.billing.VnpayPaymentDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Adapter cổng VNPay 2.1.0: tạo URL, kiểm checksum và xử lý Return/IPN idempotent. */
@Service
public class VnpayPaymentService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VNPAY_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final DepositPaymentDatabase database;
    private final ApplicationEventPublisher events;
    private final String tmnCode;
    private final String hashSecret;
    private final String paymentUrl;
    private final String returnUrl;
    private Clock clock = Clock.system(BUSINESS_ZONE);

    public VnpayPaymentService(DepositPaymentDatabase database,
                               ApplicationEventPublisher events,
                               @Value("${hotel.payment.vnpay.tmn-code:}") String tmnCode,
                               @Value("${hotel.payment.vnpay.hash-secret:}") String hashSecret,
                               @Value("${hotel.payment.vnpay.payment-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") String paymentUrl,
                               @Value("${hotel.payment.vnpay.return-url:http://localhost:8080/api/public/payments/vnpay/return}") String returnUrl) {
        this.database = database;
        this.events = events;
        this.tmnCode = tmnCode == null ? "" : tmnCode.trim();
        this.hashSecret = hashSecret == null ? "" : hashSecret.trim();
        this.paymentUrl = paymentUrl;
        this.returnUrl = returnUrl;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock value) { clock = value; }

    public VnpayPaymentDtos.CheckoutResponse createCheckout(Long reservationId, String actor, String clientIp) {
        requireConfigured();
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor))
            throw error("CUSTOMER_REQUIRED", "Customer principal required");

        LocalDateTime now = LocalDateTime.now(clock);
        var attempt = database.create(reservationId, Long.parseLong(actor), newMerchantReference(reservationId, now),
                "customer:" + actor, now);
        String checkoutUrl = buildCheckoutUrl(attempt, normalizeIp(clientIp));
        return checkoutResponse(attempt, checkoutUrl);
    }

    public VnpayPaymentDtos.StatusResponse latest(Long reservationId, String actor) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor))
            throw error("CUSTOMER_REQUIRED", "Customer principal required");
        var attempt = database.latest(reservationId, Long.parseLong(actor), LocalDateTime.now(clock));
        return new VnpayPaymentDtos.StatusResponse(attempt.id(), reservationId,
                attempt.merchantReference(), attempt.amount(), attempt.status(),
                attempt.expiresAt(), attempt.responseCode());
    }

    public CallbackOutcome processCallback(Map<String, String> query) {
        if (!isConfigured()) return new CallbackOutcome("99", "System error", null, false, null);
        if (!validSignature(query)) return new CallbackOutcome("97", "Invalid signature", null, false, query.get("vnp_ResponseCode"));
        if (!tmnCode.equals(query.get("vnp_TmnCode")))
            return new CallbackOutcome("97", "Invalid signature", null, false, query.get("vnp_ResponseCode"));

        String merchantReference = trim(query.get("vnp_TxnRef"));
        DepositPaymentDatabase.Attempt attempt;
        try { attempt=database.find(merchantReference); }
        catch (DomainException missing) { return new CallbackOutcome("01", "Order not found", null, false, query.get("vnp_ResponseCode")); }
        Long reservationId = attempt.reservationId();
        if (!amountMatches(attempt.amount(), query.get("vnp_Amount")))
            return new CallbackOutcome("04", "Invalid amount", reservationId, false, query.get("vnp_ResponseCode"));
        if (attempt.status() == VnpayPaymentStatus.SUCCEEDED)
            return new CallbackOutcome("02", "Order already confirmed", reservationId, true, query.get("vnp_ResponseCode"));
        boolean paid = "00".equals(query.get("vnp_ResponseCode"))
                && "00".equals(query.get("vnp_TransactionStatus"));

        if (!paid) {
            var failed=database.fail(merchantReference,trim(query.get("vnp_ResponseCode")),trim(query.get("vnp_TransactionNo")),
                    trim(query.get("vnp_BankCode")),trim(query.get("vnp_CardType")),LocalDateTime.now(clock));
            return new CallbackOutcome("00", "Confirm Success", reservationId, false, failed.responseCode());
        }

        LocalDateTime now = LocalDateTime.now(clock);
        String providerTransaction = Optional.ofNullable(trim(query.get("vnp_TransactionNo")))
                .orElse(merchantReference);
        PaymentMethod method = paymentMethod(query.get("vnp_CardType"), query.get("vnp_BankCode"));
        String bankReference = Optional.ofNullable(trim(query.get("vnp_BankTranNo")))
                .orElse(providerTransaction);
        DepositPaymentDatabase.Completion completed;
        try {
            completed=database.finalizeVnpay(merchantReference,attempt.amount(),trim(query.get("vnp_ResponseCode")),
                    providerTransaction,trim(query.get("vnp_BankCode")),trim(query.get("vnp_CardType")),bankReference,
                    "VNPAY:" + providerTransaction,method,now);
        } catch (DomainException invalid) {
            if (Set.of("RESERVATION_NOT_PAYABLE","PAYMENT_CODE_EXPIRED","DEPOSIT_ALREADY_PAID").contains(invalid.getCode()))
                return new CallbackOutcome("02", "Order already confirmed", reservationId, false, query.get("vnp_ResponseCode"));
            throw invalid;
        }
        if(!completed.replay())events.publishEvent(new BookingDepositPaidEvent(completed.email(), reservationId, attempt.amount(),
                completed.rooms()==null?"—":completed.rooms(), providerTransaction));
        return new CallbackOutcome(completed.replay()?"02":"00", completed.replay()?"Order already confirmed":"Confirm Success",
                reservationId, true, query.get("vnp_ResponseCode"));
    }

    private VnpayPaymentDtos.CheckoutResponse checkoutResponse(DepositPaymentDatabase.Attempt attempt, String checkoutUrl) {
        return new VnpayPaymentDtos.CheckoutResponse(attempt.id(), attempt.reservationId(),
                attempt.merchantReference(), attempt.amount(), attempt.status(),
                attempt.expiresAt(), checkoutUrl);
    }

    private String buildCheckoutUrl(DepositPaymentDatabase.Attempt attempt, String clientIp) {
        LocalDateTime created = attempt.createdAt();
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        params.put("vnp_Amount", scaledAmount(attempt.amount()));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", attempt.merchantReference());
        params.put("vnp_OrderInfo", "Dat coc phong BK-" + attempt.reservationId());
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", "vn");
        params.put("vnp_ReturnUrl", returnUrl);
        params.put("vnp_IpAddr", clientIp);
        params.put("vnp_CreateDate", created.format(VNPAY_TIME));
        params.put("vnp_ExpireDate", attempt.expiresAt().format(VNPAY_TIME));
        String query = canonicalQuery(params);
        return paymentUrl + "?" + query + "&vnp_SecureHash=" + hmacSha512(query);
    }

    private boolean validSignature(Map<String, String> query) {
        String supplied = trim(query.get("vnp_SecureHash"));
        if (supplied == null) return false;
        SortedMap<String, String> signed = new TreeMap<>();
        query.forEach((key, value) -> {
            if (key != null && key.startsWith("vnp_") && !"vnp_SecureHash".equals(key)
                    && !"vnp_SecureHashType".equals(key) && value != null && !value.isEmpty()) signed.put(key, value);
        });
        String expected = hmacSha512(canonicalQuery(signed));
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                supplied.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }

    private String canonicalQuery(SortedMap<String, String> values) {
        return values.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right).orElse("");
    }

    private String hmacSha512(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(hashSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Không thể ký dữ liệu VNPay", exception);
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String scaledAmount(BigDecimal amount) {
        return amount.movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).toPlainString();
    }

    private boolean amountMatches(BigDecimal expected, String returned) {
        try {
            return scaledAmount(expected).equals(new BigDecimal(returned).setScale(0, RoundingMode.UNNECESSARY).toPlainString());
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private PaymentMethod paymentMethod(String cardType, String bankCode) {
        String card = Optional.ofNullable(cardType).orElse("").toUpperCase(Locale.ROOT);
        String bank = Optional.ofNullable(bankCode).orElse("").toUpperCase(Locale.ROOT);
        if (card.contains("CREDIT") || card.contains("INTERNATIONAL")
                || Set.of("VISA", "MASTERCARD", "JCB", "UPI", "AMEX").contains(bank)) return PaymentMethod.CARD;
        return PaymentMethod.BANK_TRANSFER;
    }

    private String newMerchantReference(Long reservationId, LocalDateTime now) {
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "MH" + reservationId + now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + random;
    }

    private String normalizeIp(String value) {
        String ip = trim(value);
        return ip == null || ip.length() > 45 ? "127.0.0.1" : ip;
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isConfigured() {
        return !tmnCode.isBlank() && !hashSecret.isBlank() && paymentUrl != null && !paymentUrl.isBlank()
                && returnUrl != null && !returnUrl.isBlank();
    }

    private void requireConfigured() {
        if (!isConfigured())
            throw error("VNPAY_NOT_CONFIGURED", "VNPay Sandbox chưa được cấu hình TmnCode và HashSecret");
    }

    private DomainException error(String code, String message) { return new DomainException(code, message); }

    /** Kết quả xử lý dùng chung cho IPN JSON và trang Return chuyển hướng. */
    public record CallbackOutcome(String responseCode, String message, Long reservationId,
                                  boolean paymentSucceeded, String providerResponseCode) {}
}
