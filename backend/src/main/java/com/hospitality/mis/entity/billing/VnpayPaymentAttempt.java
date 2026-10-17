package com.hospitality.mis.entity.billing;

import com.hospitality.mis.entity.reservation.Reservation;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Một yêu cầu thanh toán VNPay; mỗi lần thanh toán lại tạo một mã tham chiếu mới. */
@Entity
@Table(name = "YeuCauThanhToanVnpay")
@Access(AccessType.FIELD)
public class VnpayPaymentAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maYeuCauThanhToanVnpay")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maPhieuDatPhong", nullable = false)
    private Reservation reservation;

    @Column(name = "maThamChieuMerchant", nullable = false, unique = true, length = 100)
    private String merchantReference;

    @Column(name = "soTien", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.VnpayPaymentStatusConverter.class)
    @Column(name = "trangThai", nullable = false, length = 20)
    private VnpayPaymentStatus status = VnpayPaymentStatus.PENDING;

    @Column(name = "thoiDiemTao", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "thoiDiemHetHan", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "thoiDiemHoanTat")
    private LocalDateTime completedAt;

    @Column(name = "maGiaoDichVnpay", length = 100)
    private String vnpayTransactionNumber;

    @Column(name = "maNganHang", length = 20)
    private String bankCode;

    @Column(name = "loaiThe", length = 20)
    private String cardType;

    @Column(name = "maPhanHoi", length = 10)
    private String responseCode;

    @Version
    @Column(name = "phienBan", nullable = false)
    private long version;

    public Long getId() { return id; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation value) { reservation = value; }
    public String getMerchantReference() { return merchantReference; }
    public void setMerchantReference(String value) { merchantReference = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public VnpayPaymentStatus getStatus() { return status; }
    public void setStatus(VnpayPaymentStatus value) { status = value; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime value) { createdAt = value; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime value) { expiresAt = value; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime value) { completedAt = value; }
    public String getVnpayTransactionNumber() { return vnpayTransactionNumber; }
    public void setVnpayTransactionNumber(String value) { vnpayTransactionNumber = value; }
    public String getBankCode() { return bankCode; }
    public void setBankCode(String value) { bankCode = value; }
    public String getCardType() { return cardType; }
    public void setCardType(String value) { cardType = value; }
    public String getResponseCode() { return responseCode; }
    public void setResponseCode(String value) { responseCode = value; }
    public long getVersion() { return version; }
}
