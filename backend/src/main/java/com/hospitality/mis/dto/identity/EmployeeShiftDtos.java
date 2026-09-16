package com.hospitality.mis.dto.identity;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
public final class EmployeeShiftDtos {
    private EmployeeShiftDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(@NotBlank String employeeId, @NotNull LocalDate shiftDate, @NotBlank String shiftCode,
                          @NotNull LocalDateTime startsAt, @NotNull LocalDateTime endsAt) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, String employeeId, LocalDate shiftDate, String shiftCode, LocalDateTime startsAt,
                           LocalDateTime endsAt, String status, String createdBy) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StatusRequest(@NotBlank String status) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(@NotNull LocalDate shiftDate, @NotBlank String shiftCode,
                                @NotNull LocalDateTime startsAt, @NotNull LocalDateTime endsAt) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CoverageResponse(LocalDate shiftDate, String shiftCode, int minimumStaff, long assignedStaff,
                                   long shortage, boolean understaffed) {}
}
