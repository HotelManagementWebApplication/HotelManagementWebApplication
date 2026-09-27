package com.hospitality.mis.entity.billing;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "LichSuGiaDichVu")
public class ServicePriceHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maLichSuGiaDichVu")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maDichVu", nullable = false) private Service service;
    @Column(name = "gia", nullable = false, precision = 10, scale = 2) private BigDecimal price;
    @Column(name = "nguoiThayDoi", nullable = false, length = 50) private String changedBy;
    @Column(name = "maYeuCauPheDuyet") private Long approvalId;
    @Column(name = "thoiDiemHieuLuc", nullable = false) private LocalDateTime effectiveAt;
    protected ServicePriceHistory() {}
    public ServicePriceHistory(Service service, BigDecimal price, String changedBy, Long approvalId, LocalDateTime effectiveAt) {
        this.service = service; this.price = price; this.changedBy = changedBy; this.approvalId = approvalId; this.effectiveAt = effectiveAt;
    }
    public Long getId() { return id; } public Service getService() { return service; } public BigDecimal getPrice() { return price; }
    public String getChangedBy() { return changedBy; } public Long getApprovalId() { return approvalId; } public LocalDateTime getEffectiveAt() { return effectiveAt; }
}
