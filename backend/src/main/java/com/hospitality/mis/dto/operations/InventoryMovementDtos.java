package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.operations.InventoryMovement;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/** DTO nhật ký nhập, xuất hoặc điều chỉnh tồn kho dịch vụ. */
public final class InventoryMovementDtos {
    /** Namespace cho payload tồn kho. */
    private InventoryMovementDtos() {}
    /** Request ghi nhận một biến động tồn kho. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
                                /** Mã dịch vụ bị thay đổi tồn. */
                                @NotBlank String serviceId,
                                /** Loại biến động theo enum miền. */
                                @NotNull InventoryMovement.MovementType type,
                                /** Số lượng: ADJUST cho phép âm; các loại khác bắt buộc dương. */
                                int quantity,
                                /** Lý do để đối soát. */
                                String reason) {}
    /** Biến động đã ghi nhận cùng tác nhân và thời điểm. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
                           /** Khóa bản ghi biến động. */
                           Long id,
                           /** Mã dịch vụ. */
                           String serviceId,
                           /** Loại biến động. */
                           InventoryMovement.MovementType type,
                           /** Số lượng. */
                           int quantity,
                           /** Tác nhân thực hiện. */
                           String actorId,
                           /** Thời điểm phát sinh. */
                           LocalDateTime occurredAt,
                           /** Lý do. */
                           String reason) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReportResponse(String serviceId, LocalDateTime from, LocalDateTime to, int received,
                                 int issued, int wasted, int returned, int adjusted, int netChange) {}
}
