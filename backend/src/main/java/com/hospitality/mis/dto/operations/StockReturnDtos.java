package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public final class StockReturnDtos {
    private StockReturnDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(@NotBlank @Size(max=10) String serviceId, @Min(1) int quantity,
                                @Size(max=10) String roomId, @NotBlank @Size(max=255) String reason) {}
    public record DecisionRequest(@Size(max=255) String reason) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(long id, String serviceId, String serviceName, String unit, int quantity,
                           String roomId, String requester, String reason, String status,
                           String approver, String decisionReason, LocalDateTime requestedAt, LocalDateTime decidedAt) {}
}
