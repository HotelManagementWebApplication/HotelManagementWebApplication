package com.hospitality.mis.guest;

import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.entity.billing.Service;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:publicguestapi;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
/** Kiểm tra public portal anonymous, DTO allow-list và lọc dịch vụ active. */
class PublicGuestApiContractTest {
    @Autowired MockMvc mockMvc;
    @Autowired RoomRepository rooms;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired ServiceRepository services;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seedPublicCatalog() {
        jdbc.update("delete from NhatKyKiemSoat");
        rooms.deleteAllInBatch();
        roomTypes.deleteAllInBatch();
        services.deleteAllInBatch();

        RoomType type = new RoomType();
        type.setId("STD");
        type.setName("Standard");
        type.setDailyPrice(new BigDecimal("2400000.00"));
        type.setDescription("Phòng tiêu chuẩn");
        roomTypes.saveAndFlush(type);

        Room room = new Room();
        room.setId("R101");
        room.setName("Phòng 101");
        room.setFloor(1);
        room.setDescription("Phòng có cửa sổ");
        room.setRoomType(type);
        rooms.saveAndFlush(room);

        Service active = new Service();
        active.setId("WATER");
        active.setName("Nước suối");
        active.setPrice(new BigDecimal("15000.00"));
        active.setUnit("CHAI");
        active.setStockQuantity(20);
        active.setSafetyThreshold(5);
        active.setActive(true);
        services.saveAndFlush(active);

        Service inactive = new Service();
        inactive.setId("OLD");
        inactive.setName("Dịch vụ ngừng phục vụ");
        inactive.setPrice(new BigDecimal("50000.00"));
        inactive.setUnit("LẦN");
        inactive.setStockQuantity(99);
        inactive.setSafetyThreshold(0);
        inactive.setActive(false);
        services.saveAndFlush(inactive);
    }

    @Test
    void anonymousCanReadPublicRoomsAndInternalRoomApiRemainsProtected() throws Exception {
        mockMvc.perform(get("/api/public/rooms"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "1"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("max-age=30")))
                .andExpect(jsonPath("$[0].room_id").value("R101"))
                .andExpect(jsonPath("$[0].room_name").value("Phòng 101"))
                .andExpect(jsonPath("$[0].room_type_name").value("Standard"))
                .andExpect(jsonPath("$[0].daily_price").value(2400000.00))
                .andExpect(jsonPath("$[0].status").value("available"))
                .andExpect(jsonPath("$[0].guest").doesNotExist())
                .andExpect(jsonPath("$[0].stock").doesNotExist());

        mockMvc.perform(get("/api/rooms"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicRoomDetailUsesAnAllowListedDto() throws Exception {
        mockMvc.perform(get("/api/public/rooms/R101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room_id").value("R101"))
                .andExpect(jsonPath("$.room_type_description").value("Phòng tiêu chuẩn"))
                .andExpect(jsonPath("$.description").value("Phòng có cửa sổ"))
                .andExpect(jsonPath("$.image_urls").isEmpty())
                .andExpect(jsonPath("$.amenities").isEmpty())
                .andExpect(jsonPath("$.reservation").doesNotExist())
                .andExpect(jsonPath("$.phone").doesNotExist());
    }

    @Test
    void publicServicesOnlyExposeActiveCatalogWithoutInventoryFields() throws Exception {
        mockMvc.perform(get("/api/public/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].service_id").value("WATER"))
                .andExpect(jsonPath("$[0].name").value("Nước suối"))
                .andExpect(jsonPath("$[0].price").value(15000.00))
                .andExpect(jsonPath("$[0].stock").doesNotExist())
                .andExpect(jsonPath("$[1]").doesNotExist());
    }

    @Test
    void anonymousCanCheckAvailabilityForASelectedInterval() throws Exception {
        mockMvc.perform(get("/api/public/rooms/availability")
                        .param("from", "2031-01-10T14:00:00")
                        .param("to", "2031-01-11T12:00:00"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$[0].room_id").value("R101"))
                .andExpect(jsonPath("$[0].current_status").value("available"))
                .andExpect(jsonPath("$[0].available").value(true));
    }

    @Test
    void publicCatalogValidatesPagination() throws Exception {
        mockMvc.perform(get("/api/public/rooms").param("page", "-1"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_PAGINATION"));
    }

    @Test
    void publicAvailabilityRejectsAnInvalidRange() throws Exception {
        mockMvc.perform(get("/api/public/rooms/availability")
                        .param("from", "2031-01-11T12:00:00")
                        .param("to", "2031-01-10T14:00:00"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_INTERVAL"));
    }
}
