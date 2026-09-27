package com.hospitality.mis.entity.billing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Table(name = "BienLai")
/** Biên lai chứng minh một khoản thu cụ thể trên hóa đơn. */
public class Receipt {
    /** ID kỹ thuật của biên lai. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maBienLai")
 private Long id;
    /** Số biên lai nghiệp vụ, duy nhất để tra cứu và in lại. */
    @Column(name = "soBienLai", nullable = false, unique = true, length = 40) private String receiptNumber;
    /** Hóa đơn mà biên lai xác nhận khoản thu. */
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "maHoaDon", nullable = false) private Invoice invoice;
    /** Số tiền thực tế được ghi trên biên lai. */
    @Column(name = "soTien", nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    /** Kênh đã dùng để thu khoản tiền trên biên lai. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentMethodConverter.class) @Column(name = "phuongThuc", nullable = false, length = 30) private PaymentMethod method;
    /** Thời điểm biên lai được phát hành. */
    @Column(name = "thoiDiemPhatHanh", nullable = false) private LocalDateTime issuedAt;
    @Column(name = "nguoiPhatHanh", nullable = false, length = 50) private String issuedBy;
    public Long getId() { return id; }
    public String getReceiptNumber() { return receiptNumber; }
    public void setReceiptNumber(String value) { receiptNumber = value; }
    public Invoice getInvoice() { return invoice; }
    public void setInvoice(Invoice value) { invoice = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod value) { method = value; }
    public LocalDateTime getIssuedAt() { return issuedAt; }
    public void setIssuedAt(LocalDateTime value) { issuedAt = value; }
    public String getIssuedBy() { return issuedBy; }
    public void setIssuedBy(String value) { issuedBy = value; }
}
