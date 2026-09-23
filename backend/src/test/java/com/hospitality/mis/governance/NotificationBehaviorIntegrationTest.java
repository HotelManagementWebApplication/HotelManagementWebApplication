package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.dao.governance.NotificationOutboxRepository;
import com.hospitality.mis.dao.guest.GuestRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomEquipment;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration proof for transactional outbox scope, polling, delivery and incident routing. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:notification-behavior;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class NotificationBehaviorIntegrationTest {
    @Autowired NotificationOutboxService notifications;
    @Autowired NotificationOutboxRepository outbox;
    @Autowired EquipmentIncidentService incidents;
    @Autowired EquipmentIncidentRepository incidentRepository;
    @Autowired IdempotencyRecordRepository idempotencyRecords;
    @Autowired AuditLogRepository audits;
    @Autowired EmployeeRepository employees;
    @Autowired GuestRepository guests;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired RoomRepository rooms;
    @Autowired RoomEquipmentRepository equipment;
    @Autowired ReservationRepository reservations;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mockMvc;

    @BeforeEach
    void clean() {
        SecurityContextHolder.clearContext();
        jdbc.update("delete from equipment_incidents");
        jdbc.update("delete from notification_outbox");
        jdbc.update("delete from idempotency_records");
        jdbc.update("delete from audit_logs");
        jdbc.update("delete from room_equipment");
        jdbc.update("delete from reservation_rooms");
        jdbc.update("delete from reservations");
        jdbc.update("delete from rooms");
        jdbc.update("delete from room_types");
        jdbc.update("delete from guests");
        jdbc.update("delete from employees");
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void outboxDeduplicatesPollsOnlyJwtAllowedRoleAndLeavesDeliveredEventsOut() {
        var first = notifications.enqueue("TEST_EVENT", "TECHNICAL", "{\"id\":1}", "test-dedupe-1");
        var replay = notifications.enqueue("TEST_EVENT", "TECHNICAL", "{\"id\":1}", "test-dedupe-1");
        notifications.enqueue("TEST_EVENT", "FRONT_DESK", "{\"id\":2}", "test-dedupe-2");

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(notifications.pollForRoles(Set.of("TECHNICAL"), null))
                .extracting(response -> response.recipientRole()).containsExactly("TECHNICAL");
        assertThatThrownBy(() -> notifications.pollForRoles(Set.of("TECHNICAL"), "FRONT_DESK"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("NOTIFICATION_SCOPE_FORBIDDEN");

        var delivered = notifications.markDelivered(first.id());
        assertThat(delivered.status()).isEqualTo("DELIVERED");
        assertThat(delivered.deliveredAt()).isNotNull();
        assertThat(notifications.pollForRoles(Set.of("TECHNICAL"), null)).isEmpty();
        assertThat(outbox.findById(first.id()).orElseThrow().getStatus().name()).isEqualTo("DELIVERED");
    }

    @Test
    void notificationControllerUsesJwtDepartmentScopeForPolling() throws Exception {
        notifications.enqueue("TEST_EVENT", "TECHNICAL", "{\"id\":7}", "http-scope-1");
        notifications.enqueue("TEST_EVENT", "FRONT_DESK", "{\"id\":8}", "http-scope-2");

        mockMvc.perform(get("/api/governance/notifications/outbox")
                        .param("role", "TECHNICAL")
                        .with(jwt().jwt(token -> token.subject("technical-1")
                                .claim("principal_id", "technical-1")
                                .claim("principal_type", "EMPLOYEE"))
                                .authorities(new SimpleGrantedAuthority("ROLE_TECHNICAL"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].recipient_role").value("TECHNICAL"))
                .andExpect(jsonPath("$[1]").doesNotExist());
    }

    @Test
    void highSeverityIncidentWritesOutboxEventsForFrontDeskTechnicalAndManager() {
        jdbc.update("insert into employees(id, full_name, password, position, phone, enabled, account_non_locked, failed_login_attempts, employment_status, must_change_password) values (?,?,?,?,?,?,?,?,?,?)",
                "FD0001", "FD0001", "bcrypt-hash", "FRONT_DESK", "0909000201", true, true, 0, "WORKING", false);
        jdbc.update("insert into guests(id, full_name, phone, identity_number, membership_tier, total_spend, late_cancellation_count, completed_stays, late_checkout_count, booking_blocked, version) values (?,?,?,?,?,?,?,?,?,?,?)",
                910001L, "Incident guest", "0909000202", "IDINCIDENT01", "STANDARD", BigDecimal.ZERO, 0, 0, 0, false, 0L);
        jdbc.update("insert into room_types(id, name, daily_price, hourly_price, room_type_code, max_occupancy, catalog_status) values (?,?,?,?,?,?,?)",
                "INCTYPE", "Incident room", new BigDecimal("100000"), new BigDecimal("10000"), "STD", 2, "ACTIVE");
        jdbc.update("insert into rooms(id, room_type_id, status, version) values (?,?,?,?)",
                "INC01", "INCTYPE", "occupied", 0L);
        jdbc.update("insert into room_equipment(room_id, name, original_value, purchased_on, quantity, active) values (?,?,?,?,?,?)",
                "INC01", "Television", new BigDecimal("2000000"), LocalDate.of(2025, 1, 1), 1, true);
        jdbc.update("insert into reservations(id, guest_id, employee_id, booked_at, deposit_amount, status, rental_type, booking_source, ota_gross_revenue, ota_commission, ota_net_revenue, ota_reconciliation_status, extension_minutes, deposit_payment_status, version) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                910001L, 910001L, "FD0001", LocalDateTime.of(2026, 9, 16, 8, 0), BigDecimal.ZERO,
                "CHECKED_IN", "PACKAGE", "DIRECT", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                "NOT_APPLICABLE", 0, "NOT_REQUIRED", 0L);
        jdbc.update("insert into reservation_rooms(reservation_id, room_id, check_in, check_out, original_check_out, status, transfer_count, guest_count) values (?,?,?,?,?,?,?,?)",
                910001L, "INC01", LocalDateTime.of(2026, 9, 16, 8, 0), LocalDateTime.of(2026, 9, 17, 8, 0),
                LocalDateTime.of(2026, 9, 17, 8, 0), "occupied", 0, 1);
        Long equipmentId = jdbc.queryForObject("select id from room_equipment where room_id = ?", Long.class, "INC01");

        authenticate("FD0001", EmployeeRole.FRONT_DESK);
        incidents.record(910001L, new EquipmentIncidentDtos.CreateRequest(
                "INC01", "Television", equipmentId, 1, IncidentSeverity.HIGH), "FD0001", "incident-routing-1");

        assertThat(notifications.pollForRoles(Set.of("FRONT_DESK"), null)).hasSize(1)
                .singleElement().satisfies(event -> assertThat(event.topic()).isEqualTo("EQUIPMENT_INCIDENT"));
        assertThat(notifications.pollForRoles(Set.of("TECHNICAL"), null)).hasSize(1);
        assertThat(notifications.pollForRoles(Set.of("MANAGER"), null)).hasSize(1);
        assertThat(outbox.findAll()).hasSize(3);
    }

    private static void authenticate(String actor, EmployeeRole role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "test", "ROLE_" + role.name()));
    }
}
