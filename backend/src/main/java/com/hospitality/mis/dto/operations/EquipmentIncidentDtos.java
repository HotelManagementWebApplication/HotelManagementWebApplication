package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonNaming;


import jakarta.validation.constraints.*;
import java.math.BigDecimal;

import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;



/** DTO sự cố thiết bị trong phòng và giá trị dùng tính bồi thường. */
public final class EquipmentIncidentDtos {

    /** Namespace không trạng thái cho payload sự cố thiết bị. */
    private EquipmentIncidentDtos() {}

    /** Request tạo sự cố; giá trị và số lượng dương để tính bồi thường. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateRequest(
                                /** Mã phòng nơi xảy ra sự cố. */
                                @NotBlank String roomId,
                                /** Tên thiết bị bị ảnh hưởng. */
                                @NotBlank String equipmentName,
                                /** ID registry; giá/ngày mua luôn được đọc từ registry. */
                                Long equipmentId,
                                /** Số lượng thiết bị bị ảnh hưởng. */
                                @Positive int quantity,
                                IncidentSeverity severity) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record HandoffRequest(@NotNull IncidentHandoffStatus status, String note) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record RoomIncidentRequest(
            @NotBlank String roomId,
            @NotBlank String equipmentName,
            Long equipmentId,
            @Positive Integer quantity,
            IncidentSeverity severity,
            String description) {
        public int resolvedQuantity() { return quantity != null && quantity > 0 ? quantity : 1; }
    }

    /** Kết quả sự cố cùng số tiền bồi thường đã tính. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
                           /** Khóa sự cố. */
                           Long id,
                           /** Mã đặt phòng gắn với sự cố. */
                           Long reservationId,
                           /** Mã phòng. */
                           String roomId,
                           /** Tên thiết bị. */
                           String equipmentName,
                           /** Mức bồi thường đã tính. */
                           BigDecimal compensation, IncidentSeverity severity, IncidentHandoffStatus handoffStatus, String handoffNote) {
        public Response(Long id, String roomId, String equipmentName, BigDecimal compensation) {
            this(id, null, roomId, equipmentName, compensation, IncidentSeverity.MEDIUM, IncidentHandoffStatus.OPEN, null);
        }

    }

}
