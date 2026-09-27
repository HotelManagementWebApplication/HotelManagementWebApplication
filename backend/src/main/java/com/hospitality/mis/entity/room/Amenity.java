package com.hospitality.mis.entity.room;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Tiện nghi dùng chung cho các loại phòng và public room detail. */
@Entity
@Table(name = "TienNghi")
@Access(AccessType.FIELD)
public class Amenity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maTienNghi")
    private Long id;

    @Column(name = "ten", nullable = false, length = 100)
    private String name;

    @Column(name = "dangHoatDong", nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
