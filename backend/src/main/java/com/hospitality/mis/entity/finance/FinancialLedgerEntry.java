package com.hospitality.mis.entity.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ButToanTaiChinh")
public class FinancialLedgerEntry {
    public enum Direction { DEBIT, CREDIT }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maButToanTaiChinh")
 private Long id;
    @Column(name = "loaiButToan", nullable = false, length = 40) private String entryType;
    @Column(name = "loaiNguon", nullable = false, length = 40) private String sourceType;
    @Column(name = "maNguon", nullable = false, length = 100) private String sourceId;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.LedgerDirectionConverter.class) @Column(name = "chieuButToan", nullable = false, length = 10) private Direction direction;
    @Column(name = "soTien", nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(name = "maNguoiThucHien", nullable = false, length = 50) private String actorId;
    @Column(name = "thoiDiemPhatSinh", nullable = false) private LocalDateTime occurredAt;
    @Column(name = "ghiChu", length = 500) private String note;
    @Column(name = "daChotSo", nullable = false) private boolean finalized = true;
    public Long getId() { return id; } public String getEntryType() { return entryType; }
    public String getSourceType() { return sourceType; } public String getSourceId() { return sourceId; }
    public Direction getDirection() { return direction; } public BigDecimal getAmount() { return amount; }
    public String getActorId() { return actorId; } public LocalDateTime getOccurredAt() { return occurredAt; }
    public String getNote() { return note; } public boolean isFinalized() { return finalized; }
    public void setEntryType(String v) { entryType = v; } public void setSourceType(String v) { sourceType = v; }
    public void setSourceId(String v) { sourceId = v; } public void setDirection(Direction v) { direction = v; }
    public void setAmount(BigDecimal v) { amount = v; } public void setActorId(String v) { actorId = v; }
    public void setOccurredAt(LocalDateTime v) { occurredAt = v; } public void setNote(String v) { note = v; }
    @PreUpdate @PreRemove void rejectMutation() { throw new IllegalStateException("Finalized ledger entries are append-only"); }
}
