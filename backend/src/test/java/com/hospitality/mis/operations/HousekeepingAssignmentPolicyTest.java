package com.hospitality.mis.operations;

import com.hospitality.mis.dao.identity.EmployeeDatabase;
import com.hospitality.mis.dao.operations.HousekeepingTaskDatabase;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import com.hospitality.mis.service.operations.HousekeepingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HousekeepingAssignmentPolicyTest {
    private static final String HR = "HR01";
    private static final String HOUSEKEEPER = "HK01";
    private final LocalDate today = LocalDate.of(2026, 10, 15);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-15T10:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final HousekeepingTaskDatabase database = mock(HousekeepingTaskDatabase.class);
    private final EmployeeService employees = mock(EmployeeService.class);
    private final EmployeeShiftService shifts = mock(EmployeeShiftService.class);
    private final HousekeepingService service = new HousekeepingService(database, employees, shifts, clock);

    @BeforeEach
    void authenticateHr() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(HR, "password", "ROLE_HR"));
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void allowsHousekeepingEmployeeWithMatchingActiveShift() {
        when(employees.findRequired(HOUSEKEEPER)).thenReturn(employee(EmployeeRole.HOUSEKEEPING));
        when(shifts.list(today, today, HOUSEKEEPER)).thenReturn(List.of(shift("AFTERNOON", "ASSIGNED")));
        var expected = new HousekeepingDtos.Response(12L, "101", HOUSEKEEPER, "NEEDS_CLEANING", false, false, null, HR, LocalDateTime.now(clock));
        when(database.create(any(), eq(HR), eq("shift-task-01"), anyString(), any())).thenReturn(expected);

        var result = service.create(new HousekeepingDtos.CreateRequest("101", HOUSEKEEPER, null, today, "AFTERNOON"), HR, "shift-task-01");

        assertThat(result).isEqualTo(expected);
        verify(database).create(any(), eq(HR), eq("shift-task-01"), anyString(), any());
    }

    @Test
    void rejectsWrongRoleOrMissingShiftBeforeCreatingTask() {
        when(employees.findRequired(HOUSEKEEPER)).thenReturn(employee(EmployeeRole.FRONT_DESK));

        assertThatThrownBy(() -> service.create(
                new HousekeepingDtos.CreateRequest("101", HOUSEKEEPER, null, today, "AFTERNOON"), HR, "wrong-role"))
                .hasMessageContaining("Chỉ nhân viên buồng phòng");

        when(employees.findRequired(HOUSEKEEPER)).thenReturn(employee(EmployeeRole.HOUSEKEEPING));
        when(shifts.list(today, today, HOUSEKEEPER)).thenReturn(List.of(shift("MORNING", "COMPLETED")));
        assertThatThrownBy(() -> service.create(
                new HousekeepingDtos.CreateRequest("101", HOUSEKEEPER, null, today, "AFTERNOON"), HR, "wrong-shift"))
                .hasMessageContaining("không có ca");

        verify(database, never()).create(any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void shiftRosterContainsOnlyHousekeepersOnTheLiveShiftAndTheirOpenRooms() {
        when(shifts.list(today, today, null)).thenReturn(List.of(shift("AFTERNOON", "STARTED")));
        when(employees.list(false)).thenReturn(List.of(
                employeeResponse(HOUSEKEEPER, EmployeeRole.HOUSEKEEPING),
                employeeResponse("FD01", EmployeeRole.FRONT_DESK)));
        when(database.list(null, null, null)).thenReturn(List.of(
                task(12L, HOUSEKEEPER, "101", "NEEDS_CLEANING"),
                task(13L, HOUSEKEEPER, "102", "READY"),
                task(14L, "FD01", "103", "NEEDS_CLEANING")));

        var roster = service.shiftAssignments("AFTERNOON", HR);

        assertThat(roster).hasSize(1);
        assertThat(roster.getFirst().employeeId()).isEqualTo(HOUSEKEEPER);
        assertThat(roster.getFirst().rooms()).containsExactly(new HousekeepingDtos.AssignedRoom(12L, "101", "NEEDS_CLEANING"));
    }

    private EmployeeDatabase.Snapshot employee(EmployeeRole role) {
        return new EmployeeDatabase.Snapshot(HOUSEKEEPER, "Nhân viên", "hash", role, "0901234567", null, null,
                false, true, true, 0, null, null, Employee.EmploymentStatus.WORKING, null, null);
    }

    private EmployeeShiftDtos.Response shift(String code, String status) {
        return new EmployeeShiftDtos.Response(3L, HOUSEKEEPER, today, code, today.atTime(14, 0), today.atTime(22, 0), status, HR);
    }

    private EmployeeAdminDtos.Response employeeResponse(String id, EmployeeRole role) {
        return new EmployeeAdminDtos.Response(id, id, "0901234567", null, role, true, true, 0, null, null,
                Employee.EmploymentStatus.WORKING, null, null);
    }

    private HousekeepingDtos.Response task(Long id, String assignee, String room, String status) {
        return new HousekeepingDtos.Response(id, room, assignee, status, false, false, null, HR, LocalDateTime.now(clock));
    }
}