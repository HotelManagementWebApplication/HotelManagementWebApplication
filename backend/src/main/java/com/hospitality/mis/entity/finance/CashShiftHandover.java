package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Biên bản bàn giao quỹ giữa hai ca và số chênh lệch cần giải trình. */
@Entity @Table(name = "cash_shift_handovers")
public class CashShiftHandover {
    /** ID biên bản do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "shift_code", nullable = false, length = 30) private String shiftCode;
    @Column(name = "from_actor", nullable = false, length = 50) private String fromActor;
    @Column(name = "to_actor", nullable = false, length = 50) private String toActor;
    /** Số tiền hệ thống kỳ vọng khi kết thúc ca. */
    @Column(name = "expected_amount", nullable = false, precision = 14, scale = 2) private BigDecimal expectedAmount;
    /** Số tiền thực tế được đếm và bàn giao. */
    @Column(name = "actual_amount", nullable = false, precision = 14, scale = 2) private BigDecimal actualAmount;
    /** Chênh lệch giữa thực tế và kỳ vọng, cần khớp với biên bản. */
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal variance;
    @Column(name = "handed_over_at", nullable = false) private LocalDateTime handedOverAt;
    @Column(length = 500) private String note;
    @OneToMany(mappedBy = "handover", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<CashHandoverDenomination> denominations = new ArrayList<>();
    public Long getId() { return id; }
    public String getShiftCode() { return shiftCode; } public void setShiftCode(String v) { shiftCode = v; }
    public String getFromActor() { return fromActor; } public void setFromActor(String v) { fromActor = v; }
    public String getToActor() { return toActor; } public void setToActor(String v) { toActor = v; }
    public BigDecimal getExpectedAmount() { return expectedAmount; } public void setExpectedAmount(BigDecimal v) { expectedAmount = v; }
    public BigDecimal getActualAmount() { return actualAmount; } public void setActualAmount(BigDecimal v) { actualAmount = v; }
    public BigDecimal getVariance() { return variance; } public void setVariance(BigDecimal v) { variance = v; }
    public LocalDateTime getHandedOverAt() { return handedOverAt; } public void setHandedOverAt(LocalDateTime v) { handedOverAt = v; }
    public String getNote() { return note; } public void setNote(String v) { note = v; }
    public List<CashHandoverDenomination> getDenominations() { return denominations; }
    public void addDenomination(CashHandoverDenomination v) { v.setHandover(this); denominations.add(v); }
}
