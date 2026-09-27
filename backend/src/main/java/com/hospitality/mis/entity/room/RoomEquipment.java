package com.hospitality.mis.entity.room;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Thiết bị tồn tại trong một phòng và snapshot giá trị phục vụ bồi thường. */
@Entity @Table(name = "ThietBiPhong")
public class RoomEquipment {
    /** ID thiết bị do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maThietBiPhong")
 private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "maPhong", nullable = false) private Room room;
    @Column(name = "ten", nullable = false, length = 100) private String name;
    /** Giá trị gốc dùng làm cơ sở tính thiệt hại. */
    @Column(name = "giaTriBanDau", nullable = false, precision = 14, scale = 2) private BigDecimal originalValue;
    @Column(name = "ngayMua", nullable = false) private LocalDate purchasedOn;
    /** Số lượng thiết bị cùng loại trong phòng. */
    @Column(name = "soLuong", nullable = false) private int quantity;
    /** Cờ còn được sử dụng; false giữ lại lịch sử thay vì xóa vật lý. */
    @Column(name = "dangHoatDong", nullable = false) private boolean active = true;
    public Long getId() { return id; } public Room getRoom() { return room; } public void setRoom(Room v) { room = v; }
    public String getName() { return name; } public void setName(String v) { name = v; }
    public BigDecimal getOriginalValue() { return originalValue; } public void setOriginalValue(BigDecimal v) { originalValue = v; }
    public LocalDate getPurchasedOn() { return purchasedOn; } public void setPurchasedOn(LocalDate v) { purchasedOn = v; }
    public int getQuantity() { return quantity; } public void setQuantity(int v) { quantity = v; }
    public boolean isActive() { return active; } public void setActive(boolean v) { active = v; }
}
