package com.hospitality.mis.operations;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.service.operations.HousekeepingService;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Real SQL Server proof for durable housekeeping/technical commands and ownership. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerHousekeepingTechnicalContractTest {
    private static final String TYPE = "P17-H2";
    private static final String HOUSEKEEPING_ROOM = "P17-HK";
    private static final String TECHNICAL_ROOM = "P17-TE";

    @Autowired HousekeepingService housekeeping;
    @Autowired TechnicalWorkOrderService technical;
    @Autowired RoomRepository rooms;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired IdempotencyRecordRepository idempotencyRecords;
    @Autowired ObjectMapper objectMapper;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        cleanupFixtures();

        RoomType type = new RoomType();
        type.setId(TYPE);
        type.setName("P1.7/P1.8 H2 type");
        type.setDailyPrice(new BigDecimal("100000"));
        roomTypes.saveAndFlush(type);
        rooms.saveAndFlush(room(HOUSEKEEPING_ROOM, type));
        rooms.saveAndFlush(room(TECHNICAL_ROOM, type));
    }

    @AfterEach
    void clearAuthentication() { cleanupFixtures(); SecurityContextHolder.clearContext(); }

    private void cleanupFixtures() {
        jdbc.update("DELETE PhieuCongViecKyThuat WHERE maPhong IN (?,?)",HOUSEKEEPING_ROOM,TECHNICAL_ROOM);
        jdbc.update("DELETE KiemTraBuongPhong WHERE maNhiemVuBuongPhong IN (SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong IN (?,?))",HOUSEKEEPING_ROOM,TECHNICAL_ROOM);
        jdbc.update("DELETE KetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong IN (SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong IN (?,?))",HOUSEKEEPING_ROOM,TECHNICAL_ROOM);
        jdbc.update("DELETE NhiemVuBuongPhong WHERE maPhong IN (?,?)",HOUSEKEEPING_ROOM,TECHNICAL_ROOM);
        jdbc.update("DELETE BanGhiChongTrung WHERE khoaChongTrung LIKE N'p17-%'");
        jdbc.update("DELETE Phong WHERE maPhong IN (?,?)",HOUSEKEEPING_ROOM,TECHNICAL_ROOM);
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=?",TYPE);
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'P17-%'");
    }

    @Test
    void housekeepingReplayIsDurableAndPayloadMismatchConflicts() {
        as("P17-MGR", "ROLE_MANAGER");
        var request = new HousekeepingDtos.CreateRequest(HOUSEKEEPING_ROOM, "P17-HK", "turnover");

        var first = housekeeping.create(request, "P17-MGR", "p17-housekeeping-create");
        var replay = housekeeping.create(request, "P17-MGR", "p17-housekeeping-create");

        assertThat(replay).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhiemVuBuongPhong WHERE maPhong=?",Integer.class,HOUSEKEEPING_ROOM)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE khoaChongTrung LIKE N\'p17-%\'",Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> housekeeping.create(
                new HousekeepingDtos.CreateRequest(HOUSEKEEPING_ROOM, "P17-HK", "different"),
                "P17-MGR", "p17-housekeeping-create"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("IDEMPOTENCY_KEY_CONFLICT");
    }

    @Test
    void technicalOwnershipAndStateTransitionsRemainBounded() {
        as("P17-TECH-1", "ROLE_TECHNICAL");
        var created = technical.create(new TechnicalWorkOrderDtos.CreateRequest(
                TECHNICAL_ROOM, null, "P17-TECH-1", "HIGH", null, null),
                "P17-TECH-1", "p17-technical-create");

        as("P17-TECH-2", "ROLE_TECHNICAL");
        assertThatThrownBy(() -> technical.update(created.id(),
                new TechnicalWorkOrderDtos.UpdateRequest("ACKNOWLEDGED", null, null, null),
                "P17-TECH-2", "p17-technical-other-owner"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN");

        as("P17-TECH-1", "ROLE_TECHNICAL");
        assertThatThrownBy(() -> technical.update(created.id(),
                new TechnicalWorkOrderDtos.UpdateRequest("IN_PROGRESS", null, null, null),
                "P17-TECH-1", "p17-technical-invalid-transition"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("INVALID_TECHNICAL_TRANSITION");
    }

    @Test
    void technicalReplayIsDurableAndPayloadMismatchConflicts() {
        as("P17-TECH-1", "ROLE_TECHNICAL");
        var request = new TechnicalWorkOrderDtos.CreateRequest(
                TECHNICAL_ROOM, null, "P17-TECH-1", "HIGH", null, "filter");

        var first = technical.create(request, "P17-TECH-1", "p17-technical-replay");
        var replay = technical.create(request, "P17-TECH-1", "p17-technical-replay");

        assertThat(replay).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM PhieuCongViecKyThuat WHERE maPhong=?",Integer.class,TECHNICAL_ROOM)).isEqualTo(1);
        assertThatThrownBy(() -> technical.create(
                new TechnicalWorkOrderDtos.CreateRequest(
                        TECHNICAL_ROOM, null, "P17-TECH-1", "LOW", null, "filter"),
                "P17-TECH-1", "p17-technical-replay"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("IDEMPOTENCY_KEY_CONFLICT");
    }

    @Test
    void removedRequestFieldsFailAtTheCurrentJsonContract() {
        assertThatThrownBy(() -> objectMapper.readValue(
                "{\"status\":\"READY\",\"checklist_complete\":true}",
                HousekeepingDtos.UpdateRequest.class)).isInstanceOf(JsonProcessingException.class);
        assertThatThrownBy(() -> objectMapper.readValue(
                "{\"status\":\"IN_PROGRESS\",\"acceptance_note\":\"ignored\"}",
                TechnicalWorkOrderDtos.UpdateRequest.class)).isInstanceOf(JsonProcessingException.class);
    }

    private Room room(String id, RoomType type) {
        Room room = new Room();
        room.setId(id);
        room.setRoomType(type);
        room.setStatus(RoomStatus.READY);
        return room;
    }

    private void as(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor, "", role));
    }
}
