package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.VnpayPaymentAttemptRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dto.billing.VnpayPaymentDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.VnpayPaymentAttempt;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import com.hospitality.mis.entity.reservation.CustomerPaymentMethod;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private final ReservationRepository reservations;
    private final VnpayPaymentAttemptRepository attempts;
    private final DepositPaymentFinalizer finalizer;
    private final AuditService audit;
    private final ApplicationEventPublisher events;
    private final String tmnCode;
    private final String hashSecret;
    private final String paymentUrl;
    private final String returnUrl;
    private Clock clock = Clock.system(BUSINESS_ZONE);

    public VnpayPaymentService(ReservationRepository reservations,
                               VnpayPaymentAttemptRepository attempts,
                               DepositPaymentFinalizer finalizer,
                               AuditService audit,
                               ApplicationEventPublisher events,
                               @Value("${hotel.payment.vnpay.tmn-code:}") String tmnCode,
                               @Value("${hotel.payment.vnpay.hash-secret:}") String hashSecret,
                               @Value("${hotel.payment.vnpay.payment-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") String paymentUrl,
                               @Value("${hotel.payment.vnpay.return-url:http://localhost:8080/api/public/payments/vnpay/return}") String returnUrl) {
        this.reservations = reservations;
        this.attempts = attempts;
        this.finalizer = finalizer;
        this.audit = audit;
        this.events = events;
        this.tmnCode = tmnCode == null ? "" : tmnCode.trim();
        this.hashSecret = hashSecret == null ? "" : hashSecret.trim();
        this.paymentUrl = paymentUrl;
        this.returnUrl = returnUrl;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock value) { clock = value; }

    @Transactional
    public VnpayPaymentDtos.CheckoutResponse createCheckout(Long reservationId, String actor, String clientIp) {
        requireConfigured();
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor))
            throw error("CUSTOMER_REQUIRED", "Customer principal required");

        Reservation reservation = reservations.findForUpdate(reservationId)
                .orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy booking"));
        if (reservation.getCustomerAccount() == null
                || !Long.valueOf(actor).equals(reservation.getCustomerAccount().getId()))
            throw error("RESERVATION_NOT_FOUND", "Không tìm thấy booking");
        if (reservation.getCustomerPaymentMethod() != CustomerPaymentMethod.VNPAY)
            throw error("VNPAY_NOT_SELECTED", "Booking không chọn thanh toán qua VNPay");
        boolean initialDeposit = reservation.getStatus() == ReservationStatus.DRAFT
                && reservation.getPendingChangeType() == null;
        boolean extensionDeposit = reservation.getPendingChangeType() != null
                && (reservation.getStatus() == ReservationStatus.CONFIRMED
                    || reservation.getStatus() == ReservationStatus.DEPOSIT_PAID);
        if ((!initialDeposit && !extensionDeposit)
                || reservation.getDepositPaymentStatus() != DepositPaymentStatus.PENDING)
            throw error("RESERVATION_NOT_PAYABLE", "Booking không còn chờ thanh toán cọc");

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime expiresAt = reservation.getDepositPaymentExpiresAt();
        if (expiresAt == null || !expiresAt.isAfter(now))
            throw error("PAYMENT_CODE_EXPIRED", "Thời gian giữ phòng đã hết");

        for (VnpayPaymentAttempt pending : attempts.findByReservationIdAndStatus(reservationId, VnpayPaymentStatus.PENDING)) {
            pending.setStatus(VnpayPaymentStatus.CANCELLED);
        }

        VnpayPaymentAttempt attempt = new VnpayPaymentAttempt();
        attempt.setReservation(reservation);
        attempt.setAmount(extensionDeposit ? reservation.getPendingAdditionalDeposit() : reservation.getDepositAmount());
        attempt.setStatus(VnpayPaymentStatus.PENDING);
        attempt.setCreatedAt(now);
        attempt.setExpiresAt(expiresAt);
        attempt.setMerchantReference(newMerchantReference(reservationId, now));
        attempt = attempts.saveAndFlush(attempt);

        String checkoutUrl = buildCheckoutUrl(attempt, normalizeIp(clientIp));
        audit.record("customer:" + actor, "VNPAY_CHECKOUT_CREATED", "VNPAY_PAYMENT_ATTEMPT",
                String.valueOf(attempt.getId()), null, VnpayPaymentStatus.PENDING.name(), attempt.getMerchantReference());
        return checkoutResponse(attempt, checkoutUrl);
    }

    @Transactional(readOnly = true)
    public VnpayPaymentDtos.StatusResponse latest(Long reservationId, String actor) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor))
            throw error("CUSTOMER_REQUIRED", "Customer principal required");
        Reservation reservation = reservations.findCustomerDetails(reservationId, Long.parseLong(actor))
                .orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy booking"));
        VnpayPaymentAttempt attempt = attempts.findFirstByReservationIdOrderByCreatedAtDescIdDesc(reservation.getId())
                .orElseThrow(() -> error("VNPAY_PAYMENT_NOT_FOUND", "Booking chưa có giao dịch VNPay"));
        VnpayPaymentStatus displayStatus = attempt.getStatus();
        if (displayStatus == VnpayPaymentStatus.PENDING
                && !attempt.getExpiresAt().isAfter(LocalDateTime.now(clock))) displayStatus = VnpayPaymentStatus.EXPIRED;
        return new VnpayPaymentDtos.StatusResponse(attempt.getId(), reservationId,
                attempt.getMerchantReference(), attempt.getAmount(), displayStatus,
                attempt.getExpiresAt(), attempt.getResponseCode());
    }

    @Transactional
    public CallbackOutcome processCallback(Map<String, String> query) {
        if (!isConfigured()) return new CallbackOutcome("99", "System error", null, false, null);
        if (!validSignature(query)) return new CallbackOutcome("97", "Invalid signature", null, false, query.get("vnp_ResponseCode"));
        if (!tmnCode.equals(query.get("vnp_TmnCode")))
            return new CallbackOutcome("97", "Invalid signature", null, false, query.get("vnp_ResponseCode"));

        String merchantReference = trim(query.get("vnp_TxnRef"));
        Optional<VnpayPaymentAttempt> lookup = merchantReference == null
                ? Optional.empty() : attempts.findByMerchantReference(merchantReference);
        if (lookup.isEmpty()) return new CallbackOutcome("01", "Order not found", null, false, query.get("vnp_ResponseCode"));

        Long reservationId = lookup.get().getReservation().getId();
        Reservation reservation = reservations.findForUpdate(reservationId)
                .orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy booking"));
        VnpayPaymentAttempt attempt = attempts.findByMerchantReferenceForUpdate(merchantReference)
                .orElseThrow(() -> error("VNPAY_PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch VNPay"));

        if (!amountMatches(attempt.getAmount(), query.get("vnp_Amount")))
            return new CallbackOutcome("04", "Invalid amount", reservationId, false, query.get("vnp_ResponseCode"));
        if (attempt.getStatus() == VnpayPaymentStatus.SUCCEEDED)
            return new CallbackOutcome("02", "Order already confirmed", reservationId, true, query.get("vnp_ResponseCode"));
        if (reservation.getDepositPaymentStatus() == DepositPaymentStatus.PAID)
            return new CallbackOutcome("02", "Order already confirmed", reservationId, true, query.get("vnp_ResponseCode"));

        attempt.setResponseCode(trim(query.get("vnp_ResponseCode")));
        attempt.setVnpayTransactionNumber(trim(query.get("vnp_TransactionNo")));
        attempt.setBankCode(trim(query.get("vnp_BankCode")));
        attempt.setCardType(trim(query.get("vnp_CardType")));
        boolean paid = "00".equals(query.get("vnp_ResponseCode"))
                && "00".equals(query.get("vnp_TransactionStatus"));

        if (!paid) {
            if (attempt.getStatus() == VnpayPaymentStatus.PENDING) {
                attempt.setStatus(VnpayPaymentStatus.FAILED);
                attempt.setCompletedAt(LocalDateTime.now(clock));
                attempts.save(attempt);
                audit.record("VNPAY", "VNPAY_PAYMENT_FAILED", "VNPAY_PAYMENT_ATTEMPT",
                        String.valueOf(attempt.getId()), "PENDING", "FAILED", attempt.getResponseCode());
            }
            return new CallbackOutcome("00", "Confirm Success", reservationId, false, attempt.getResponseCode());
        }

        LocalDateTime now = LocalDateTime.now(clock);
        if (reservation.getStatus() == ReservationStatus.CANCELLED
                || reservation.getStatus() == ReservationStatus.NO_SHOW
                || reservation.getDepositPaymentExpiresAt() == null
                || !reservation.getDepositPaymentExpiresAt().isAfter(now)) {
            attempt.setStatus(VnpayPaymentStatus.FAILED);
            attempt.setCompletedAt(now);
            attempts.save(attempt);
            return new CallbackOutcome("02", "Order already confirmed", reservationId, false, attempt.getResponseCode());
        }

        String providerTransaction = Optional.ofNullable(trim(query.get("vnp_TransactionNo")))
                .orElse(merchantReference);
        PaymentMethod method = paymentMethod(query.get("vnp_CardType"), query.get("vnp_BankCode"));
        String bankReference = Optional.ofNullable(trim(query.get("vnp_BankTranNo")))
                .orElse(providerTransaction);
        finalizer.complete(reservation, attempt.getAmount(), method, bankReference,
                "VNPAY:" + providerTransaction, "VNPAY");

        attempt.setStatus(VnpayPaymentStatus.SUCCEEDED);
        attempt.setCompletedAt(now);
        attempts.saveAndFlush(attempt);
        for (VnpayPaymentAttempt other : attempts.findByReservationIdAndStatus(
                reservationId, VnpayPaymentStatus.PENDING)) {
            if (!other.getId().equals(attempt.getId())) {
                other.setStatus(VnpayPaymentStatus.CANCELLED);
                other.setCompletedAt(now);
            }
        }
        String email = reservation.getConfirmationEmail() != null
                ? reservation.getConfirmationEmail() : reservation.getGuest().getEmail();
        String roomSummary = reservation.getRooms().stream().map(line -> line.getRoom().getId())
                .sorted().reduce((a, b) -> a + ", " + b).orElse("—");
        events.publishEvent(new BookingDepositPaidEvent(email, reservationId, attempt.getAmount(),
                roomSummary, providerTransaction));
        return new CallbackOutcome("00", "Confirm Success", reservationId, true, attempt.getResponseCode());
    }

    private VnpayPaymentDtos.CheckoutResponse checkoutResponse(VnpayPaymentAttempt attempt, String checkoutUrl) {
        return new VnpayPaymentDtos.CheckoutResponse(attempt.getId(), attempt.getReservation().getId(),
                attempt.getMerchantReference(), attempt.getAmount(), attempt.getStatus(),
                attempt.getExpiresAt(), checkoutUrl);
    }

    private String buildCheckoutUrl(VnpayPaymentAttempt attempt, String clientIp) {
        LocalDateTime created = attempt.getCreatedAt();
        SortedMap<String, String> params = new TreeMap<>();
        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        params.put("vnp_Amount", scaledAmount(attempt.getAmount()));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", attempt.getMerchantReference());
        params.put("vnp_OrderInfo", "Dat coc phong BK-" + attempt.getReservation().getId());
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", "vn");
        params.put("vnp_ReturnUrl", returnUrl);
        params.put("vnp_IpAddr", clientIp);
        params.put("vnp_CreateDate", created.format(VNPAY_TIME));
        params.put("vnp_ExpireDate", attempt.getExpiresAt().format(VNPAY_TIME));
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
