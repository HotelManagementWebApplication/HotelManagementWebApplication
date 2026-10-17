package com.hospitality.mis.dao.room;



import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Lock;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;



import java.util.List;

import java.util.Optional;



/** Kho phòng với truy vấn nạp loại phòng, lọc danh mục và khóa ghi.
 * Lưu thông thường dùng optimistic version của entity; hai truy vấn findForUpdate dùng khóa pessimistic.
 */
public interface RoomRepository extends JpaRepository<Room, String> {
    /** Khóa một phòng và nạp loại phòng để cập nhật trạng thái trong transaction ghi. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    @Query("select r from Room r join fetch r.roomType where r.id = :id")
    Optional<Room> findForUpdate(@Param("id") String id);

    /** Tìm phòng chi tiết và nạp loại phòng cho DTO read-only. */
    @Query("select r from Room r join fetch r.roomType where r.id = :id")
    Optional<Room> findByIdWithRoomType(@Param("id") String id);


    /** Khóa nhiều phòng theo thứ tự ID cố định để giảm nguy cơ deadlock khi cập nhật hàng loạt. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    @Query("select r from Room r join fetch r.roomType where r.id in :ids order by r.id")
    List<Room> findAllForUpdateOrdered(@Param("ids") List<String> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Room r where r.roomType.id = :roomTypeId order by r.id")
    List<Room> findAllByRoomTypeIdForUpdate(@Param("roomTypeId") String roomTypeId);


    /** Tìm phòng theo loại và trạng thái tùy chọn, luôn sắp xếp theo ID để kết quả ổn định. */
    @Query("select r from Room r join fetch r.roomType where (:type is null or r.roomType.id = :type) and (:status is null or r.status = :status) order by r.id")
    List<Room> search(@Param("type") String type, @Param("status") RoomStatus status);
}
