package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Công nợ phải trả hoặc phải thu được theo dõi với một đối tác. */
@Entity @Table(name = "CongNoDoiTac")
public class PartnerDebt {
    /** ID công nợ do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maCongNoDoiTac")
 private Long id;
    @Column(name = "tenDoiTac", nullable = false, length = 150) private String partnerName;
    @Column(name = "maThamChieu", nullable = false, unique = true, length = 80) private String referenceCode;
    /** Tổng giá trị công nợ ban đầu. */
    @Column(name = "soTien", nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    /** Số đã tất toán; không vượt quá tổng công nợ theo nghiệp vụ. */
    @Column(name = "soTienDaThanhToan", nullable = false, precision = 14, scale = 2) private BigDecimal settledAmount = BigDecimal.ZERO;
    /** Trạng thái tiến độ tất toán của công nợ. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.DebtStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 30) private DebtStatus status = DebtStatus.OPEN;
    @Column(name = "thoiDiemGhiNhan", nullable = false) private LocalDateTime recordedAt;
    /** Các trạng thái từ mở đến tất toán hoặc hủy. */
    public enum DebtStatus {
        /** Công nợ chưa được tất toán. */
        OPEN,
        /** Đã tất toán một phần. */
        PARTIALLY_SETTLED,
        /** Đã tất toán đầy đủ. */
        SETTLED,
        /** Công nợ bị hủy. */
        VOIDED
    }
    public Long getId() { return id; } public String getPartnerName() { return partnerName; } public void setPartnerName(String v) { partnerName = v; }
    public String getReferenceCode() { return referenceCode; } public void setReferenceCode(String v) { referenceCode = v; }
    public BigDecimal getAmount() { return amount; } public void setAmount(BigDecimal v) { amount = v; }
    public BigDecimal getSettledAmount() { return settledAmount; } public void setSettledAmount(BigDecimal v) { settledAmount = v; }
    public DebtStatus getStatus() { return status; } public void setStatus(DebtStatus v) { status = v; }
    public LocalDateTime getRecordedAt() { return recordedAt; } public void setRecordedAt(LocalDateTime v) { recordedAt = v; }
}
