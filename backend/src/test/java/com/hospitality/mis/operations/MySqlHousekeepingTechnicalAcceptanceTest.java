package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingInspectionService;
import com.hospitality.mis.service.operations.HousekeepingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MySQL/InnoDB acceptance for the production housekeeping lifecycle and readiness gates. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlHousekeepingTechnicalAcceptanceTest {
    private static final String MANAGER = "MGR1301";
    private static final String WORKER = "HK1301";
    private static final String ROOM_TYPE = "T1301";
    private static final String ROOM = "R1301";
    private static final String TECHNICAL_ROOM = "R1302";
    private static final String TEMPLATE = "P1.3 Bathroom 1301";
    private static final long GUEST = 91301L;
    private static final long RESERVATION = 91301L;

    @Autowired JdbcTemplate jdbc;
    @Autowired HousekeepingService housekeeping;
    @Autowired HousekeepingChecklistService checklists;
    @Autowired HousekeepingInspectionService inspections;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into employees(id, full_name, password, position, phone) values (?,?,?,?,?)",
                MANAGER, "P1.3 Manager", "unused", "MANAGER", "0913010001");
        jdbc.update("insert into employees(id, full_name, password, position, phone) values (?,?,?,?,?)",
                WORKER, "P1.3 Housekeeper", "unused", "HOUSEKEEPING", "0913010002");
        jdbc.update("insert into room_types(id, name, daily_price) values (?,?,?)",
                ROOM_TYPE, "P1.3 Housekeeping Room", 100000);
        jdbc.update("insert into rooms(id, room_type_id, status) values (?,?,?)", ROOM, ROOM_TYPE, "available");
        jdbc.update("insert into rooms(id, room_type_id, status) values (?,?,?)", TECHNICAL_ROOM, ROOM_TYPE, "available");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                GUEST, "P1.3 Guest", "0913010099", "913010000001");
        jdbc.update("insert into reservations(id, guest_id, employee_id, status) values (?,?,?,?)",
                RESERVATION, GUEST, MANAGER, "DA_DAT");
        jdbc.update("insert into housekeeping_checklist_templates(name, active) values (?, true)", TEMPLATE);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from equipment_incidents where reservation_id = ?", RESERVATION);
        jdbc.update("delete from housekeeping_inspections where task_id in (select id from housekeeping_tasks where room_id in (?,?))",
                ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from housekeeping_checklist_results where task_id in (select id from housekeeping_tasks where room_id in (?,?))",
                ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from idempotency_records where command_scope like 'housekeeping-%' and idempotency_key like 'mysql-housekeeping-%'");
        jdbc.update("delete from housekeeping_tasks where room_id in (?,?)", ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from housekeeping_checklist_templates where name = ?", TEMPLATE);
        jdbc.update("delete from reservations where id = ?", RESERVATION);
        jdbc.update("delete from guests where id = ?", GUEST);
        jdbc.update("delete from rooms where id in (?,?)", ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from room_types where id = ?", ROOM_TYPE);
        jdbc.update("delete from employees where id in (?,?)", MANAGER, WORKER);
        SecurityContextHolder.clearContext();
    }

    @Test
    void createsAssignsReadsAndPersistsTheFullLifecycle() {
        as(MANAGER, "ROLE_MANAGER");
        var created = housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM, WORKER, "turnover"), MANAGER,
                "mysql-housekeeping-create-1301");
        assertThat(created.assignee()).isEqualTo(WORKER);
        assertThat(created.status()).isEqualTo("NEEDS_CLEANING");
        assertThat(jdbc.queryForObject("select status from rooms where id = ?", String.class, ROOM)).isEqualTo("cleaning");

        as(WORKER, "ROLE_HOUSEKEEPING");
        assertThat(housekeeping.list(null, null, null, WORKER)).extracting(HousekeepingDtos.Response::id)
                .containsExactly(created.id());
        assertThatThrownBy(() -> housekeeping.list(null, MANAGER, null, WORKER))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null),
                WORKER, "mysql-housekeeping-progress-1301");
        housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("CLEANED", null, null),
                WORKER, "mysql-housekeeping-cleaned-1301");

        var inspection = inspections.add(created.id(), new HousekeepingInspectionDtos.Request(
                HousekeepingInspection.InspectionType.MINIBAR, "water", 2,
                HousekeepingInspection.ItemCondition.REFILLED, "restocked"), WORKER);
        assertThat(inspections.list(created.id())).extracting(HousekeepingInspectionDtos.Response::id)
                .containsExactly(inspection.id());
        checklists.addResult(created.id(), new HousekeepingChecklistDtos.ResultRequest(TEMPLATE, true, null), WORKER);

        as(MANAGER, "ROLE_MANAGER");
        var ready = housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "mysql-housekeeping-ready-1301");
        assertThat(ready.status()).isEqualTo("READY");
        assertThat(ready.checklistComplete()).isTrue();
        assertThat(jdbc.queryForObject("select status from rooms where id = ?", String.class, ROOM)).isEqualTo("available");
        assertThat(housekeeping.list(ROOM, null, HousekeepingTaskStatus.READY, MANAGER)).extracting(HousekeepingDtos.Response::id)
                .containsExactly(created.id());
    }

    @Test
    void readyRequiresPassedChecklistAndRejectsBlockingIncident() {
        as(MANAGER, "ROLE_MANAGER");
        var task = housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM, WORKER, null), MANAGER,
                "mysql-housekeeping-gates-create-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null), MANAGER,
                "mysql-housekeeping-gates-progress-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("CLEANED", null, null), MANAGER,
                "mysql-housekeeping-gates-cleaned-1301");
        inspections.add(task.id(), new HousekeepingInspectionDtos.Request(
                HousekeepingInspection.InspectionType.ROOM_ASSET, "safe", 1,
                HousekeepingInspection.ItemCondition.OK, null), MANAGER);

        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "mysql-housekeeping-gates-ready-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_CHECKLIST_REQUIRED");
        checklists.addResult(task.id(), new HousekeepingChecklistDtos.ResultRequest(TEMPLATE, true, null), MANAGER);
        jdbc.update("insert into equipment_incidents(reservation_id, room_id, equipment_name, original_value, purchased_on, quantity, compensation, severity, handoff_status) values (?,?,?,?,?,?,?,?,?)",
                RESERVATION, ROOM, "safe", 1000, "2025-01-01", 1, 1000, "HIGH", "OPEN");
        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "mysql-housekeeping-gates-ready-blocked-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_CHECKLIST_REQUIRED");
        jdbc.update("update equipment_incidents set handoff_status = 'RESOLVED' where reservation_id = ?", RESERVATION);
        assertThat(housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null), MANAGER,
                "mysql-housekeeping-gates-ready-resolved-1301").status()).isEqualTo("READY");
    }

    @Test
    void technicalHandoffBlocksReadyWhileRoomIsInMaintenance() {
        as(MANAGER, "ROLE_MANAGER");
        var task = housekeeping.create(new HousekeepingDtos.CreateRequest(TECHNICAL_ROOM, WORKER, null), MANAGER,
                "mysql-housekeeping-technical-create-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null),
                MANAGER, "mysql-housekeeping-technical-progress-1301");
        var waiting = housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("WAITING_TECHNICAL", null, null),
                MANAGER, "mysql-housekeeping-technical-waiting-1301");
        assertThat(waiting.status()).isEqualTo("WAITING_TECHNICAL");
        assertThat(jdbc.queryForObject("select status from rooms where id = ?", String.class, TECHNICAL_ROOM)).isEqualTo("maintenance");
        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "mysql-housekeeping-technical-ready-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("INVALID_HOUSEKEEPING_TRANSITION");
    }

    private void as(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor, "", role));
    }
}
