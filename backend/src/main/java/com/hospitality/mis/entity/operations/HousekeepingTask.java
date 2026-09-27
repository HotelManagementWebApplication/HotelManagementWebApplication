package com.hospitality.mis.entity.operations;

import com.hospitality.mis.entity.room.Room;
import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Task dọn phòng có trạng thái, người phụ trách và cờ checklist/blocking rõ ràng. */
@Entity
@Table(name = "NhiemVuBuongPhong")
public class HousekeepingTask {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maNhiemVuBuongPhong")
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhong", nullable = false)
    private Room room;
    @Column(name = "nguoiDuocPhanCong", length = 10) private String assignee;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.HousekeepingTaskStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 30) private HousekeepingTaskStatus status = HousekeepingTaskStatus.NEEDS_CLEANING;
    @Column(name = "daHoanThanhChecklist", nullable = false) private boolean checklistComplete;
    @Column(name = "coSuCoChan", nullable = false) private boolean blockingIncident;
    @Column(name = "ghiChu", length = 500) private String note;
    @Column(name = "nguoiPhanCong", length = 10) private String assignedBy;
    @Column(name = "thoiDiemCapNhat", nullable = false) private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Room getRoom() { return room; }
    public String getAssignee() { return assignee; }
    public HousekeepingTaskStatus getStatus() { return status; }
    public boolean isChecklistComplete() { return checklistComplete; }
    public boolean isBlockingIncident() { return blockingIncident; }
    public String getNote() { return note; }
    public String getAssignedBy() { return assignedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setRoom(Room room) { this.room = room; }
    public void setAssignee(String assignee) { this.assignee = assignee; }
    public void setStatus(HousekeepingTaskStatus status) { this.status = status; }
    public void setChecklistComplete(boolean value) { checklistComplete = value; }
    public void setBlockingIncident(boolean value) { blockingIncident = value; }
    public void setNote(String note) { this.note = note; }
    public void setAssignedBy(String value) { assignedBy = value; }
    public void setUpdatedAt(LocalDateTime value) { updatedAt = value; }
}
