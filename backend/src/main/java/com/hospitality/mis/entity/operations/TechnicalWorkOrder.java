package com.hospitality.mis.entity.operations;

import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomEquipment;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "PhieuCongViecKyThuat")
public class TechnicalWorkOrder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maPhieuCongViecKyThuat")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhong", nullable = false) private Room room;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "maThietBiPhong") private RoomEquipment equipment;
    @Column(name = "nguoiDuocPhanCong", length = 10) private String assignee;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.PriorityConverter.class)
    @Column(name = "doUuTien", nullable = false, length = 20) private String priority = "MEDIUM";
    @Column(name = "thoiHanSla") private LocalDateTime slaDueAt;
    @Column(name = "vatTuSuDung", length = 1000) private String materials;
    @Column(name = "ghiChuKetQua", length = 1000) private String resultNote;
    @Column(name = "ghiChuNghiemThu", length = 1000) private String acceptanceNote;
    @Column(name = "nguoiNghiemThu", length = 50) private String acceptedBy;
    @Column(name = "thoiDiemNghiemThu") private LocalDateTime acceptedAt;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.TechnicalWorkOrderStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 30) private TechnicalWorkOrderStatus status = TechnicalWorkOrderStatus.NEW;
    @Column(name = "nguoiTao", nullable = false, length = 10) private String createdBy;
    @Column(name = "thoiDiemTao", nullable = false) private LocalDateTime createdAt = LocalDateTime.now();
    @Column(name = "thoiDiemCapNhat", nullable = false) private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; } public Room getRoom() { return room; } public RoomEquipment getEquipment() { return equipment; }
    public String getAssignee() { return assignee; } public String getPriority() { return priority; } public LocalDateTime getSlaDueAt() { return slaDueAt; }
    public String getMaterials() { return materials; } public String getResultNote() { return resultNote; } public String getAcceptanceNote() { return acceptanceNote; }
    public String getAcceptedBy() { return acceptedBy; } public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public TechnicalWorkOrderStatus getStatus() { return status; } public String getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; } public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setRoom(Room value) { room = value; } public void setEquipment(RoomEquipment value) { equipment = value; }
    public void setAssignee(String value) { assignee = value; } public void setPriority(String value) { priority = value; }
    public void setSlaDueAt(LocalDateTime value) { slaDueAt = value; } public void setMaterials(String value) { materials = value; }
    public void setResultNote(String value) { resultNote = value; } public void setAcceptanceNote(String value) { acceptanceNote = value; }
    public void setAcceptedBy(String value) { acceptedBy = value; } public void setAcceptedAt(LocalDateTime value) { acceptedAt = value; }
    public void setStatus(TechnicalWorkOrderStatus value) { status = value; } public void setCreatedBy(String value) { createdBy = value; }
    public void setCreatedAt(LocalDateTime value) { createdAt = value; }
    public void setUpdatedAt(LocalDateTime value) { updatedAt = value; }
}
