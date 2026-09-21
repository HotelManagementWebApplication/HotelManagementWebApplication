package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.identity.EmployeeShiftRepository;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeShift;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.*;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeShiftServiceTest {
    @Mock EmployeeShiftRepository shifts;
    @Mock EmployeeRepository employees;
    @Mock AuditService audit;
    private EmployeeShiftService service;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("hr", "test", "ROLE_HR"));
        service = new EmployeeShiftService(shifts, employees, audit,
                Clock.fixed(Instant.parse("2026-09-14T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void assignmentRejectsOverlapWhileEmployeeRowIsLocked() {
        LocalDate date = LocalDate.of(2026, 9, 14);
        LocalDateTime start = date.atTime(8, 0); LocalDateTime end = date.atTime(16, 0);
        Employee employee = new Employee(); employee.setEmployeeId("E01");
        when(employees.findForUpdateByEmployeeId("E01")).thenReturn(Optional.of(employee));
        when(shifts.hasOverlap("E01", start, end, EmployeeShift.Status.CANCELLED)).thenReturn(true);

        DomainException error = assertThrows(DomainException.class, () -> service.assign(
                new EmployeeShiftDtos.Request("E01", date, "AM", start, end), "hr"));

        assertThat(error.getCode()).isEqualTo("SHIFT_OVERLAP");
        verify(shifts, never()).save(any());
    }

    @Test
    void coverageReportsMissingStaff() {
        LocalDate date = LocalDate.of(2026, 9, 14);
        when(shifts.countAvailable(date, "AM", EmployeeShift.Status.CANCELLED,
                Employee.EmploymentStatus.WORKING, Employee.EmploymentStatus.ON_LEAVE))
                .thenReturn(2L);

        var coverage = service.coverage(date, "AM", 4);

        assertThat(coverage.assignedStaff()).isEqualTo(2);
        assertThat(coverage.shortage()).isEqualTo(2);
        assertThat(coverage.understaffed()).isTrue();
    }
}
