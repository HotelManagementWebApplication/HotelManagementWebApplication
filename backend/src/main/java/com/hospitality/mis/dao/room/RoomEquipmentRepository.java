package com.hospitality.mis.dao.room;

import com.hospitality.mis.entity.room.RoomEquipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

/** Kho thiết bị phòng, giới hạn truy vấn hiển thị ở các thiết bị còn hoạt động. */
public interface RoomEquipmentRepository extends JpaRepository<RoomEquipment, Long> {
    /** Lấy thiết bị đang hoạt động của phòng, sắp xếp theo tên để hiển thị ổn định. */
    List<RoomEquipment> findByRoomIdAndActiveTrueOrderByNameAsc(String roomId);
    List<RoomEquipment> findByRoomIdOrderByNameAsc(String roomId);
    Optional<RoomEquipment> findByIdAndRoomId(Long id, String roomId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RoomEquipment> findForUpdateByIdAndRoomId(Long id, String roomId);
    Optional<RoomEquipment> findByIdAndRoomIdAndActiveTrue(Long id, String roomId);
}
