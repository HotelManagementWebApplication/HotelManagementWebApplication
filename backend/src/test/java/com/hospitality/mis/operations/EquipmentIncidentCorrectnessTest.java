package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.operations.EquipmentIncident;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomEquipment;
import com.hospitality.mis.service.billing.PricingPolicy;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:equipmentincidentcorrectness;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
/** Bảo vệ incident: actor, phòng thuộc reservation và compensation/audit. */
class EquipmentIncidentCorrectnessTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean EquipmentIncidentService httpService;

    /** Mock ports: incident là mutation target, reservation là aggregate lock, audit là side-effect assertion. */
    @Mock EquipmentIncidentRepository incidents;
    @Mock ReservationRepository reservations;
    @Mock AuditService audit;
    @Mock RoomEquipmentRepository equipmentRegistry;
    @Mock NotificationOutboxService notifications;
    @Mock com.hospitality.mis.dao.room.RoomRepository roomRepository;

    @BeforeEach
    /** Đặt actor housekeeping hợp lệ cho các case mutation. */
    void authenticateHousekeeping() {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("housekeeping", "test",
                List.of(new SimpleGrantedAuthority("ROLE_HOUSEKEEPING"))));
        SecurityContextHolder.setContext(context);
    }

    @AfterEach
    /** Dọn SecurityContext sau test. */
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    /** Given phòng occupied thuộc booking, When record, Then save compensation 150 và audit actor. */
    void allowedHousekeepingActorCanRecordIncidentForOccupiedRoomInReservation() {
        Reservation reservation = checkedInReservation("101");
        when(reservations.findForUpdate(9L)).thenReturn(Optional.of(reservation));
        RoomEquipment equipment = equipment("101", "TV", new BigDecimal("1000"), LocalDate.now().minusYears(1), 2);
        ReflectionTestUtils.setField(equipment, "id", 1L);
        when(equipmentRegistry.findByIdAndRoomIdAndActiveTrue(1L, "101")).thenReturn(Optional.of(equipment));
        when(incidents.save(any(EquipmentIncident.class))).thenAnswer(invocation -> {
            EquipmentIncident incident = invocation.getArgument(0);
            ReflectionTestUtils.setField(incident, "id", 44L);
            return incident;
        });

        var service = new EquipmentIncidentService(incidents, reservations, equipmentRegistry,
                new PricingPolicy(3, 20, new BigDecimal("10")), audit);
        ReflectionTestUtils.setField(service, "notifications", notifications);
        var response = service.record(9L,
                new EquipmentIncidentDtos.CreateRequest("101", "TV", 1L, 1, IncidentSeverity.HIGH), "housekeeping", "incident-9");

        assertThat(response.id()).isEqualTo(44L);
        assertThat(response.compensation()).isEqualByComparingTo("1500.00");
        verify(audit).record("housekeeping", "EQUIPMENT_INCIDENT_RECORDED", "RESERVATION", "9",
                null, "1500.00", null);
        verify(notifications).enqueue(eq("EQUIPMENT_INCIDENT"), eq("MANAGER"), anyString(),
                eq("equipment-incident-manager-44"));
    }

    @Test
    /** Given room ngoài booking, When record, Then fail trước save/audit với ROOM_NOT_IN_RESERVATION. */
    void foreignRoomIsRejectedBeforeIncidentMutation() {
        Reservation reservation = checkedInReservation("101");
        when(reservations.findForUpdate(9L)).thenReturn(Optional.of(reservation));

        DomainException exception = assertThrows(DomainException.class,
                () -> new EquipmentIncidentService(incidents, reservations, equipmentRegistry,
                        new PricingPolicy(3, 20, new BigDecimal("10")), audit).record(9L,
                                new EquipmentIncidentDtos.CreateRequest("999", "TV", 1L, 1, null), "housekeeping", "incident-foreign-room"));

        assertThat(exception.getCode()).isEqualTo("ROOM_NOT_IN_RESERVATION");
        verify(incidents, never()).save(any());
        verifyNoInteractions(audit);
    }

    @Test
    /** Given actor request khác authenticated, When record, Then fail trước cả reservation load. */
    void incidentRejectsClientActorThatDiffersFromAuthenticatedActorBeforeReservationLoad() {
        var service = new EquipmentIncidentService(incidents, reservations, equipmentRegistry,
                new PricingPolicy(3, 20, new BigDecimal("10")), audit);

        DomainException exception = assertThrows(DomainException.class,
                () -> service.record(9L,
                        new EquipmentIncidentDtos.CreateRequest("101", "TV", 1L, 1, null), "other", "incident-actor-mismatch"));

        assertThat(exception.getCode()).isEqualTo("ACTOR_MISMATCH");
        verifyNoInteractions(reservations, incidents, equipmentRegistry, audit);
    }

    @Test
    void incidentQueryUsesExplicitFiltersAndReturnsCurrentHandoffIdentity() {
        EquipmentIncident incident = mock(EquipmentIncident.class);
        Reservation reservation = mock(Reservation.class);
        Room room = mock(Room.class);
        when(incident.getId()).thenReturn(44L);
        when(incident.getReservation()).thenReturn(reservation);
        when(reservation.getId()).thenReturn(9L);
        when(incident.getRoom()).thenReturn(room);
        when(room.getId()).thenReturn("101");
        when(incident.getEquipmentName()).thenReturn("TV");
        when(incident.getCompensation()).thenReturn(new BigDecimal("1500.00"));
        when(incident.getSeverity()).thenReturn(IncidentSeverity.HIGH);
        when(incident.getHandoffStatus()).thenReturn(IncidentHandoffStatus.ACKNOWLEDGED);
        when(incident.getHandoffNote()).thenReturn("technical received");
        when(incidents.findForOperations("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED))
                .thenReturn(List.of(incident));

        var service = new EquipmentIncidentService(incidents, reservations, equipmentRegistry,
                new PricingPolicy(3, 20, new BigDecimal("10")), audit);
        var result = service.find("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(44L);
        assertThat(result.get(0).reservationId()).isEqualTo(9L);
        assertThat(result.get(0).handoffStatus()).isEqualTo(IncidentHandoffStatus.ACKNOWLEDGED);
        verify(incidents).findForOperations("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED);
    }

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    void incidentQueryBindsExactCamelCaseParametersAndReturnsExactShape() throws Exception {
        when(httpService.find("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED))
                .thenReturn(List.of(new EquipmentIncidentDtos.Response(44L, 9L, "101", "TV",
                        new BigDecimal("1500.00"), IncidentSeverity.HIGH,
                        IncidentHandoffStatus.ACKNOWLEDGED, "technical received")));

        String body = mockMvc.perform(get("/api/operations/incidents")
                        .param("roomId", "101")
                        .param("reservationId", "9")
                        .param("handoffStatus", "ACKNOWLEDGED"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode response = objectMapper.readTree(body).get(0);
        assertThat(response.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "id", "reservation_id", "room_id", "equipment_name", "compensation", "severity",
                "handoff_status", "handoff_note");
        assertThat(response.get("reservation_id").asLong()).isEqualTo(9L);
        assertThat(response.get("room_id").asText()).isEqualTo("101");
        assertThat(response.get("handoff_status").asText()).isEqualTo("ACKNOWLEDGED");
        verify(httpService).find("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED);
    }

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    void incidentQueryRejectsInvalidTypedParametersAtHttpBoundary() throws Exception {
        mockMvc.perform(get("/api/operations/incidents").param("reservationId", "not-a-number"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/operations/incidents").param("handoffStatus", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(httpService);
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void incidentQueryEnforcesHandoffPermissionBeforeServiceInvocation() throws Exception {
        mockMvc.perform(get("/api/operations/incidents").param("roomId", "101"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(httpService);
    }

    @Test
    void recordRoomIncidentAllowsHousekeepingWithoutReservation() {
        Room room = new Room();
        room.setId("204");
        when(roomRepository.findForUpdate("204")).thenReturn(Optional.of(room));
        when(equipmentRegistry.findByRoomIdAndActiveTrueOrderByNameAsc("204")).thenReturn(List.of());
        when(incidents.save(any(EquipmentIncident.class))).thenAnswer(invocation -> {
            EquipmentIncident incident = invocation.getArgument(0);
            ReflectionTestUtils.setField(incident, "id", 77L);
            return incident;
        });

        var service = new EquipmentIncidentService(incidents, reservations, equipmentRegistry,
                new PricingPolicy(3, 20, new BigDecimal("10")), audit);
        ReflectionTestUtils.setField(service, "rooms", roomRepository);
        ReflectionTestUtils.setField(service, "notifications", notifications);

        var request = new EquipmentIncidentDtos.RoomIncidentRequest("204", "Khóa cửa từ không nhận", null, 1,
                IncidentSeverity.HIGH, "Pin yếu");
        var response = service.recordRoomIncident(request, "housekeeping", "room-incident-key-1");

        assertThat(response.id()).isEqualTo(77L);
        assertThat(response.roomId()).isEqualTo("204");
        assertThat(response.reservationId()).isNull();
        assertThat(response.handoffStatus()).isEqualTo(IncidentHandoffStatus.OPEN);
        assertThat(response.compensation()).isEqualTo(BigDecimal.ZERO);
        verify(audit).record("housekeeping", "EQUIPMENT_INCIDENT_RECORDED", "ROOM", "204",
                null, "Khóa cửa từ không nhận", "Pin yếu");
        verify(notifications).enqueue(eq("EQUIPMENT_INCIDENT"), eq("TECHNICAL"), anyString(),
                eq("room-incident-tech-77"));
    }

    @Test
    @WithMockUser(username = "housekeeping", authorities = {"ROLE_HOUSEKEEPING", "INCIDENT_WRITE"})
    void recordRoomIncidentEndpointPermitsAuthorizedHousekeeping() throws Exception {
        when(httpService.recordRoomIncident(any(), eq("housekeeping"), eq("test-key")))
                .thenReturn(new EquipmentIncidentDtos.Response(77L, null, "204", "Khóa cửa từ không nhận",
                        BigDecimal.ZERO, IncidentSeverity.HIGH, IncidentHandoffStatus.OPEN, "Pin yếu"));

        String requestJson = """
                {
                    "room_id": "204",
                    "equipment_name": "Khóa cửa từ không nhận",
                    "quantity": 1,
                    "severity": "HIGH",
                    "description": "Pin yếu"
                }
                """;

        mockMvc.perform(post("/api/operations/incidents")
                        .header("Idempotency-Key", "test-key")
                        .contentType("application/json")
                        .content(requestJson))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "guest", roles = "GUEST")
    void recordRoomIncidentEndpointDeniesUnauthorizedUsers() throws Exception {
        String requestJson = """
                {
                    "room_id": "204",
                    "equipment_name": "Khóa cửa từ không nhận",
                    "quantity": 1,
                    "severity": "HIGH",
                    "description": "Pin yếu"
                }
                """;

        mockMvc.perform(post("/api/operations/incidents")
                        .header("Idempotency-Key", "test-key")
                        .contentType("application/json")
                        .content(requestJson))
                .andExpect(status().isForbidden());
        verifyNoInteractions(httpService);
    }

    /** Dựng reservation CHECKED_IN với một line OCCUPIED để kiểm tra membership của room. */
    private Reservation checkedInReservation(String roomId) {
        Reservation reservation = new Reservation();
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.transitionTo(ReservationStatus.CHECKED_IN);
        Room room = new Room();
        room.setId(roomId);
        room.setStatus(RoomStatus.OCCUPIED);
        ReservationRoom line = new ReservationRoom();
        line.setRoom(room);
        line.setStatus(RoomStatus.OCCUPIED);
        line.setCheckIn(LocalDateTime.of(2031, 1, 1, 14, 0));
        line.setCheckOut(LocalDateTime.of(2031, 1, 2, 12, 0));
        reservation.addRoom(line);
        return reservation;
    }

    private RoomEquipment equipment(String roomId, String name, BigDecimal value, LocalDate purchasedOn, int quantity) {
        Room room = new Room(); room.setId(roomId);
        RoomEquipment equipment = new RoomEquipment(); equipment.setRoom(room); equipment.setName(name);
        equipment.setOriginalValue(value); equipment.setPurchasedOn(purchasedOn); equipment.setQuantity(quantity);
        return equipment;
    }
}
