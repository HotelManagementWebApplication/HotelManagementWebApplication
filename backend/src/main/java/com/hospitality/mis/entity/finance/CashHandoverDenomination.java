package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;

/** Chi tiết mệnh giá của một biên bản bàn giao két tiền. */
@Entity
@Table(name = "cash_handover_denominations")
public class CashHandoverDenomination {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "handover_id", nullable = false)
    private CashShiftHandover handover;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal denomination;
    @Column(nullable = false) private int quantity;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    public Long getId() { return id; }
    public CashShiftHandover getHandover() { return handover; }
    public void setHandover(CashShiftHandover v) { handover = v; }
    public BigDecimal getDenomination() { return denomination; }
    public void setDenomination(BigDecimal v) { denomination = v; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int v) { quantity = v; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal v) { amount = v; }
}
