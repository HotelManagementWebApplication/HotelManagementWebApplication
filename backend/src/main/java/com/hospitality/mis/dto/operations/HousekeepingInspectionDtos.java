package com.hospitality.mis.dto.operations;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDateTime;
public final class HousekeepingInspectionDtos {
    private HousekeepingInspectionDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Request(@NotNull HousekeepingInspection.InspectionType inspectionType, @NotBlank String item,
                          @PositiveOrZero int quantity, @NotNull HousekeepingInspection.ItemCondition itemCondition, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, Long taskId, HousekeepingInspection.InspectionType inspectionType, String item,
                           int quantity, HousekeepingInspection.ItemCondition itemCondition, String note,
                           String completedBy, LocalDateTime completedAt) {
        public static Response from(HousekeepingInspection item) { return new Response(item.getId(), item.getTask().getId(), item.getInspectionType(), item.getItem(), item.getQuantity(), item.getItemCondition(), item.getNote(), item.getCompletedBy(), item.getCompletedAt()); }
    }
}
