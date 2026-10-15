package com.hospitality.mis.dto.identity;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.identity.EmployeeRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

/** Personnel records never accept credentials, account status or permission changes. */
public final class PersonnelDtos {
    private PersonnelDtos() {}
    public enum Gender { MALE, FEMALE, OTHER, UNDISCLOSED }
    public enum ContractType { PROBATION, PERMANENT, FIXED_TERM, SEASONAL }
    public enum Status { DRAFT, PENDING, NEEDS_REVISION, REJECTED, APPROVED }
    public enum Decision { APPROVE, REQUEST_REVISION, REJECT }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Details(
        @NotBlank @Size(min=2,max=100) String fullName,
        @Size(max=25) String phone,
        @Email @Size(max=150) String email,
        @Size(max=255) String address,
        Gender gender,
        @Past LocalDate birthDate,
        @Pattern(regexp="(?:[0-9]{9}|[0-9]{12})?", message="Giấy tờ phải gồm 9 hoặc 12 chữ số") String identityNumber,
        LocalDate hireDate,
        ContractType contractType) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Profile(String employeeId, EmployeeRole role, String employmentStatus, boolean enabled,
                          Details details, long version, Instant updatedAt, String updatedBy) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ProfileUpdate(@NotNull @Valid Details details, @PositiveOrZero long version,
                                @NotBlank @Size(max=500) String reason) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Onboarding(String id, Details details, EmployeeRole proposedRole, String reason,
                             Status status, String requester, String reviewer, String decisionReason,
                             String employeeId, long version, Instant createdAt, Instant submittedAt,
                             Instant decidedAt, boolean canEdit, boolean canReview) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Draft(@NotNull @Valid Details details, @NotNull EmployeeRole proposedRole,
                        @NotBlank @Size(max=500) String reason, @PositiveOrZero long version) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Submit(@PositiveOrZero long version) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Review(@NotNull Decision decision, @NotBlank @Size(max=500) String reason,
                         @PositiveOrZero long version) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReviewResult(Onboarding request, String temporaryPassword) {}
}
