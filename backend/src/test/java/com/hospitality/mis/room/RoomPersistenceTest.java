package com.hospitality.mis.room;

import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:roompersistence;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
/** Bảo vệ round-trip Room/RoomType và version khởi tạo phục vụ optimistic locking. */
class RoomPersistenceTest {
    /** Repository room thật để reload bằng findForUpdate. */
    /** Repository room thật để reload bằng findForUpdate. */
    @Autowired RoomRepository rooms;
    /** Repository type thật, persist trước room vì FK. */
    @Autowired RoomTypeRepository roomTypes;
    /** JDBC assertion bảo vệ giá trị vật lý canonical do converter ghi xuống. */
    @Autowired JdbcTemplate jdbc;

    @Test
    /** Given type STD và room READY, When save/reload khóa, Then liên kết và version 0 được giữ. */
    void canonicalRoomAndTypePersistAndReload() {
        RoomType type = new RoomType();
        type.setId("STD"); type.setName("Standard"); type.setDailyPrice(new BigDecimal("2400.00"));
        roomTypes.saveAndFlush(type);
        Room room = new Room();
        room.setId("R101"); room.setName("Room 101"); room.setFloor(1);
        room.setRoomType(type); room.setStatus(RoomStatus.READY);
        rooms.saveAndFlush(room);

        Room reloaded = rooms.findForUpdate("R101").orElseThrow();
        assertThat(reloaded.getRoomType().getId()).isEqualTo("STD");
        assertThat(reloaded.getStatus()).isEqualTo(RoomStatus.READY);
        assertThat(jdbc.queryForObject("select status from rooms where id = ?", String.class, "R101"))
                .isEqualTo("available");
        assertThat(reloaded.getVersion()).isZero();
    }
}
