package com.hospitality.mis.dto.billing;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.*;

public final class ServiceScheduleDtos {
    private ServiceScheduleDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(@Min(1) int capacity, @NotBlank @Size(max=20) String unit,
            @Min(1) @Max(10080) int minutesPerUnit, @NotBlank String mode,
            @NotNull Boolean consumesStock, @NotBlank @Size(max=255) String reason) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(String serviceId, Integer capacity, String unit, Integer minutesPerUnit,
            String mode, boolean consumesStock) {}
}
