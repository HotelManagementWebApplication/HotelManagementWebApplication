package com.hospitality.mis.entity.room;



import jakarta.persistence.Access;

import jakarta.persistence.AccessType;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;

import jakarta.persistence.Id;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.JoinTable;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Transient;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;


import java.math.BigDecimal;



/**

 * Trạng thái và ánh xạ chuẩn của loại phòng.

 *

 * Chủ thể JPA cụ thể duy nhất của bảng {@code room_types}.
 */
@Entity
@Table(name = "LoaiPhong")
@Access(AccessType.FIELD)
public class RoomType {
    /** Mã loại phòng dùng làm khóa quan hệ từ Room. */
    @Id

    @Column(name = "maLoaiPhong", length = 10, nullable = false)
    private String id;



    @Column(name = "ten", nullable = false, length = 50)
    /** Tên hiển thị của loại phòng. */
    private String name;



    @Column(name = "giaTheoNgay", nullable = false, precision = 12, scale = 2)
    /** Giá cơ bản mỗi ngày, dùng khi tính tiền phòng. */
    private BigDecimal dailyPrice;



    @Column(name = "moTa", length = 500)
    /** Mô tả tiện nghi hoặc quy định của loại phòng. */
    private String description;

    @Column(name = "dienTich", precision = 8, scale = 2)
    /** Diện tích loại phòng theo mét vuông. */
    private BigDecimal area;

    @Column(name = "huongNhin", length = 100)
    /** Hướng nhìn chính dùng trên catalog khách hàng. */
    private String view;

    @Column(name = "giaTheoGio", nullable = false, precision = 12, scale = 2)
    /** Giá cơ bản mỗi giờ cho hình thức thuê theo giờ. */
    private BigDecimal hourlyPrice = BigDecimal.ZERO;

    @Column(name = "loaiGiuong", length = 100)
    /** Mô tả cấu hình giường của loại phòng. */
    private String bedType;

    @Column(name = "maHangPhong", nullable = false, length = 12)
    private String roomTypeCode = "STD";

    @Column(name = "soKhachToiDa", nullable = false)
    private Integer maxOccupancy = 2;

    @Column(name = "duongDanAnhBia", length = 500)
    private String coverImageUrl;

    /** Câu giới thiệu marketing được quản trị cùng catalog loại phòng. */
    @Column(name = "khauHieuQuangBa", length = 500)
    private String marketingTagline;

    /** Tên thương mại hiển thị trên catalog khách hàng. */
    @Column(name = "tenQuangBa", length = 200)
    private String marketingName;

    /** Mô tả quảng cáo hiển thị trên catalog khách hàng. */
    @Column(name = "moTaQuangBa", length = 1200)
    private String marketingDescription;

    /** Giá trị tạm chỉ để tương thích với mã gọi cũ; gallery được lưu thành từng hàng riêng. */
    @Transient
    private String galleryImageUrls;

    @OneToMany(mappedBy = "roomType", fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC, id ASC")
    private List<RoomTypeImage> galleryImages = new ArrayList<>();

    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.RoomTypeCatalogStatusConverter.class)
    @Column(name = "trangThaiDanhMuc", nullable = false, length = 30)
    private RoomTypeCatalogStatus catalogStatus = RoomTypeCatalogStatus.ACTIVE;

    @Column(name = "nguoiCapNhatDanhMuc", length = 50)
    private String catalogUpdatedBy;

    @Column(name = "nguoiDuyetDanhMuc", length = 50)
    private String catalogApprovedBy;

    @Column(name = "thoiDiemCapNhatDanhMuc")
    private java.time.LocalDateTime catalogUpdatedAt;

    @Column(name = "thoiDiemDuyetDanhMuc")
    private java.time.LocalDateTime catalogApprovedAt;

    @Column(name = "maLoaiPhongGoc", length = 10)
    private String revisionOfId;

