package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ThanhToanCongNoDoiTac")
public class PartnerDebtSettlement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maThanhToanCongNo")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maCongNoDoiTac", nullable = false)
    private PartnerDebt partnerDebt;
    @Column(name = "soTien", nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(name = "nguoiThanhToan", nullable = false, length = 50) private String settledBy;
    @Column(name = "thoiDiemThanhToan", nullable = false) private LocalDateTime settledAt;
    @Column(name = "ghiChu", length = 500) private String note;
    public Long getId() { return id; } public PartnerDebt getPartnerDebt() { return partnerDebt; }
    public BigDecimal getAmount() { return amount; } public String getSettledBy() { return settledBy; }
    public LocalDateTime getSettledAt() { return settledAt; } public String getNote() { return note; }
    public void setPartnerDebt(PartnerDebt v) { partnerDebt = v; } public void setAmount(BigDecimal v) { amount = v; }
    public void setSettledBy(String v) { settledBy = v; } public void setSettledAt(LocalDateTime v) { settledAt = v; }
    public void setNote(String v) { note = v; }
    @PreUpdate @PreRemove void rejectMutation() { throw new IllegalStateException("Debt settlements are append-only"); }
}
