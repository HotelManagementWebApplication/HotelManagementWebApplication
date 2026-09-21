package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** DTO lịch bảo trì và trạng thái công việc của phòng. */
public final class MaintenanceDtos {
    /** Namespace không trạng thái cho payload bảo trì. */
    private MaintenanceDtos() {}
    /** Request lập lịch bảo trì cho một phòng; id, phòng, loại và ngày là bắt buộc. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateRequest(
                                /** Mã công việc bảo trì. */
                                @NotBlank String id,
                                /** Phòng cần bảo trì. */
                                @NotBlank String roomId,
                                /** Loại bảo trì. */
                                @NotBlank String type,
                                /** Ngày dự kiến thực hiện. */
                                @NotNull LocalDate scheduledDate,
                                /** Mô tả tùy chọn. */
                                String description) {}
    /** Request chuyển trạng thái công việc bảo trì. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record StatusRequest(
                               /** Trạng thái mới của công việc, không được trống. */
                               @NotBlank String status) {}
    /** Bản ghi bảo trì dùng cho danh sách và màn hình phòng. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
                           /** Mã công việc. */
                           String id,
                           /** Mã phòng. */
                           String roomId,
                           /** Loại bảo trì. */
                           String type,
                           /** Ngày dự kiến. */
                           LocalDate scheduledDate,
                           /** Trạng thái hiện tại. */
                           String status,
                           /** Mô tả. */
                           String description) {}
}
