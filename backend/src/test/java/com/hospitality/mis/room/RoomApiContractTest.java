package com.hospitality.mis.room;

import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
/** Kiểm tra room HTTP contract, status transition, availability validation và role boundary. */
class RoomApiContractTest {
    /** MockMvc thật cho JSON/status/security assertions. */
    @Autowired MockMvc mockMvc;
    /** Repository room thật để seed và chuyển trạng thái. */
    @Autowired RoomRepository rooms;
    /** Repository type thật; STD/2400 là fixture giá canonical. */
    @Autowired RoomTypeRepository roomTypes;
    /** Dọn audit do status mutation tạo ra. */
    @Autowired JdbcTemplate jdbc;

    /** Seed type STD và room R101 READY trước mỗi API test. */
    @BeforeEach
    void seedRoom() {
        jdbc.update("delete from NhatKyKiemSoat");
        rooms.deleteAllInBatch();
        roomTypes.deleteAllInBatch();

        RoomType type = new RoomType();
        type.setId("STD");
        type.setName("Standard");
        type.setDailyPrice(new BigDecimal("2400.00"));
        roomTypes.saveAndFlush(type);

        Room room = new Room();
        room.setId("R101");
        room.setName("Room 101");
        room.setFloor(1);
        room.setRoomType(type);
        rooms.saveAndFlush(room);
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    /** Given room READY, When search canonical status, Then response dùng lower_snake_case. */
    void searchKeepsTheExistingRoomResponseShapeAndStatusCodes() throws Exception {
        mockMvc.perform(get("/api/rooms").param("type", "STD").param("status", "available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("R101"))
                .andExpect(jsonPath("$[0].name").value("Room 101"))
                .andExpect(jsonPath("$[0].room_type_id").value("STD"))
                .andExpect(jsonPath("$[0].room_type_name").value("Standard"))
                .andExpect(jsonPath("$[0].daily_price").value(2400.00))
                .andExpect(jsonPath("$[0].floor").value(1))
                .andExpect(jsonPath("$[0].status").value("available"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    /** Given manager patch maintenance, When update, Then response dùng status canonical. */
    void statusPatchUsesTheExistingRouteAndWritesCanonicalStatus() throws Exception {
        mockMvc.perform(patch("/api/rooms/R101/status").param("status", "maintenance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("R101"))
                .andExpect(jsonPath("$.status").value("maintenance"));
    }

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    /** Given room OCCUPIED, When patch READY, Then transition domain error và không hợp thức hóa room. */
    void occupiedRoomCannotBeMadeAvailableThroughStatusPatch() throws Exception {
        Room room = rooms.findById("R101").orElseThrow();
        room.setStatus(RoomStatus.OCCUPIED);
        rooms.saveAndFlush(room);

        mockMvc.perform(patch("/api/rooms/R101/status").param("status", "available"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.code").value("INVALID_ROOM_TRANSITION"))
                .andExpect(jsonPath("$.details").isArray());
    }

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    /** Given housekeeping room MAINTENANCE, When patch READY, Then role bị forbidden. */
    void housekeepingCannotMakeRoomAvailable() throws Exception {
        Room room = rooms.findById("R101").orElseThrow();
        room.setStatus(RoomStatus.MAINTENANCE);
        rooms.saveAndFlush(room);

        mockMvc.perform(patch("/api/rooms/R101/status").param("status", "available"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROOM_STATUS_FORBIDDEN"));
    }

    @Test
    @WithMockUser(username = "staff", roles = "STAFF")
    /** Given status không thuộc enum, When search, Then trả INVALID_ROOM_STATUS. */
    void invalidRoomStatusIsRejectedByTheRoomContract() throws Exception {
        mockMvc.perform(get("/api/rooms").param("status", "NOT_A_STATUS"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_ROOM_STATUS"));
    }

    @Test
    @WithMockUser(username = "staff", roles = "STAFF")
    /** Given legacy room code, When search, Then hard-cut rejects it without a compatibility read. */
    void legacyRoomStatusCodeIsRejectedByTheRoomContract() throws Exception {
        mockMvc.perform(get("/api/rooms").param("status", "SAN_SANG"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_ROOM_STATUS"));
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    /** Given from sau to, When availability, Then trả INVALID_INTERVAL theo error contract. */
    void availabilityRejectsAnInvalidIntervalWithTheDomainErrorContract() throws Exception {
        mockMvc.perform(get("/api/rooms/availability")
                        .param("from", "2031-01-11T12:00:00")
                        .param("to", "2031-01-10T14:00:00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_INTERVAL"));
    }
}
