package com.hospitality.mis.dao.room;

import com.hospitality.mis.entity.room.Amenity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Kho tiện nghi, bao gồm truy vấn active theo loại phòng cho public read model. */
public interface AmenityRepository extends JpaRepository<Amenity, Long> {
    @Query(value = "select a.* from TienNghi a join LoaiPhongTienNghi lptn on lptn.maTienNghi = a.maTienNghi "
            + "where lptn.maLoaiPhong = :roomTypeId and a.dangHoatDong = 1 order by a.ten, a.maTienNghi", nativeQuery = true)
    List<Amenity> findActiveByRoomTypeId(@Param("roomTypeId") String roomTypeId);
    List<Amenity> findAllByOrderByNameAscIdAsc();
}
