package com.hospitality.mis.service.identity;





import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;

import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.identity.EmployeeLoginEventRepository;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.auth.RefreshTokenRepository;
import com.hospitality.mis.entity.auth.RefreshToken;

import com.hospitality.mis.entity.identity.Employee;

import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.identity.EmployeeLoginEvent;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;


/** Các ca sử dụng của ứng dụng thuộc ranh giới danh tính. */

@Service

public class EmployeeService {
    /** Ngưỡng khóa tài khoản sau số lần đăng nhập thất bại liên tiếp. */
    private static final int MAX_FAILED_LOGIN_ATTEMPTS = 5;
    /** Độ dài mật khẩu tối thiểu theo hợp đồng xác thực. */
    private static final int MIN_PASSWORD_LENGTH = 8;
    /** Độ dài tối đa tương thích với BCrypt. */
    private static final int MAX_PASSWORD_LENGTH = 72;
    /** Kho nhân viên, gồm các truy vấn có khóa cho bộ đếm đăng nhập. */
    private final EmployeeRepository employees;
    /** Kho tài khoản khách, dùng để kiểm tra trùng số điện thoại. */
    private final CustomerAccountRepository customerAccounts;

    /** Mã hóa mật khẩu trước khi lưu. */
    private final PasswordEncoder passwordEncoder;
    /** Ghi audit đăng nhập nếu được cấu hình. */
    private final AuditService audit;
    private final RefreshTokenRepository refreshTokens;
    private EmployeeLoginEventRepository loginEvents;
    private java.time.Clock clock = java.time.Clock.systemUTC();

