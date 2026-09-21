package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.*;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.operations.*;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.operations.HousekeepingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HousekeepingReadinessTest {
    @Mock HousekeepingTaskRepository tasks;
    @Mock RoomRepository rooms;
    @Mock AuditService audit;
    @Mock HousekeepingChecklistTemplateRepository templates;
    @Mock HousekeepingChecklistResultRepository results;
    @Mock EquipmentIncidentRepository incidents;
    @Mock DurableIdempotencyService durableIdempotency;
    private HousekeepingService service;
    private HousekeepingTask task;
    private Room room;

    @BeforeEach
    void setUp() {
        service = new HousekeepingService(tasks, rooms, audit, templates, results, incidents,
                Clock.fixed(Instant.parse("2026-09-14T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")), durableIdempotency);
        when(durableIdempotency.execute(anyString(), anyString(), anyString(), anyString(),
                eq(HousekeepingDtos.Response.class), any())).thenAnswer(invocation ->
                ((Supplier<HousekeepingDtos.Response>) invocation.getArgument(5)).get());
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("manager", "", "ROLE_MANAGER"));
        room = new Room(); room.setId("101"); room.setStatus(RoomStatus.CLEANING);
        task = new HousekeepingTask(); ReflectionTestUtils.setField(task, "id", 7L); task.setRoom(room);
        task.setAssignee("manager");
        task.setStatus(HousekeepingTaskStatus.CLEANED);
        when(tasks.findForUpdateById(7L)).thenReturn(Optional.of(task));
        when(rooms.findForUpdate("101")).thenReturn(Optional.of(room));
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void readyRequiresPersistedChecklistResults() {
        var template = template("Bathroom");
        when(templates.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(template));
        when(results.findByTaskIdOrderByIdAsc(7L)).thenReturn(List.of());

        DomainException error = assertThrows(DomainException.class, () -> service.update(7L,
                new HousekeepingDtos.UpdateRequest("READY", null, null), "manager", "hk-ready-missing"));

        assertThat(error.getCode()).isEqualTo("HOUSEKEEPING_CHECKLIST_REQUIRED");
        assertThat(room.getStatus()).isEqualTo(RoomStatus.CLEANING);
        verifyNoInteractions(audit);
    }

    @Test
    void readyRequiresActualPassedResultsAndNoMaintenanceLock() {
        when(templates.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(template("Bathroom")));
        when(results.findByTaskIdOrderByIdAsc(7L)).thenReturn(List.of(result("Bathroom", true)));
        when(incidents.existsByRoomIdAndSeverityInAndHandoffStatusNot(eq("101"), anyList(), eq(IncidentHandoffStatus.RESOLVED)))
                .thenReturn(false);
        room.setStatus(RoomStatus.MAINTENANCE);

        DomainException error = assertThrows(DomainException.class, () -> service.update(7L,
                new HousekeepingDtos.UpdateRequest("READY", null, null), "manager", "hk-ready-maintenance"));
        assertThat(error.getCode()).isEqualTo("ROOM_MAINTENANCE_LOCKED");
    }

    @Test
    void passedChecklistMovesRoomToReady() {
        when(templates.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(template("Bathroom")));
        when(results.findByTaskIdOrderByIdAsc(7L)).thenReturn(List.of(result("Bathroom", true)));
        when(incidents.existsByRoomIdAndSeverityInAndHandoffStatusNot(eq("101"), anyList(), eq(IncidentHandoffStatus.RESOLVED)))
                .thenReturn(false);

        var response = service.update(7L,
                new HousekeepingDtos.UpdateRequest("READY", null, null), "manager", "hk-ready-ok");

        assertThat(response.status()).isEqualTo("READY");
        assertThat(room.getStatus()).isEqualTo(RoomStatus.READY);
    }

    private HousekeepingChecklistTemplate template(String name) {
        var template = new HousekeepingChecklistTemplate(); template.setName(name); return template;
    }
    private HousekeepingChecklistResult result(String item, boolean passed) {
        var result = new HousekeepingChecklistResult(); result.setItem(item); result.setPassed(passed); return result;
    }
}
