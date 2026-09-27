package com.hospitality.mis.entity.operations;
import jakarta.persistence.*;
@Entity @Table(name = "MauChecklistBuongPhong")
public class HousekeepingChecklistTemplate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maMauChecklist")
 private Long id;
    @Column(name = "ten", nullable = false, unique = true, length = 100) private String name;
    @Column(name = "dangHoatDong", nullable = false) private boolean active = true;
    public Long getId() { return id; } public String getName() { return name; } public boolean isActive() { return active; }
    public void setName(String v) { name = v; } public void setActive(boolean v) { active = v; }
}