    public EmployeeService(EmployeeRepository employees, CustomerAccountRepository customerAccounts,
                           PasswordEncoder passwordEncoder, AuditService audit) {
        this(employees, customerAccounts, passwordEncoder, audit, null);
    }
    @org.springframework.beans.factory.annotation.Autowired
    public EmployeeService(EmployeeRepository employees, CustomerAccountRepository customerAccounts,
                           PasswordEncoder passwordEncoder, AuditService audit, RefreshTokenRepository refreshTokens) {
        this.employees = employees;
        this.customerAccounts = customerAccounts;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.refreshTokens = refreshTokens;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setLoginHistory(EmployeeLoginEventRepository loginEvents, java.time.Clock clock) {
        this.loginEvents = loginEvents;
        this.clock = clock;
    }



    @Transactional

    /** Tạo nhân viên sau khi kiểm tra quyền, mật khẩu và số điện thoại duy nhất. */
    public Employee provision(String employeeId, String fullName, String rawPassword,

                              EmployeeRole role, String phone, String address) {
        if (role == null) {
            throw new DomainException("POSITION_REQUIRED", "Phải chọn chức vụ nhân viên");

        }

        requireCurrentActorCanManage(role);

        if (!validPassword(rawPassword)) {
            throw new DomainException("PASSWORD_REQUIRED", "Phải cung cấp mật khẩu mới");
        }

        if (employees.existsById(employeeId)) {

            throw new DomainException("EMPLOYEE_EXISTS", "Mã nhân viên đã tồn tại");

        }

        String normalizedPhone = PhoneNumberNormalizer.normalize(phone);
        if (employees.existsByPhone(normalizedPhone) || customerAccounts.existsByPhone(normalizedPhone)) {
            throw new DomainException("PHONE_ALREADY_IN_USE", "Số điện thoại đã được sử dụng");
        }

        Employee employee = new Employee();
        employee.setEmployeeId(employeeId);
        employee.setFullName(fullName);
        employee.setPassword(passwordEncoder.encode(rawPassword));
        employee.setRole(role);
        employee.setPhone(normalizedPhone);
        employee.setAddress(address);
        return employees.save(employee);

    }



    @Transactional(readOnly = true)

    /** Tải nhân viên bắt buộc, dùng cho các luồng cần entity hiện hữu. */
    public Employee findRequired(String employeeId) {

        return employees.findById(employeeId)

                .orElseThrow(() -> new DomainException("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));

    }

    @Transactional(readOnly = true)
    public List<EmployeeAdminDtos.Response> list(boolean includeInactive) {
        return employees.findAll().stream().filter(x -> includeInactive || x.isEnabled()).map(this::toAdminResponse).toList();
    }

    @Transactional(readOnly = true)
    public EmployeeAdminDtos.Response detail(String employeeId) { return toAdminResponse(findRequired(employeeId)); }

    @Transactional
    public EmployeeAdminDtos.Response setEnabled(String employeeId, boolean enabled) {
        Employee employee = findRequired(employeeId);
        requireCurrentActorCanManage(employee.getRole());
        employee.setEnabled(enabled);
        audit.record(SecurityActor.currentActor(), enabled ? "EMPLOYEE_ENABLED" : "EMPLOYEE_DISABLED",
                "EMPLOYEE", employeeId, String.valueOf(!enabled), String.valueOf(enabled), null);
        return toAdminResponse(employees.save(employee));
    }

    @Transactional(readOnly = true)
    public List<EmployeeAdminDtos.SessionResponse> sessions(String employeeId) {
        findRequired(employeeId);
        if (refreshTokens == null) return List.of();
        return refreshTokens.findByEmployeeIdOrderByIssuedAtDesc(employeeId).stream().map(this::toSession).toList();
    }

    @Transactional
    public void revokeSession(String employeeId, Long sessionId) {
        Employee target = findRequired(employeeId);
        requireCurrentActorCanManage(target.getRole());
        if (refreshTokens == null) return;
        RefreshToken token = refreshTokens.findById(sessionId)
                .orElseThrow(() -> new DomainException("SESSION_NOT_FOUND", "Không tìm thấy phiên đăng nhập"));
        if (!employeeId.equals(token.getEmployeeId())) throw new DomainException("SESSION_NOT_FOUND", "Không tìm thấy phiên đăng nhập");
        if (token.getRevokedAt() == null) token.revoke(Instant.now(), null);
        refreshTokens.save(token);
        audit.record(SecurityActor.currentActor(), "EMPLOYEE_SESSION_REVOKED", "EMPLOYEE_SESSION", String.valueOf(sessionId), null, employeeId, null);
    }

    private EmployeeAdminDtos.SessionResponse toSession(RefreshToken token) {
        return new EmployeeAdminDtos.SessionResponse(token.getId(), token.getEmployeeId(), token.getIssuedAt(), token.getExpiresAt(), token.getRevokedAt(), token.getFamilyId());
    }

    private EmployeeAdminDtos.Response toAdminResponse(Employee e) {
        return new EmployeeAdminDtos.Response(e.getEmployeeId(), e.getFullName(), e.getPhone(), e.getAddress(), e.getRole(),
                e.isEnabled(), e.isAccountNonLocked(), e.getFailedLoginAttempts(), e.getLastLoginAt(), e.getLastFailedLoginAt(),
                e.getEmploymentStatus(), e.getLeaveStart(), e.getLeaveEnd());
    }

    @Transactional
    public EmployeeAdminDtos.Response setEmployment(String employeeId, EmployeeAdminDtos.EmploymentRequest request) {
        Employee employee = employees.findForUpdateByEmployeeId(employeeId)
                .orElseThrow(() -> new DomainException("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));
        requireCurrentActorCanManage(employee.getRole());
        if (request.status() == Employee.EmploymentStatus.ON_LEAVE) {
            if (request.leaveStart() == null || request.leaveEnd() == null || request.leaveEnd().isBefore(request.leaveStart()))
                throw new DomainException("INVALID_LEAVE_PERIOD", "Nghỉ phép phải có khoảng ngày hợp lệ");
        } else if (request.leaveStart() != null || request.leaveEnd() != null) {
            throw new DomainException("INVALID_LEAVE_PERIOD", "Chỉ trạng thái ON_LEAVE được khai báo ngày nghỉ");
        }
        Employee.EmploymentStatus before = employee.getEmploymentStatus();
        employee.setEmploymentStatus(request.status());
        employee.setLeaveStart(request.status() == Employee.EmploymentStatus.ON_LEAVE ? request.leaveStart() : null);
        employee.setLeaveEnd(request.status() == Employee.EmploymentStatus.ON_LEAVE ? request.leaveEnd() : null);
        if (request.status() == Employee.EmploymentStatus.TERMINATED) employee.setEnabled(false);
        audit.record(SecurityActor.currentActor(), "EMPLOYEE_EMPLOYMENT_CHANGED", "EMPLOYEE", employeeId,
                before.name(), request.status().name(), null);
        return toAdminResponse(employees.save(employee));
    }

    @Transactional(readOnly = true)
    public EmployeeAdminDtos.LoginHistoryResponse loginHistory(String employeeId, int page, int size) {
        findRequired(employeeId);
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(100, size));
        if (loginEvents == null) return new EmployeeAdminDtos.LoginHistoryResponse(List.of(), safePage, safeSize, 0, 0);
        var result = loginEvents.findByEmployeeEmployeeId(employeeId,
                org.springframework.data.domain.PageRequest.of(safePage, safeSize,
                        org.springframework.data.domain.Sort.by("occurredAt").descending()));
        return new EmployeeAdminDtos.LoginHistoryResponse(result.getContent().stream().map(event ->
                new EmployeeAdminDtos.LoginEventResponse(event.getId(), employeeId, event.getOccurredAt(),
                        event.getOutcome().name())).toList(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }



    @Transactional

    /** Đặt lại mật khẩu và mở khóa tài khoản theo quyền quản lý chức vụ. */
    public Employee resetPassword(String employeeId, String rawPassword) {
        Employee employee = employees.findById(employeeId)
                .orElseThrow(() -> new DomainException("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));

        requireCurrentActorCanManage(employee.getRole());

        if (!validPassword(rawPassword)) {
            throw new DomainException("PASSWORD_REQUIRED", "Phải cung cấp mật khẩu mới");
        }

        employee.setPassword(passwordEncoder.encode(rawPassword));
        employee.unlockAfterPasswordReset();
        return employees.save(employee);
    }

    @Transactional
    /** Khóa bản ghi nhân viên, tăng bộ đếm lỗi và khóa khi đạt ngưỡng. */
    public void recordLoginFailure(String employeeId) {
        employees.findForUpdateByEmployeeId(employeeId).ifPresent(employee -> {
            Instant occurredAt = clock.instant();
            employee.recordLoginFailure(occurredAt, MAX_FAILED_LOGIN_ATTEMPTS);
            employees.save(employee);
            appendLoginEvent(employee, occurredAt, EmployeeLoginEvent.Outcome.FAILED);
            if (audit != null) audit.record(employeeId, "LOGIN_FAILED", "EMPLOYEE", employeeId, null,
                    String.valueOf(employee.getFailedLoginAttempts()), "Invalid credentials");
        });
    }

    @Transactional
    /** Khóa bản ghi nhân viên, xóa bộ đếm lỗi và ghi nhận đăng nhập thành công. */
    public void recordLoginSuccess(String employeeId) {
        employees.findForUpdateByEmployeeId(employeeId).ifPresent(employee -> {
            Instant occurredAt = clock.instant();
            employee.recordLoginSuccess(occurredAt);
            employees.save(employee);
            appendLoginEvent(employee, occurredAt, EmployeeLoginEvent.Outcome.SUCCEEDED);
            if (audit != null) audit.record(employeeId, "LOGIN_SUCCEEDED", "EMPLOYEE", employeeId, null, null, null);
        });
    }

    private void appendLoginEvent(Employee employee, Instant occurredAt, EmployeeLoginEvent.Outcome outcome) {
        if (loginEvents == null) return;
        EmployeeLoginEvent event = new EmployeeLoginEvent();
        event.setEmployee(employee); event.setOccurredAt(occurredAt); event.setOutcome(outcome);
        loginEvents.save(event);
    }

    /** Kiểm tra mật khẩu không trắng và nằm trong biên độ hệ thống. */
    private boolean validPassword(String password) {
        return password != null && !password.isBlank()
                && password.length() >= MIN_PASSWORD_LENGTH
                && password.length() <= MAX_PASSWORD_LENGTH;
    }

    /** Xác định authentication có được quản lý chức vụ mục tiêu không. */
    public boolean canManageRole(Authentication authentication, EmployeeRole targetRole) {
        EmployeeRole actorRole = roleOf(authentication);
        return actorRole != null && actorRole.canManage(targetRole);
    }

    /** Kiểm tra quyền reset theo chức vụ của nhân viên mục tiêu. */
    public boolean canResetEmployee(Authentication authentication, String employeeId) {
        Employee employee = employees.findById(employeeId).orElse(null);
        return employee == null || canManageRole(authentication, employee.getRole());
    }

    public boolean canManageEmployeeRole(Authentication authentication, String employeeId, EmployeeRole targetRole) {
        Employee employee = employees.findById(employeeId).orElse(null);
        return employee != null && canManageRole(authentication, employee.getRole()) && canManageRole(authentication, targetRole);
    }

    @Transactional
    public EmployeeAdminDtos.Response setRole(String employeeId, EmployeeRole role) {
        Employee employee = findRequired(employeeId);
        requireCurrentActorCanManage(employee.getRole());
        requireCurrentActorCanManage(role);
        EmployeeRole before = employee.getRole();
        employee.setRole(role);
        audit.record(SecurityActor.currentActor(), "EMPLOYEE_ROLE_CHANGED", "EMPLOYEE", employeeId,
                before.name(), role.name(), null);
        return toAdminResponse(employees.save(employee));
    }

    /** Bắt buộc actor đã xác thực có quyền quản lý chức vụ mục tiêu. */
    private void requireCurrentActorCanManage(EmployeeRole targetRole) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!canManageRole(authentication, targetRole)) {
            throw new DomainException("ACCESS_DENIED", "Không được quản lý chức vụ nhân viên này");
        }
        SecurityActor.currentPrincipal();
    }

    /** Ánh xạ authority ROLE_* của authentication sang enum chức vụ. */
    private EmployeeRole roleOf(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return null;
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .map(this::parseRole)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    /** Phân tích tên role, trả null cho authority không thuộc enum nhân viên. */
    private EmployeeRole parseRole(String role) {
        try {
            return EmployeeRole.valueOf(role);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
