package com.hospitality.mis.dao.room;



import com.hospitality.mis.entity.room.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;



/** Kho JPA cho danh mục loại phòng; hành vi truy vấn dùng các phương thức chuẩn của JpaRepository. */
public interface RoomTypeRepository extends JpaRepository<RoomType, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from RoomType t where t.id = :id")
    Optional<RoomType> findForUpdate(@org.springframework.data.repository.query.Param("id") String id);
}
