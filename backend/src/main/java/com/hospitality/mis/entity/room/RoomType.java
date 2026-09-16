package com.hospitality.mis.entity.room;



import jakarta.persistence.Access;

import jakarta.persistence.AccessType;

import jakarta.persistence.Column;

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
import java.util.LinkedHashSet;
import java.util.Set;


import java.math.BigDecimal;



/**

 * Trạng thái và ánh xạ chuẩn của loại phòng.

 *

 * Chủ thể JPA cụ thể duy nhất của bảng {@code room_types}.
 */
@Entity
@Table(name = "room_types")
@Access(AccessType.FIELD)
public class RoomType {
    /** Mã loại phòng dùng làm khóa quan hệ từ Room. */
    @Id

    @Column(name = "id", length = 10, nullable = false)
    private String id;



    @Column(name = "name", nullable = false, length = 50)
    /** Tên hiển thị của loại phòng. */
    private String name;



    @Column(name = "daily_price", nullable = false, precision = 12, scale = 2)
    /** Giá cơ bản mỗi ngày, dùng khi tính tiền phòng. */
    private BigDecimal dailyPrice;



    @Column(name = "description", length = 500)
    /** Mô tả tiện nghi hoặc quy định của loại phòng. */
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "catalog_status", nullable = false, length = 20)
    private RoomTypeCatalogStatus catalogStatus = RoomTypeCatalogStatus.ACTIVE;

    @Column(name = "catalog_updated_by", length = 50)
    private String catalogUpdatedBy;

    @Column(name = "catalog_approved_by", length = 50)
    private String catalogApprovedBy;

    @Column(name = "catalog_updated_at")
    private java.time.LocalDateTime catalogUpdatedAt;

    @Column(name = "catalog_approved_at")
    private java.time.LocalDateTime catalogApprovedAt;

    @Column(name = "revision_of_id", length = 10)
    private String revisionOfId;

    @Column(name = "superseded_by_id", length = 10)
    private String supersededById;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "room_type_amenities",
            joinColumns = @JoinColumn(name = "room_type_id"),
            inverseJoinColumns = @JoinColumn(name = "amenity_id"))
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
