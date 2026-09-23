package com.hospitality.mis.entity.reservation;
import com.hospitality.mis.dao.room.RoomStatusConverter;


import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Chủ thể chuẩn của một phòng được đặt trong một đặt phòng. */
@Entity
@Table(name = "reservation_rooms")
@IdClass(ReservationRoomId.class)
@Access(AccessType.FIELD)
public class ReservationRoom {
    /** Đặt phòng chứa dòng phòng này; cùng room tạo khóa ghép. */
    @Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;
    /** Phòng được phân bổ cho đặt phòng; cùng reservation tạo khóa ghép. */
    @Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "room_id", nullable = false)
    private Room room;
    /** Khoảng thời gian lưu trú dự kiến/thực tế của riêng phòng này. */
    @Column(name = "check_in", nullable = false) private LocalDateTime checkIn;
    @Column(name = "check_out", nullable = false) private LocalDateTime checkOut;
    /** Thời điểm trả phòng trước mọi lần gia hạn. Được giữ bất biến để tính phí độc lập cho từng phòng. */
    @Column(name = "original_check_out", nullable = false) private LocalDateTime originalCheckOut;
    @Convert(converter = com.hospitality.mis.dao.room.RoomStatusConverter.class)
    @Column(name = "status", nullable = false, length = 30) private RoomStatus status = RoomStatus.RESERVED;
    /** Số lần đổi phòng đã thực hiện cho dòng đặt phòng. */
    @Column(name = "transfer_count", nullable = false) private int transferCount;
    @Column(name = "guest_count", nullable = false) private int guestCount = 1;
    public Reservation getReservation() { return reservation; }
    public Room getRoom() { return room; }
    public LocalDateTime getCheckIn() { return checkIn; }
    public LocalDateTime getCheckOut() { return checkOut; }
    public LocalDateTime getOriginalCheckOut() { return originalCheckOut == null ? checkOut : originalCheckOut; }
    public RoomStatus getStatus() { return status; }
    public int getTransferCount() { return transferCount; }
    public int getGuestCount() { return guestCount; }
    public void setGuestCount(int value) { guestCount = value; }
    public void setReservation(Reservation value) { reservation = value; }
    public void setRoom(Room value) { room = value; }
    public void setCheckIn(LocalDateTime value) { checkIn = value; }
    /** Ghi giờ trả phòng và chụp giờ gốc ở lần thiết lập đầu tiên. */
    public void setCheckOut(LocalDateTime value) {
        checkOut = value;
        if (originalCheckOut == null) originalCheckOut = value;
    }
    public void setOriginalCheckOut(LocalDateTime value) { originalCheckOut = value; }
    public void setStatus(RoomStatus value) { status = value; }
    /** Tăng số lần đổi phòng sau khi nghiệp vụ chuyển phòng hoàn tất. */
    public void incrementTransferCount() { transferCount++; }

    @PrePersist
    /** Bổ sung giờ trả phòng gốc trước khi persist nếu dữ liệu cũ chưa có. */
    void ensureOriginalCheckout() {
        if (originalCheckOut == null) originalCheckOut = checkOut;
    }
}
