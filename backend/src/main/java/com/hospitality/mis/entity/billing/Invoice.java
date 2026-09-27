package com.hospitality.mis.entity.billing;

import com.hospitality.mis.entity.reservation.Reservation;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "HoaDon")
@Access(AccessType.FIELD)
/** Hóa đơn tổng hợp tiền phòng, dịch vụ, đặt cọc và các điều chỉnh của đặt phòng. */
public class Invoice {
    /** ID hóa đơn do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maHoaDon", nullable = false) private Long id;
    /** Mỗi đặt phòng chỉ có một hóa đơn; liên kết là bắt buộc. */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maPhieuDatPhong", nullable = false, unique = true) private Reservation reservation;
    /** Thời điểm phát hành hóa đơn. */
    @Column(name = "thoiDiemPhatHanh", nullable = false) private LocalDateTime issuedAt = LocalDateTime.now();
    /** Khoản giảm giá áp dụng cho hóa đơn. */
    @Column(name = "tienGiamGia", precision = 12, scale = 2, nullable = false) private BigDecimal discount = BigDecimal.ZERO;
    /** Tiền đặt cọc đã thu, dùng khi xác định số còn phải thanh toán. */
    @Column(name = "tienDatCocDaTra", precision = 12, scale = 2, nullable = false) private BigDecimal depositPaid = BigDecimal.ZERO;
    /** Kênh thanh toán được chọn cho hóa đơn, có thể chưa có khi chưa thu. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentMethodConverter.class) @Column(name = "phuongThucThanhToan") private PaymentMethod paymentMethod;
    /** Trạng thái thanh toán hiện tại của hóa đơn. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentStatusConverter.class) @Column(name = "trangThai", nullable = false) private PaymentStatus status = PaymentStatus.CHUA_THANH_TOAN;
    /** Tổng tiền phòng; giá trị tiền tệ dùng BigDecimal để tránh sai số nhị phân. */
    @Column(name = "tongTienPhong", precision = 12, scale = 2, nullable = false) private BigDecimal roomTotal = BigDecimal.ZERO;
    /** Tổng tiền dịch vụ đã ghi nhận cho đặt phòng. */
    @Column(name = "tongTienDichVu", precision = 12, scale = 2, nullable = false) private BigDecimal serviceTotal = BigDecimal.ZERO;
    /** Số tiền cuối cùng còn phải thu sau các khoản giảm trừ. */
    @Column(name = "soTienPhaiTra", precision = 12, scale = 2, nullable = false) private BigDecimal amountDue = BigDecimal.ZERO;
    /** Phụ thu phát sinh ngoài giá cơ bản. */
    @Column(name = "tienPhuThu", precision = 12, scale = 2, nullable = false) private BigDecimal surcharge = BigDecimal.ZERO;
    /** Khoản bồi thường được tính vào hóa đơn. */
    @Column(name = "tienBoiThuong", precision = 12, scale = 2, nullable = false) private BigDecimal compensation = BigDecimal.ZERO;
    /** Phí gia hạn thời gian lưu trú. */
    @Column(name = "phiGiaHan", precision = 12, scale = 2, nullable = false) private BigDecimal extensionFee = BigDecimal.ZERO;
    /** Tổng ảnh hưởng của các bút toán điều chỉnh. */
    @Column(name = "tongTienDieuChinh", precision = 12, scale = 2, nullable = false) private BigDecimal adjustmentTotal = BigDecimal.ZERO;
    /** Phiên bản lạc quan, ngăn hai giao dịch đồng thời ghi đè hóa đơn. */
    @Version @Column(name = "phienBan", nullable = false) private long version;
    /** Constructor rỗng để JPA khởi tạo entity. */
    public Invoice() {}
    public Long getId() { return id; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation value) { reservation = value; }
    public LocalDateTime getIssuedAt() { return issuedAt; }
    public void setIssuedAt(LocalDateTime value) { issuedAt = value; }
    public BigDecimal getDiscount() { return discount; }
    public void setDiscount(BigDecimal value) { discount = value; }
    public BigDecimal getDepositPaid() { return depositPaid; }
    public void setDepositPaid(BigDecimal value) { depositPaid = value; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(PaymentMethod value) { paymentMethod = value; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus value) { status = value; }
    public BigDecimal getRoomTotal() { return roomTotal; }
    public void setRoomTotal(BigDecimal value) { roomTotal = value; }
    public BigDecimal getServiceTotal() { return serviceTotal; }
    public void setServiceTotal(BigDecimal value) { serviceTotal = value; }
    public BigDecimal getAmountDue() { return amountDue; }
    public void setAmountDue(BigDecimal value) { amountDue = value; }
    public BigDecimal getSurcharge() { return surcharge; }
    public void setSurcharge(BigDecimal value) { surcharge = value; }
    public BigDecimal getCompensation() { return compensation; }
    public void setCompensation(BigDecimal value) { compensation = value; }
    public BigDecimal getExtensionFee() { return extensionFee; }
    public void setExtensionFee(BigDecimal value) { extensionFee = value; }
    public BigDecimal getAdjustmentTotal() { return adjustmentTotal; }
    public void setAdjustmentTotal(BigDecimal value) { adjustmentTotal = value; }
}
