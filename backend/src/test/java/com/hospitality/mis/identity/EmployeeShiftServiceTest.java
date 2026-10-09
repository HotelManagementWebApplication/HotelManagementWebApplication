package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.identity.EmployeeShiftDatabase;
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
    @Mock EmployeeShiftDatabase shifts;
    private EmployeeShiftService service;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("hr", "test", "ROLE_HR"));
        service = new EmployeeShiftService(shifts,
                Clock.fixed(Instant.parse("2026-09-14T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void assignmentRejectsInvalidDateBeforeCallingDatabase() {
        LocalDate date = LocalDate.of(2026, 9, 14);
        LocalDateTime start = date.atTime(8, 0); LocalDateTime end = date.atTime(16, 0);

        DomainException error = assertThrows(DomainException.class, () -> service.assign(
                new EmployeeShiftDtos.Request("E01", date.plusDays(1), "AM", start, end), "hr"));

        assertThat(error.getCode()).isEqualTo("INVALID_SHIFT_DATE");
        verifyNoInteractions(shifts);
    }

    @Test
    void coverageReportsMissingStaff() {
        LocalDate date = LocalDate.of(2026, 9, 14);
        when(shifts.coverage(date, "AM"))
                .thenReturn(2L);

        var coverage = service.coverage(date, "AM", 4);

        assertThat(coverage.assignedStaff()).isEqualTo(2);
        assertThat(coverage.shortage()).isEqualTo(2);
        assertThat(coverage.understaffed()).isTrue();
    }
}
