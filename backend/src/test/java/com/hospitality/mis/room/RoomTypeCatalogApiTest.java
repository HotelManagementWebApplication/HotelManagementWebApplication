package com.hospitality.mis.room;

import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dao.room.RoomTypePriceHistoryRepository;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** P1.1 contract: loại phòng phải qua draft/approval trước khi public. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:roomtypecatalog;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class RoomTypeCatalogApiTest {
    @Autowired MockMvc mvc;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired RoomRepository rooms;
    @Autowired ApprovalRepository approvals;
    @Autowired RoomTypePriceHistoryRepository priceHistory;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        rooms.deleteAllInBatch();
        priceHistory.deleteAllInBatch();
        roomTypes.deleteAllInBatch();
        approvals.deleteAllInBatch();
        jdbc.update("delete from BanGhiChongTrung");
        jdbc.update("delete from NhatKyKiemSoat");
    }

    @Test
    void technicalDraftRequiresManagerApprovalBeforeItCanBeActivated() throws Exception {
        String body = """
                {"id":"DLX","name":"Deluxe","daily_price":180000,"description":"Sea view"}
                """;
        mvc.perform(post("/api/room-types").with(jwtAs("tech", "TECHNICAL"))
                        .header("Idempotency-Key", "create-dlx")
                        .contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.catalog_status").value("DRAFT"));

        String approval = mvc.perform(post("/api/room-types/DLX/submit").with(jwtAs("tech", "TECHNICAL"))
                        .header("Idempotency-Key", "submit-dlx"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("ROOM_TYPE_ACTIVATE"))
                .andReturn().getResponse().getContentAsString();
        long approvalId = com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
                .readTree(approval).get("id").asLong();

        mvc.perform(post("/api/governance/approvals/" + approvalId + "/approve")
                        .with(jwtAs("manager", "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

                mvc.perform(post("/api/room-types/DLX/activate").with(jwtAs("manager", "MANAGER"))
                        .header("Idempotency-Key", "activate-dlx"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.catalog_status").value("ACTIVE"))
                .andExpect(jsonPath("$.approved_by").value("manager"));

        mvc.perform(get("/api/room-types/DLX/price-history").with(jwtAs("tech", "TECHNICAL")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].room_type_id").value("DLX"))
                .andExpect(jsonPath("$[0].daily_price").value(180000))
                .andExpect(jsonPath("$[0].changed_by").value("manager"))
                .andExpect(jsonPath("$[0].approval_id").value(approvalId));
    }

    @Test
    void rejectedActivationMovesCatalogBackToRejected() throws Exception {
        mvc.perform(post("/api/room-types").with(jwtAs("tech", "TECHNICAL"))
                        .header("Idempotency-Key", "create-rejected")
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":\"REJ\",\"name\":\"Rejected\",\"daily_price\":120000}"))
                .andExpect(status().isCreated());

        String approval = mvc.perform(post("/api/room-types/REJ/submit").with(jwtAs("tech", "TECHNICAL"))
                        .header("Idempotency-Key", "submit-rejected"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long approvalId = new com.fasterxml.jackson.databind.ObjectMapper().readTree(approval).get("id").asLong();

        mvc.perform(post("/api/governance/approvals/" + approvalId + "/reject")
                        .with(jwtAs("manager", "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(get("/api/room-types/REJ").with(jwtAs("tech", "TECHNICAL")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.catalog_status").value("REJECTED"));
    }

    @Test
    void draftRoomTypeIsNotVisibleOnPublicPortal() throws Exception {
        RoomType type = new RoomType();
        type.setId("HIDDEN"); type.setName("Hidden"); type.setDailyPrice(new BigDecimal("100000"));
        type.setCatalogStatus(RoomTypeCatalogStatus.DRAFT);
        roomTypes.saveAndFlush(type);
        Room room = new Room(); room.setId("H001"); room.setName("Hidden room"); room.setRoomType(type);
        rooms.saveAndFlush(room);

        mvc.perform(get("/api/public/rooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/public/rooms/H001"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }

    private static RequestPostProcessor jwtAs(String id, String role) {
        return jwt().jwt(token -> token.subject(id)
                        .claim("principal_id", id).claim("principal_type", "EMPLOYEE"))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
