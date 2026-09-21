package com.hospitality.mis.entity.operations;



import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.room.Room;
import jakarta.persistence.*;

import java.math.BigDecimal;

import java.time.LocalDate;

import java.time.LocalDateTime;



/** Sự cố thiết bị trong phòng, kèm giá trị và khoản bồi thường phát sinh. */
@Entity

@Table(name = "equipment_incidents")
public class EquipmentIncident {

    /** ID sự cố do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reservation_id", nullable = true) private Reservation reservation;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "room_id") private Room room;
    @Column(name = "equipment_name", nullable = false, length = 100) private String equipmentName;
    /** Giá trị gốc của thiết bị tại thời điểm ghi nhận sự cố. */
    @Column(name = "original_value", nullable = false, precision = 14, scale = 2) private BigDecimal originalValue;
    @Column(name = "purchased_on", nullable = false) private LocalDate purchasedAt;
    @Column(nullable = false) private int quantity;

    /** Số tiền bồi thường được tính cho sự cố. */
    @Column(name = "compensation", nullable = false, precision = 14, scale = 2) private BigDecimal compensation;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt = LocalDateTime.now();
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private IncidentSeverity severity = IncidentSeverity.MEDIUM;
    @Enumerated(EnumType.STRING) @Column(name = "handoff_status", nullable = false, length = 20) private IncidentHandoffStatus handoffStatus = IncidentHandoffStatus.OPEN;
    @Column(name = "handoff_note", length = 500) private String handoffNote;
    /** Constructor rỗng dành cho JPA. */
    protected EquipmentIncident() {}

    /** Tạo snapshot sự cố; giá trị thiết bị được chụp để lịch sử không phụ thuộc dữ liệu hiện tại. */
    public EquipmentIncident(Reservation reservation, Room room, String equipmentName, BigDecimal originalValue,
                             LocalDate purchasedAt, int quantity, BigDecimal compensation) {

        this.reservation = reservation; this.room = room; this.equipmentName = equipmentName;
        this.originalValue = originalValue; this.purchasedAt = purchasedAt; this.quantity = quantity; this.compensation = compensation;

    }

    public Long getId() { return id; }

    public Reservation getReservation() { return reservation; }
    public Room getRoom() { return room; }
    public String getEquipmentName() { return equipmentName; }

    public BigDecimal getCompensation() { return compensation; }
    public IncidentSeverity getSeverity() { return severity; }
    public IncidentHandoffStatus getHandoffStatus() { return handoffStatus; }
    public String getHandoffNote() { return handoffNote; }
    public void setSeverity(IncidentSeverity value) { severity = value == null ? IncidentSeverity.MEDIUM : value; }
    public void setHandoffStatus(IncidentHandoffStatus value) { handoffStatus = value == null ? IncidentHandoffStatus.OPEN : value; }
    public void setHandoffNote(String value) { handoffNote = value; }

    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

}
