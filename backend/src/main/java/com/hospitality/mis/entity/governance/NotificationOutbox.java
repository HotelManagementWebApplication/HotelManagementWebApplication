package com.hospitality.mis.entity.governance;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "HangDoiThongBao")
public class NotificationOutbox {
    public enum Status { PENDING, DELIVERED, FAILED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maThongBao")
 private Long id;
    @Column(name = "chuDe", nullable = false, length = 100) private String topic;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.EmployeeRoleCodeConverter.class)
    @Column(name = "vaiTroNguoiNhan", nullable = false, length = 30) private String recipientRole;
    @Column(name = "noiDung", nullable = false, columnDefinition = "NVARCHAR(MAX)") private String payload;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.NotificationStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 20) private Status status = Status.PENDING;
    @Column(name = "khoaChongLap", nullable = false, unique = true, length = 150) private String dedupeKey;
    @Column(name = "thoiDiemCoTheGui", nullable = false) private LocalDateTime availableAt;
    @Column(name = "thoiDiemTao", nullable = false) private LocalDateTime createdAt;
    @Column(name = "thoiDiemGui") private LocalDateTime deliveredAt;
    public Long getId() { return id; } public String getTopic() { return topic; } public String getRecipientRole() { return recipientRole; }
    public String getPayload() { return payload; } public Status getStatus() { return status; } public String getDedupeKey() { return dedupeKey; }
    public LocalDateTime getAvailableAt() { return availableAt; } public LocalDateTime getCreatedAt() { return createdAt; } public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setTopic(String v) { topic = v; } public void setRecipientRole(String v) { recipientRole = v; } public void setPayload(String v) { payload = v; }
    public void setStatus(Status v) { status = v; } public void setDedupeKey(String v) { dedupeKey = v; } public void setAvailableAt(LocalDateTime v) { availableAt = v; }
    public void setCreatedAt(LocalDateTime v) { createdAt = v; } public void setDeliveredAt(LocalDateTime v) { deliveredAt = v; }
}
