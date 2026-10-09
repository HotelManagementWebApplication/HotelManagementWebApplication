package com.hospitality.mis.dao.operations;
import com.hospitality.mis.entity.reservation.RoomTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
/** Kho lịch sử chuyển phòng của đặt phòng. */
/** SQL integration fixture access only; production uses the transfer command. */
public interface RoomTransferRepository extends JpaRepository<RoomTransfer, Long> {
    /** Lấy lịch sử chuyển phòng của đặt phòng, lần chuyển mới nhất đứng trước. */
    List<RoomTransfer> findByReservationIdOrderByTransferredAtDesc(Long reservationId);
}
