package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.operations.TechnicalWorkOrderRepository;
import com.hospitality.mis.dao.room.ReservationOverlapPort;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.*;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class TechnicalWorkOrderWorkflowTest {
    @Mock TechnicalWorkOrderRepository orders;
    @Mock RoomRepository rooms;
    @Mock RoomEquipmentRepository equipment;
    @Mock AuditService audit;
    @Mock HousekeepingTaskRepository housekeepingTasks;
    @Mock ReservationOverlapPort overlaps;
    @Mock EquipmentIncidentRepository incidents;
    @Mock DurableIdempotencyService durableIdempotency;
    private TechnicalWorkOrderService service;
    private TechnicalWorkOrder order;
    private Room room;

    @BeforeEach
    void setUp() {
        service = new TechnicalWorkOrderService(orders, rooms, equipment, audit, housekeepingTasks, overlaps, incidents,
                Clock.fixed(Instant.parse("2026-09-14T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")), durableIdempotency);
        when(durableIdempotency.execute(anyString(), anyString(), anyString(), anyString(),
                eq(TechnicalWorkOrderDtos.Response.class), any())).thenAnswer(invocation ->
                ((Supplier<TechnicalWorkOrderDtos.Response>) invocation.getArgument(5)).get());
        room = new Room(); room.setId("101"); room.setStatus(RoomStatus.MAINTENANCE);
        order = new TechnicalWorkOrder(); ReflectionTestUtils.setField(order, "id", 5L); order.setRoom(room);
        order.setCreatedBy("technical"); order.setAssignee("technical"); order.setStatus(TechnicalWorkOrderStatus.WAITING_ACCEPTANCE);
        when(orders.findForUpdateById(5L)).thenReturn(Optional.of(order));
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("technical", "", "ROLE_TECHNICAL"));
    }

    @Test
    void genericUpdateCannotSelfAccept() {
        DomainException error = assertThrows(DomainException.class, () -> service.update(5L,
                new TechnicalWorkOrderDtos.UpdateRequest("COMPLETED", "done", null, null), "technical", "tech-self-accept"));
        assertThat(error.getCode()).isEqualTo("TECHNICAL_ACCEPTANCE_COMMAND_REQUIRED");
        assertThat(order.getStatus()).isEqualTo(TechnicalWorkOrderStatus.WAITING_ACCEPTANCE);
    }

    @Test
    void managerAcceptanceRecordsIdentityBeforeRelease() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("manager", "", "ROLE_MANAGER"));
        var accepted = service.accept(5L, new TechnicalWorkOrderDtos.AcceptanceRequest("Verified"), "manager", "tech-accept");
        assertThat(accepted.status()).isEqualTo("COMPLETED");
        assertThat(accepted.acceptedBy()).isEqualTo("manager");
        assertThat(accepted.acceptedAt()).isNotNull();
    }

    @Test
    void releaseRequiresNoOverlapAndHousekeepingReadiness() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("technical", "", "ROLE_TECHNICAL"));
        order.setStatus(TechnicalWorkOrderStatus.COMPLETED); order.setAcceptedBy("manager");
        when(rooms.findForUpdate("101")).thenReturn(Optional.of(room));
        when(overlaps.hasOverlap(eq("101"), any(), any())).thenReturn(false);
        HousekeepingTask housekeeping = new HousekeepingTask(); housekeeping.setChecklistComplete(true);
        housekeeping.setBlockingIncident(false);
        housekeeping.setStatus(HousekeepingTaskStatus.WAITING_TECHNICAL);
        when(housekeepingTasks.findFirstByRoomIdOrderByUpdatedAtDesc("101")).thenReturn(Optional.of(housekeeping));
        when(incidents.existsByRoomIdAndSeverityInAndHandoffStatusNot(eq("101"), anyList(), eq(IncidentHandoffStatus.RESOLVED)))
                .thenReturn(false);

        var released = service.release(5L, "technical", "tech-release");

        assertThat(released.status()).isEqualTo("ROOM_RELEASED");
        assertThat(room.getStatus()).isEqualTo(RoomStatus.READY);
    }

    @Test
    void technicalCannotAcceptWorkOrder() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("technical", "", "ROLE_TECHNICAL"));
        DomainException error = assertThrows(DomainException.class, () -> service.accept(5L,
                new TechnicalWorkOrderDtos.AcceptanceRequest("Technical self-accept"), "technical", "tech-self-accept"));
        assertThat(error.getCode()).isEqualTo("TECHNICAL_ACCEPTANCE_FORBIDDEN");
        assertThat(order.getStatus()).isEqualTo(TechnicalWorkOrderStatus.WAITING_ACCEPTANCE);
    }

    @Test
    void managerCannotReleaseWorkOrder() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("manager", "", "ROLE_MANAGER"));
        order.setStatus(TechnicalWorkOrderStatus.COMPLETED);
        order.setAcceptedBy("manager");
        DomainException error = assertThrows(DomainException.class, () -> service.release(5L, "manager", "mgr-release-forbidden"));
        assertThat(error.getCode()).isEqualTo("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN");
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }
}
