/* Entity này biểu diễn phiếu bảo trì và liên kết phiếu với phòng cần xử lý. */
package com.hospitality.mis.entity.operations;

import com.hospitality.mis.entity.room.Room;
import jakarta.persistence.*;
import java.time.LocalDate;

/**
 * Thực thể JPA biểu diễn một phiếu bảo trì phòng.
 *
 * <p>Tên thuộc tính Java dùng tiếng Anh để lược đồ và các mô-đun khác thống nhất
 * cách gọi. Bản dịch hướng đến người dùng thuộc về tầng trình bày,
 * không phải mô hình miền.</p>
 */
@Entity
@Table(name = "PhieuBaoTri")
public class MaintenanceWorkOrder {
    /** Mã phiếu bảo trì nghiệp vụ. */
    @Id
    @Column(name = "maPhieuBaoTri", length = 10)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "maPhong", nullable = false)
    /** Phòng cần được xử lý bảo trì. */
    private Room room;

    @Column(name = "loaiBaoTri", nullable = false)
    /** Loại công việc bảo trì cần thực hiện. */
    private String maintenanceType;

    @Column(name = "ngayDuKien", nullable = false)
    /** Ngày dự kiến thực hiện công việc. */
    private LocalDate scheduledDate;

    @Column(name = "trangThai", nullable = false)
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.MaintenanceStatusConverter.class)
    /** Trạng thái vòng đời của phiếu, bắt đầu ở CHUA_XU_LY. */
    private MaintenanceStatus status = MaintenanceStatus.CHUA_XU_LY;

    @Column(name = "moTa")
    /** Mô tả chi tiết triệu chứng hoặc yêu cầu xử lý. */
    private String description;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
    public String getMaintenanceType() { return maintenanceType; }
    public void setMaintenanceType(String maintenanceType) { this.maintenanceType = maintenanceType; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
    public MaintenanceStatus getStatus() { return status; }
    public void setStatus(MaintenanceStatus status) { this.status = status; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
