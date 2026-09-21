package com.hospitality.mis.dto.operations;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
public final class HousekeepingChecklistDtos {
    private HousekeepingChecklistDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class) @JsonIgnoreProperties(ignoreUnknown = false) public record TemplateRequest(@NotBlank String name) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class) public record TemplateResponse(Long id, String name, boolean active) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class) @JsonIgnoreProperties(ignoreUnknown = false) public record ResultRequest(@NotBlank String item, @NotNull Boolean passed, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class) public record ResultResponse(Long id, Long taskId, String item, boolean passed, String note, String completedBy, LocalDateTime completedAt) {}
}
