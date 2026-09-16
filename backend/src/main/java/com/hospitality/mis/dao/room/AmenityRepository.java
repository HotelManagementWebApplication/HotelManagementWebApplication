package com.hospitality.mis.dao.room;

import com.hospitality.mis.entity.room.Amenity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Kho tiện nghi, bao gồm truy vấn active theo loại phòng cho public read model. */
public interface AmenityRepository extends JpaRepository<Amenity, Long> {
    @Query(value = "select a.* from amenities a join room_type_amenities rta on rta.amenity_id = a.id "
            + "where rta.room_type_id = :roomTypeId and a.active = true order by a.name, a.id", nativeQuery = true)
    List<Amenity> findActiveByRoomTypeId(@Param("roomTypeId") String roomTypeId);
    List<Amenity> findAllByOrderByNameAscIdAsc();
}
