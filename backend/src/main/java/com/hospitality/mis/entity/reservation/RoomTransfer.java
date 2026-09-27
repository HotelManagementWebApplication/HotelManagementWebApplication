package com.hospitality.mis.entity.reservation;
import com.hospitality.mis.entity.room.Room;
import jakarta.persistence.*;
import java.time.LocalDateTime;
/** Lịch sử chuyển một đặt phòng từ phòng cũ sang phòng mới. */
@Entity @Table(name = "ChuyenPhong") @Access(AccessType.FIELD)
public class RoomTransfer {
    /** ID lần chuyển phòng do cơ sở dữ liệu sinh. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "maChuyenPhong")
 private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhieuDatPhong", nullable = false) private Reservation reservation;
    /** Phòng rời đi. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhongCu", nullable = false) private Room fromRoom;
    /** Phòng được chuyển đến. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhongMoi", nullable = false) private Room toRoom;
    /** Thời điểm chuyển phòng thực tế. */
    @Column(name = "thoiDiemChuyenPhong") private LocalDateTime transferredAt;
    @Column(name = "lyDo", length = 255) private String reason;
    public Long getId() { return id; }
    public Reservation getReservation() { return reservation; }
    public Room getFromRoom() { return fromRoom; }
    public Room getToRoom() { return toRoom; }
    public LocalDateTime getTransferredAt() { return transferredAt; }
    public String getReason() { return reason; }
    public void setReservation(Reservation v) { reservation = v; }
    public void setFromRoom(Room v) { fromRoom = v; }
    public void setToRoom(Room v) { toRoom = v; }
    public void setTransferredAt(LocalDateTime v) { transferredAt = v; }
    public void setReason(String v) { reason = v; }
}
