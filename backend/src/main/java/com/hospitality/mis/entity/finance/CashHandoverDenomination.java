package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;

/** Chi tiết mệnh giá của một biên bản bàn giao két tiền. */
@Entity
@Table(name = "ChiTietTienBanGiao")
public class CashHandoverDenomination {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maChiTietTienBanGiao")
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maBanGiaoTienCa", nullable = false)
    private CashShiftHandover handover;
    @Column(name = "menhGia", nullable = false, precision = 12, scale = 2) private BigDecimal denomination;
    @Column(name = "soLuong", nullable = false) private int quantity;
    public Long getId() { return id; }
    public CashShiftHandover getHandover() { return handover; }
    public void setHandover(CashShiftHandover v) { handover = v; }
    public BigDecimal getDenomination() { return denomination; }
    public void setDenomination(BigDecimal v) { denomination = v; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int v) { quantity = v; }
    @Transient public BigDecimal getAmount() {
        if (denomination == null || quantity <= 0) return BigDecimal.ZERO;
        return denomination.multiply(BigDecimal.valueOf(quantity));
    }
    public void setAmount(BigDecimal ignored) { /* Tổng tiền luôn được suy ra từ mệnh giá và số lượng. */ }
}
