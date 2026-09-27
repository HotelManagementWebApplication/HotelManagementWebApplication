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

/** Metadata của ảnh phòng; nội dung ảnh nằm trong local storage, không nằm trong DB. */
@Entity
@Table(name = "HinhAnhPhong")
@Access(AccessType.FIELD)
public class RoomImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maHinhAnhPhong")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maPhong", nullable = false)
    private Room room;

    @Column(name = "duongDanTuongDoi", nullable = false, length = 255, unique = true)
    private String relativePath;

    @Column(name = "thuTuHienThi", nullable = false)
    private int displayOrder;

    @Column(name = "laAnhBia", nullable = false)
    private boolean cover;

    @Column(name = "loaiNoiDung", nullable = false, length = 40)
    private String contentType;

    @Column(name = "kichThuocByte", nullable = false)
    private long sizeBytes;

    @Column(name = "dangHoatDong", nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
    public String getRelativePath() { return relativePath; }
    public void setRelativePath(String relativePath) { this.relativePath = relativePath; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
    public boolean isCover() { return cover; }
    public void setCover(boolean cover) { this.cover = cover; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
