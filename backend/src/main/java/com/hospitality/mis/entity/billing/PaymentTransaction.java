package com.hospitality.mis.entity.billing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "GiaoDichThanhToan")
/** Dòng giao dịch thanh toán/hoàn tiền bất biến trong sổ cái hóa đơn. */
public class PaymentTransaction {
    /** ID giao dịch do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maGiaoDichThanhToan")
 private Long id;
    /** Hóa đơn mà giao dịch tác động đến. */
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "maHoaDon", nullable = false) private Invoice invoice;
    /** Số tiền của lần thu hoặc hoàn tiền. */
    @Column(name = "soTien", nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentMethodConverter.class) @Column(name = "phuongThuc", nullable = false, length = 30) private PaymentMethod method;
    /** Phân biệt thu tiền và hoàn tiền để tính số dư đúng chiều. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.TransactionTypeConverter.class) @Column(name = "loai", nullable = false, length = 20) private TransactionType type;
    /** Kết quả xử lý của giao dịch; chỉ giao dịch hoàn tất mới được quyết toán. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.TransactionStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 20) private TransactionStatus status = TransactionStatus.COMPLETED;
    /** Mã tham chiếu từ cổng thanh toán hoặc giao dịch hoàn tiền gốc. */
    @Column(name = "maThamChieu", length = 100) private String reference;
    /** Thời điểm giao dịch phát sinh theo nghiệp vụ. */
    @Column(name = "thoiDiemPhatSinh", nullable = false) private LocalDateTime occurredAt;
    /** Tác nhân tạo giao dịch, dùng cho audit/đối soát. */
    @Column(name = "maNguoiThucHien", nullable = false, length = 50) private String actorId;
    /** Khóa duy nhất của yêu cầu thu/hoàn, dùng để chống xử lý lặp. */
    @Column(name = "khoaChongTrung", length = 100) private String idempotencyKey;
    /** Mã sự kiện từ payment provider, dùng để nhận callback lặp an toàn. */
    @Column(name = "maSuKienBenNgoai", length = 100) private String externalEventId;
    /** Loại bút toán: thu tiền hoặc hoàn tiền. */
    public enum TransactionType {
        /** Khoản tiền thu vào hóa đơn. */
        PAYMENT,
        /** Khoản tiền hoàn lại cho khách. */
        REFUND
    }
    /** Trạng thái xử lý của bút toán thanh toán. */
    public enum TransactionStatus {
        /** Giao dịch đã hoàn tất và có hiệu lực. */
        COMPLETED,
        /** Giao dịch thất bại, không làm thay đổi số đã thu. */
        FAILED,
        /** Giao dịch đã bị vô hiệu hóa theo quy trình đối soát. */
        VOIDED
    }
    public Long getId() { return id; }
    public Invoice getInvoice() { return invoice; }
    public void setInvoice(Invoice value) { invoice = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod value) { method = value; }
    public TransactionType getType() { return type; }
    public void setType(TransactionType value) { type = value; }
    public TransactionStatus getStatus() { return status; }
    public void setStatus(TransactionStatus value) { status = value; }
    public String getReference() { return reference; }
    public void setReference(String value) { reference = value; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime value) { occurredAt = value; }
    public String getActorId() { return actorId; }
    public void setActorId(String value) { actorId = value; }
    public void setIdempotencyKey(String value) { idempotencyKey = value; }
    public String getExternalEventId() { return externalEventId; }
    public void setExternalEventId(String value) { externalEventId = value; }

    /** Chuẩn hóa khóa phía máy khách và gắn dấu vân tay đầu vào để chống tái sử dụng sai ngữ cảnh. */
    public static String storageIdempotencyKey(String key, String actor, BigDecimal amount,
                                               PaymentMethod method, TransactionType type, String reference) {
        if (key == null || key.isBlank()) return null;
        String canonical = key.trim() + "|" + actor + "|" + amount.toPlainString() + "|"
                + method.name() + "|" + type.name() + "|" + (reference == null ? "" : reference);
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            String stored = key.trim() + "." + hex;
            if (stored.length() > 100) throw new IllegalArgumentException("idempotency key is too long");
            return stored;
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    /** Trả về khóa máy khách, còn mã băm liên kết vẫn được giữ trong giá trị lưu trữ. */
    public String getIdempotencyKey() {
        if (idempotencyKey == null) return null;
        int separator = idempotencyKey.lastIndexOf('.');
        return separator > 0 && idempotencyKey.length() - separator - 1 == 64
                ? idempotencyKey.substring(0, separator) : idempotencyKey;
    }

    public String getStoredIdempotencyKey() { return idempotencyKey; }

    /** Trích ID giao dịch gốc từ reference của một giao dịch hoàn tiền. */
    public String getSourceTransactionId() {
        if (reference == null || !reference.startsWith("REFUND_OF:")) return null;
        int end = reference.indexOf(':', "REFUND_OF:".length());
        return end < 0 ? reference.substring("REFUND_OF:".length())
                : reference.substring("REFUND_OF:".length(), end);
    }

    /** Các dòng sổ cái chỉ được ghi thêm; điều chỉnh phải tạo dòng hoàn tiền mới. */
    @PreUpdate
    void rejectUpdate() {
        throw new IllegalStateException("Payment transactions are immutable");
    }

    @PreRemove
    void rejectDelete() {
        throw new IllegalStateException("Payment transactions are immutable");
    }
}