    @Column(name = "maLoaiPhongThayThe", length = 10)
    private String supersededById;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "LoaiPhongTienNghi",
            joinColumns = @JoinColumn(name = "maLoaiPhong"),
            inverseJoinColumns = @JoinColumn(name = "maTienNghi"))
    @OrderBy("name ASC")
    private Set<Amenity> amenities = new LinkedHashSet<>();



    /** Constructor rỗng dành cho JPA. */
    public RoomType() {
    }



    public String getId() {

        return id;

    }



    public void setId(String id) {

        this.id = id;

    }





    public String getName() {

        return name;

    }



    public void setName(String name) {

        this.name = name;

    }



    public BigDecimal getDailyPrice() {

        return dailyPrice;

    }



    public void setDailyPrice(BigDecimal dailyPrice) {

        this.dailyPrice = dailyPrice;

    }



    public String getDescription() {

        return description;

    }



    public void setDescription(String description) {

        this.description = description;

    }

    public BigDecimal getArea() { return area; }
    public void setArea(BigDecimal area) { this.area = area; }
    public String getView() { return view; }
    public void setView(String view) { this.view = view; }
    public BigDecimal getHourlyPrice() { return hourlyPrice; }
    public void setHourlyPrice(BigDecimal hourlyPrice) { this.hourlyPrice = hourlyPrice == null ? BigDecimal.ZERO : hourlyPrice; }
    public String getBedType() { return bedType; }
    public void setBedType(String bedType) { this.bedType = bedType; }
    public String getRoomTypeCode() { return roomTypeCode; }
    public void setRoomTypeCode(String roomTypeCode) { this.roomTypeCode = roomTypeCode == null || roomTypeCode.isBlank() ? "STD" : roomTypeCode; }
    public Integer getMaxOccupancy() { return maxOccupancy; }
    public void setMaxOccupancy(Integer maxOccupancy) { this.maxOccupancy = maxOccupancy == null ? 2 : maxOccupancy; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getMarketingTagline() { return marketingTagline; }
    public void setMarketingTagline(String marketingTagline) { this.marketingTagline = marketingTagline; }
    public String getMarketingName() { return marketingName; }
    public void setMarketingName(String marketingName) { this.marketingName = marketingName; }
    public String getMarketingDescription() { return marketingDescription; }
    public void setMarketingDescription(String marketingDescription) { this.marketingDescription = marketingDescription; }
    public String getGalleryImageUrls() {
        if (galleryImages != null && !galleryImages.isEmpty()) {
            return galleryImages.stream().map(RoomTypeImage::getImageUrl).filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.joining("\n"));
        }
        return galleryImageUrls;
    }
    public void setGalleryImageUrls(String galleryImageUrls) { this.galleryImageUrls = galleryImageUrls; }

    public RoomTypeCatalogStatus getCatalogStatus() { return catalogStatus; }
    public void setCatalogStatus(RoomTypeCatalogStatus catalogStatus) {
        this.catalogStatus = catalogStatus == null ? RoomTypeCatalogStatus.DRAFT : catalogStatus;
    }
    public String getCatalogUpdatedBy() { return catalogUpdatedBy; }
    public void setCatalogUpdatedBy(String catalogUpdatedBy) { this.catalogUpdatedBy = catalogUpdatedBy; }
    public String getCatalogApprovedBy() { return catalogApprovedBy; }
    public void setCatalogApprovedBy(String catalogApprovedBy) { this.catalogApprovedBy = catalogApprovedBy; }
    public java.time.LocalDateTime getCatalogUpdatedAt() { return catalogUpdatedAt; }
    public void setCatalogUpdatedAt(java.time.LocalDateTime catalogUpdatedAt) { this.catalogUpdatedAt = catalogUpdatedAt; }
    public java.time.LocalDateTime getCatalogApprovedAt() { return catalogApprovedAt; }
    public void setCatalogApprovedAt(java.time.LocalDateTime catalogApprovedAt) { this.catalogApprovedAt = catalogApprovedAt; }
    public String getRevisionOfId() { return revisionOfId; }
    public void setRevisionOfId(String value) { revisionOfId = value; }
    public String getSupersededById() { return supersededById; }
    public void setSupersededById(String value) { supersededById = value; }

    public Set<Amenity> getAmenities() { return amenities; }

}
