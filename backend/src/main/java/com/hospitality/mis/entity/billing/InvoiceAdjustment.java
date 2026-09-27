package com.hospitality.mis.entity.billing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Bút toán điều chỉnh tăng/giảm, chỉ ghi thêm, cho tổng tiền hóa đơn. */
@Entity
@Table(name = "DieuChinhHoaDon")
public class InvoiceAdjustment {
    /** ID của bút toán bất biến do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maDieuChinhHoaDon")
 private Long id;
    /** Hóa đơn bị điều chỉnh; bút toán không tồn tại độc lập. */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "maHoaDon", nullable = false) private Invoice invoice;
    /** Mức thay đổi: dương để tăng, âm để giảm tổng hóa đơn. */
    @Column(name = "soTienChenhLech", nullable = false, precision = 12, scale = 2) private BigDecimal delta;
    @Column(name = "lyDo", nullable = false, length = 500) private String reason;
    @Column(name = "maNguoiThucHien", nullable = false, length = 50) private String actorId;
    @Column(name = "thoiDiemPhatSinh", nullable = false) private LocalDateTime occurredAt;
    /** Khóa yêu cầu duy nhất, ngăn cùng một điều chỉnh được ghi hai lần. */
    @Column(name = "khoaChongTrung", nullable = false, unique = true, length = 100) private String idempotencyKey;

    public Long getId() { return id; }
    public Invoice getInvoice() { return invoice; }
    public void setInvoice(Invoice value) { invoice = value; }
    public BigDecimal getDelta() { return delta; }
    public void setDelta(BigDecimal value) { delta = value; }
    public String getReason() { return reason; }
    public void setReason(String value) { reason = value; }
    public String getActorId() { return actorId; }
    public void setActorId(String value) { actorId = value; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime value) { occurredAt = value; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String value) { idempotencyKey = value; }

    /** Chặn sửa hoặc xóa để sổ điều chỉnh chỉ ghi thêm và giữ nguyên lịch sử. */
    @PreUpdate @PreRemove
    void rejectMutation() { throw new IllegalStateException("Invoice adjustments are immutable"); }
}
