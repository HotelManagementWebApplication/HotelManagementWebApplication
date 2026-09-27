package com.hospitality.mis.entity.room;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Một ảnh gallery cho đúng một loại phòng; mỗi URL là một giá trị nguyên tử. */
@Entity
@Table(name = "HinhAnhLoaiPhong")
@Access(AccessType.FIELD)
public class RoomTypeImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maHinhAnhLoaiPhong")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maLoaiPhong", nullable = false)
    private RoomType roomType;

    @Column(name = "duongDanAnh", nullable = false, length = 2048)
    private String imageUrl;

    @Column(name = "thuTuHienThi", nullable = false)
    private int displayOrder;

    public Long getId() { return id; }
    public RoomType getRoomType() { return roomType; }
    public void setRoomType(RoomType roomType) { this.roomType = roomType; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
}
