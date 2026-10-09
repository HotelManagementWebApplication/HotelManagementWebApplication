package com.hospitality.mis.dao.room;

import com.hospitality.mis.entity.room.RoomTypePriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RoomTypePriceHistoryRepository extends JpaRepository<RoomTypePriceHistory, Long> {
    List<RoomTypePriceHistory> findByRoomTypeIdOrderByEffectiveAtDescIdDesc(String roomTypeId);
}
