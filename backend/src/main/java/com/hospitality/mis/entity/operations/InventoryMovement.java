package com.hospitality.mis.entity.operations;

import com.hospitality.mis.entity.billing.Service;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Dòng biến động tồn kho của một dịch vụ, do một tác nhân ghi nhận. */
@Entity @Table(name = "BienDongKhoDichVu")
public class InventoryMovement {
    /** ID dòng biến động do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maBienDongKhoDichVu")
 private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "maDichVu", nullable = false) private Service service;
    /** Loại biến động: nhập, xuất hoặc điều chỉnh. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.InventoryMovementTypeConverter.class) @Column(name = "loai", nullable = false, length = 20) private MovementType type;
    /** Số lượng thay đổi của lần ghi nhận. */
    @Column(name = "soLuong", nullable = false) private int quantity;
    @Column(name = "maNguoiThucHien", nullable = false, length = 50) private String actorId;
    @Column(name = "thoiDiemPhatSinh", nullable = false) private LocalDateTime occurredAt;
    @Column(name = "lyDo", length = 255) private String reason;
    /** Các nguyên nhân nghiệp vụ làm thay đổi tồn kho. */
    /** Nhập hàng làm tăng tồn kho. */
    public enum MovementType {
        /** Nhập hàng hoặc bổ sung làm tăng tồn. */
        RECEIVE,
        /** Xuất dùng hoặc bán làm giảm tồn. */
        ISSUE,
        /** Điều chỉnh số tồn theo kiểm kê hoặc sửa sai. */
        ADJUST,
        /** Hủy hàng/hao hụt làm giảm tồn. */
        WASTE,
        /** Hoàn trả hàng vào kho làm tăng tồn. */
        RETURN
    }
    public Long getId() { return id; } public Service getService() { return service; } public void setService(Service v) { service = v; }
    public MovementType getType() { return type; } public void setType(MovementType v) { type = v; }
    public int getQuantity() { return quantity; } public void setQuantity(int v) { quantity = v; }
    public String getActorId() { return actorId; } public void setActorId(String v) { actorId = v; }
    public LocalDateTime getOccurredAt() { return occurredAt; } public void setOccurredAt(LocalDateTime v) { occurredAt = v; }
    public String getReason() { return reason; } public void setReason(String v) { reason = v; }
}
