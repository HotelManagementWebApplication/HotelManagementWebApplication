package com.hospitality.mis.dto.auth;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.identity.Employee;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class EmployeeAdminDtos {
    private EmployeeAdminDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(String employeeId, String fullName, String phone, String address, EmployeeRole role,
                           boolean enabled, boolean accountNonLocked, int failedLoginAttempts,
                           Instant lastLoginAt, Instant lastFailedLoginAt,
                           Employee.EmploymentStatus employmentStatus,
                           java.time.LocalDate leaveStart, java.time.LocalDate leaveEnd,
                           String email, boolean mustChangePassword) {
        public Response(String employeeId, String fullName, String phone, String address, EmployeeRole role,
                        boolean enabled, boolean accountNonLocked, int failedLoginAttempts,
                        Instant lastLoginAt, Instant lastFailedLoginAt,
                        Employee.EmploymentStatus employmentStatus,
                        java.time.LocalDate leaveStart, java.time.LocalDate leaveEnd) {
            this(employeeId, fullName, phone, address, role, enabled, accountNonLocked, failedLoginAttempts,
                    lastLoginAt, lastFailedLoginAt, employmentStatus, leaveStart, leaveEnd, null, false);
        }
    }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StatusRequest(@NotNull Boolean enabled) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoleRequest(@NotNull EmployeeRole role) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record EmploymentRequest(@NotNull Employee.EmploymentStatus status,
                                    java.time.LocalDate leaveStart, java.time.LocalDate leaveEnd) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record SessionResponse(Long id, String employeeId, Instant issuedAt, Instant expiresAt, Instant revokedAt, String familyId) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LoginEventResponse(Long id, String employeeId, Instant occurredAt, String outcome) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LoginHistoryResponse(java.util.List<LoginEventResponse> items, int page, int size,
                                       long totalElements, int totalPages) {}
}
