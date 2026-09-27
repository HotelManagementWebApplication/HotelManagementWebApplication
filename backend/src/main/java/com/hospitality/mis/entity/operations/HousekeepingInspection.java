package com.hospitality.mis.entity.operations;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Bản ghi kiểm tra minibar hoặc tài sản trong một task dọn phòng. */
@Entity
@Table(name = "KiemTraBuongPhong")
public class HousekeepingInspection {
    public enum InspectionType { MINIBAR, ROOM_ASSET }
    public enum ItemCondition { OK, DAMAGED, MISSING, REFILLED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maKiemTraBuongPhong")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maNhiemVuBuongPhong", nullable = false) private HousekeepingTask task;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.InspectionTypeConverter.class) @Column(name = "loaiKiemTra", nullable = false, length = 20) private InspectionType inspectionType;
    @Column(name = "hangMuc", nullable = false, length = 100) private String item;
    @Column(name = "soLuong", nullable = false) private int quantity;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.ItemConditionConverter.class) @Column(name = "tinhTrangHangMuc", nullable = false, length = 20) private ItemCondition itemCondition;
    @Column(name = "ghiChu", length = 500) private String note;
    @Column(name = "nguoiHoanThanh", nullable = false, length = 10) private String completedBy;
    @Column(name = "thoiDiemHoanThanh", nullable = false) private LocalDateTime completedAt;
    public HousekeepingInspection() {}
    public Long getId() { return id; }
    public HousekeepingTask getTask() { return task; }
    public InspectionType getInspectionType() { return inspectionType; }
    public String getItem() { return item; }
    public int getQuantity() { return quantity; }
    public ItemCondition getItemCondition() { return itemCondition; }
    public String getNote() { return note; }
    public String getCompletedBy() { return completedBy; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setTask(HousekeepingTask value) { task = value; }
    public void setInspectionType(InspectionType value) { inspectionType = value; }
    public void setItem(String value) { item = value; }
    public void setQuantity(int value) { quantity = value; }
    public void setItemCondition(ItemCondition value) { itemCondition = value; }
    public void setNote(String value) { note = value; }
    public void setCompletedBy(String value) { completedBy = value; }
    public void setCompletedAt(LocalDateTime value) { completedAt = value; }
}
