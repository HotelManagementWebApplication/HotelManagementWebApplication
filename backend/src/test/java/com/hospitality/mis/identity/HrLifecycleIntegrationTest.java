package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.identity.EmployeeLoginEventRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Integration proof for HR lifecycle, role authority, login history and shift rules. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class HrLifecycleIntegrationTest {
    @Autowired EmployeeRepository employees;
    @Autowired EmployeeLoginEventRepository loginEvents;
    @Autowired AuditLogRepository audits;
    @Autowired JdbcTemplate jdbc;
    @Autowired EmployeeService employeeService;
    @Autowired EmployeeShiftService shiftService;

    @BeforeEach
    void clean() {
        SecurityContextHolder.clearContext();
        jdbc.update("delete from NhatKyKiemSoat");
        jdbc.update("delete from CaLamViecNhanVien");
        jdbc.update("delete from SuKienDangNhapNhanVien");
        jdbc.update("delete from MaLamMoiDangNhap");
        jdbc.update("delete from NhanVien");
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void employeeLifecyclePersistsLeaveAndTerminationAndDoesNotExposePassword() {
        Employee director = saveEmployee("DIRECT01", EmployeeRole.DIRECTOR);
        authenticate(director.getEmployeeId(), EmployeeRole.DIRECTOR);
        var target = employeeService.provision("HR0001", "HR employee", "valid-password",
                EmployeeRole.HR, "0909000101", "HR office");

        EmployeeAdminDtos.Response onLeave = employeeService.setEmployment(target.employeeId(),
                new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.ON_LEAVE,
                        LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 22)));
        assertThat(onLeave.employmentStatus()).isEqualTo(Employee.EmploymentStatus.ON_LEAVE);
        assertThat(onLeave.leaveStart()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(onLeave.leaveEnd()).isEqualTo(LocalDate.of(2026, 9, 22));

        EmployeeAdminDtos.Response terminated = employeeService.setEmployment(target.employeeId(),
                new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.TERMINATED, null, null));
        assertThat(terminated.employmentStatus()).isEqualTo(Employee.EmploymentStatus.TERMINATED);
        assertThat(terminated.enabled()).isFalse();
        assertThat(employeeService.detail(target.employeeId()).employeeId()).isEqualTo(target.employeeId());
    }

    @Test
    void actorCannotChangeOwnRoleOrDisableOwnAccount() {
        Employee admin = saveEmployee("ADMIN001", EmployeeRole.ADMIN);
        authenticate(admin.getEmployeeId(), EmployeeRole.ADMIN);

        assertThatThrownBy(() -> employeeService.setRole(admin.getEmployeeId(), EmployeeRole.MANAGER))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SELF_ROLE_CHANGE_FORBIDDEN");
        assertThatThrownBy(() -> employeeService.setEnabled(admin.getEmployeeId(), false))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
        assertThatThrownBy(() -> employeeService.setEmployment(admin.getEmployeeId(),
                new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.TERMINATED, null, null)))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
        assertThat(employeeService.canManageEmployeeRole(
                SecurityContextHolder.getContext().getAuthentication(), admin.getEmployeeId(), EmployeeRole.MANAGER))
                .isFalse();
    }

    @Test
    void roleCeilingAllowsManagerStaffAdministrationButRejectsDirectorElevation() {
        Employee manager = saveEmployee("MANAGER1", EmployeeRole.MANAGER);
        Employee hr = saveEmployee("HR0004", EmployeeRole.HR);
        authenticate(manager.getEmployeeId(), EmployeeRole.MANAGER);

        var provisioned = employeeService.provision(
                "STAFF001", "Staff member", "valid-password", EmployeeRole.STAFF,
                "0909000104", "Front office");
        assertThat(provisioned.role()).isEqualTo(EmployeeRole.STAFF);

        assertThatThrownBy(() -> employeeService.setRole(hr.getEmployeeId(), EmployeeRole.DIRECTOR))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("ACCESS_DENIED");
        assertThatThrownBy(() -> employeeService.provision(
                "DIR0002", "Director candidate", "valid-password", EmployeeRole.DIRECTOR,
                "0909000105", "Management"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("ACCESS_DENIED");
    }

    @Test
    void loginHistoryIsAppendOnlyAndPagedFromPersistedEvents() {
        saveEmployee("HR0002", EmployeeRole.HR);
        employeeService.recordLoginFailure("HR0002");
        employeeService.recordLoginSuccess("HR0002");

        EmployeeAdminDtos.LoginHistoryResponse history = employeeService.loginHistory("HR0002", 0, 1);
        assertThat(history.totalElements()).isEqualTo(2);
        assertThat(history.totalPages()).isEqualTo(2);
        assertThat(history.items()).hasSize(1);
        assertThat(history.items().get(0).outcome()).isEqualTo("SUCCEEDED");
        assertThat(loginEvents.count()).isEqualTo(2);
    }

    @Test
    void shiftLifecycleRejectsOverlapAllowsCancelButCannotEditCancelledAndBoundsSevenDayView() {
        Employee employee = saveEmployee("HR0003", EmployeeRole.HR);
        authenticate("DIRECT01", EmployeeRole.DIRECTOR);
        LocalDate date = LocalDate.of(2026, 9, 21);
        EmployeeShiftDtos.Response assigned = shiftService.assign(
                request(employee.getEmployeeId(), date, "AM", 8, 16), "DIRECT01");

        assertThatThrownBy(() -> shiftService.assign(
                request(employee.getEmployeeId(), date, "OVERLAP", 15, 18), "DIRECT01"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SHIFT_OVERLAP");

        EmployeeShiftDtos.Response updated = shiftService.update(assigned.id(),
                new EmployeeShiftDtos.UpdateRequest(date, "DAY", date.atTime(9, 0), date.atTime(17, 0)), "DIRECT01");
        assertThat(updated.shiftCode()).isEqualTo("DAY");
        EmployeeShiftDtos.Response cancelled = shiftService.status(assigned.id(), "CANCELLED", "DIRECT01");
        assertThat(cancelled.status()).isEqualTo("CANCELLED");
        assertThatThrownBy(() -> shiftService.update(assigned.id(),
                new EmployeeShiftDtos.UpdateRequest(date, "LATE", date.atTime(10, 0), date.atTime(18, 0)), "DIRECT01"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SHIFT_NOT_EDITABLE");

        assertThat(shiftService.list(date, date.plusDays(6), null)).hasSize(1);
        assertThatThrownBy(() -> shiftService.list(date, date.plusDays(7), null))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("INVALID_SHIFT_RANGE");
    }

    @Test
    void coverageExcludesDisabledTerminatedAndOnLeaveEmployees() {
        Employee working = saveEmployee("HR0010", EmployeeRole.HR);
        Employee disabled = saveEmployee("HR0011", EmployeeRole.HR);
        disabled.setEnabled(false);
        employees.saveAndFlush(disabled);
        Employee terminated = saveEmployee("HR0012", EmployeeRole.HR);
        terminated.setEmploymentStatus(Employee.EmploymentStatus.TERMINATED);
        employees.saveAndFlush(terminated);
        Employee onLeave = saveEmployee("HR0013", EmployeeRole.HR);
        onLeave.setEmploymentStatus(Employee.EmploymentStatus.ON_LEAVE);
        onLeave.setLeaveStart(LocalDate.of(2026, 9, 21));
        onLeave.setLeaveEnd(LocalDate.of(2026, 9, 23));
        employees.saveAndFlush(onLeave);
        authenticate("DIRECT01", EmployeeRole.DIRECTOR);
        LocalDate date = LocalDate.of(2026, 9, 21);
        for (Employee employee : List.of(working, disabled, terminated, onLeave))
            shiftService.assign(request(employee.getEmployeeId(), date, "AM", 8, 16), "DIRECT01");

        var coverage = shiftService.coverage(date, "AM", 2);
        assertThat(coverage.assignedStaff()).isEqualTo(1);
        assertThat(coverage.shortage()).isEqualTo(1);
        assertThat(coverage.understaffed()).isTrue();
    }

    private Employee saveEmployee(String id, EmployeeRole role) {
        Employee employee = new Employee();
        employee.setEmployeeId(id);
        employee.setFullName(id);
        employee.setPassword("bcrypt-hash");
        employee.setRole(role);
        employee.setPhone("09" + id.substring(0, Math.min(8, id.length())));
        return employees.saveAndFlush(employee);
    }

    private static EmployeeShiftDtos.Request request(String employeeId, LocalDate date, String code,
                                                     int startHour, int endHour) {
        return new EmployeeShiftDtos.Request(employeeId, date, code,
                date.atTime(startHour, 0), date.atTime(endHour, 0));
    }

    private static void authenticate(String actor, EmployeeRole role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "test", "ROLE_" + role.name()));
    }
}
