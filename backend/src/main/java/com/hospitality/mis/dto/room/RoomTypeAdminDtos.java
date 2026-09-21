package com.hospitality.mis.dto.room;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Contract quản trị draft/approval của loại phòng. */
public final class RoomTypeAdminDtos {
    private RoomTypeAdminDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(
            @NotBlank @Size(max = 10) String id,
            @NotBlank @Size(max = 50) String name,
            @NotNull @DecimalMin("0.00") BigDecimal dailyPrice,
            @Size(max = 500) String description,
            @DecimalMin("0.01") BigDecimal area,
            @Size(max = 100) String view,
            @DecimalMin("0.00") BigDecimal hourlyPrice,
            @Size(max = 100) String bedType) {
        /** Giữ tương thích cho các caller nội bộ cũ trong khi metadata mới là tùy chọn. */
        public Request(String id, String name, BigDecimal dailyPrice, String description) {
            this(id, name, dailyPrice, description, null, null, BigDecimal.ZERO, null);
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(String id, String name, BigDecimal dailyPrice, String description,
                           BigDecimal area, String view, BigDecimal hourlyPrice, String bedType,
                           RoomTypeCatalogStatus catalogStatus, String updatedBy, String approvedBy,
                           LocalDateTime updatedAt, LocalDateTime approvedAt,
                           String revisionOfId, String supersededById) {
        public static Response from(RoomType type) {
            return new Response(type.getId(), type.getName(), type.getDailyPrice(), type.getDescription(),
                    type.getArea(), type.getView(), type.getHourlyPrice(), type.getBedType(),
                    type.getCatalogStatus(), type.getCatalogUpdatedBy(), type.getCatalogApprovedBy(),
                    type.getCatalogUpdatedAt(), type.getCatalogApprovedAt(),
                    type.getRevisionOfId(), type.getSupersededById());
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PriceHistoryResponse(Long id, String roomTypeId, BigDecimal dailyPrice,
                                       String changedBy, Long approvalId, LocalDateTime effectiveAt) {}
}
