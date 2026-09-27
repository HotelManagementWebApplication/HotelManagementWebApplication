package com.hospitality.mis.entity.identity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity @Table(name = "CaLamViecNhanVien")
public class EmployeeShift {
    public enum Status { ASSIGNED, STARTED, COMPLETED, CANCELLED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maCaLamViecNhanVien")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maNhanVien", nullable = false) private Employee employee;
    @Column(name = "ngayLamCa", nullable = false) private LocalDate shiftDate;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.ShiftCodeConverter.class)
    @Column(name = "maCa", nullable = false, length = 30) private String shiftCode;
    @Column(name = "thoiDiemBatDau", nullable = false) private LocalDateTime startsAt;
    @Column(name = "thoiDiemKetThuc", nullable = false) private LocalDateTime endsAt;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.EmployeeShiftStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 20) private Status status = Status.ASSIGNED;
    @Column(name = "nguoiTao", nullable = false, length = 10) private String createdBy;
    public Long getId() { return id; } public Employee getEmployee() { return employee; } public LocalDate getShiftDate() { return shiftDate; }
    public String getShiftCode() { return shiftCode; } public LocalDateTime getStartsAt() { return startsAt; } public LocalDateTime getEndsAt() { return endsAt; }
    public Status getStatus() { return status; } public String getCreatedBy() { return createdBy; }
    public void setEmployee(Employee v) { employee = v; } public void setShiftDate(LocalDate v) { shiftDate = v; } public void setShiftCode(String v) { shiftCode = v; }
    public void setStartsAt(LocalDateTime v) { startsAt = v; } public void setEndsAt(LocalDateTime v) { endsAt = v; } public void setStatus(Status v) { status = v; } public void setCreatedBy(String v) { createdBy = v; }
}
