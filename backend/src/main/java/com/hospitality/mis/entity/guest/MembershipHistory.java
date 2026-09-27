package com.hospitality.mis.entity.guest;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Lịch sử thay đổi hạng thành viên của một khách. */
@Entity @Table(name = "LichSuHangThanhVien")
public class MembershipHistory {
    /** ID bản ghi lịch sử do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maLichSuHangThanhVien")
 private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "maKhachLuuTru", nullable = false) private Guest guest;
    /** Hạng trước khi thay đổi. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.MembershipTierConverter.class) @Column(name = "hangCu", nullable = false, length = 20) private MembershipTier fromTier;
    /** Hạng sau khi thay đổi. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.MembershipTierConverter.class) @Column(name = "hangMoi", nullable = false, length = 20) private MembershipTier toTier;
    @Column(name = "lyDo", nullable = false, length = 255) private String reason;
    @Column(name = "thoiDiemThayDoi", nullable = false) private LocalDateTime changedAt;
    public Long getId() { return id; } public Guest getGuest() { return guest; } public void setGuest(Guest v) { guest = v; }
    public MembershipTier getFromTier() { return fromTier; } public void setFromTier(MembershipTier v) { fromTier = v; }
    public MembershipTier getToTier() { return toTier; } public void setToTier(MembershipTier v) { toTier = v; }
    public String getReason() { return reason; } public void setReason(String v) { reason = v; }
    public LocalDateTime getChangedAt() { return changedAt; } public void setChangedAt(LocalDateTime v) { changedAt = v; }
}
