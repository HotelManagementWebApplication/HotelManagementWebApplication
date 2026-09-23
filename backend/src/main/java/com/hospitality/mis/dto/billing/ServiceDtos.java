package com.hospitality.mis.dto.billing;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;


import jakarta.validation.constraints.NotBlank;

import jakarta.validation.constraints.NotNull;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;



/** DTO quản lý dịch vụ bán thêm và tồn kho; JSON dùng tên trường snake_case. */
public final class ServiceDtos {

    /** Namespace không trạng thái cho các payload dịch vụ. */
    private ServiceDtos() {}

    /** Dữ liệu tạo dịch vụ và mức tồn kho ban đầu. Các annotation áp dụng validation ở biên API. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
                                /** Mã dịch vụ duy nhất. */
                                @NotBlank String id,
                                /** Tên hiển thị của dịch vụ. */
                                @NotBlank String name,
                                /** Đơn giá không âm. */
                                @NotNull @PositiveOrZero BigDecimal price,

                                /** Đơn vị tính, có thể bỏ trống. */
                                String unit,
                                /** Tồn đầu kỳ không âm. */
                                @PositiveOrZero int openingStock,
                                /** Ngưỡng cảnh báo tồn thấp không âm. */
                                @PositiveOrZero int safetyThreshold,
                                @Size(max = 50) String category,
                                @Size(max = 1000) String description,
                                @Size(max = 500) String imageUrl) {
        /** Giữ tương thích cho các caller nội bộ cũ; public metadata có thể bổ sung sau. */
        public CreateRequest(String id, String name, BigDecimal price, String unit,
                             int openingStock, int safetyThreshold) {
            this(id, name, price, unit, openingStock, safetyThreshold, null, null, null);
        }
    }

    /** Request thay đổi tồn kho; quantity phải là số không âm và không được null. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StockRequest(
                               /** Số lượng tồn/điều chỉnh được endpoint áp dụng. */
                               @NotNull @PositiveOrZero Integer quantity) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PriceChangeRequest(@NotNull @PositiveOrZero BigDecimal price, @NotBlank String reason) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PriceHistoryResponse(Long id, String serviceId, BigDecimal price, String changedBy,
                                       Long approvalId, LocalDateTime effectiveAt) {}

    /** Trạng thái dịch vụ để hiển thị giá, tồn kho và cảnh báo tồn thấp. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
                           /** Mã dịch vụ. */
                           String id,
                           /** Tên dịch vụ. */
                           String name,
                           /** Đơn giá hiện tại. */
                           BigDecimal price,
                           /** Đơn vị tính. */
                           String unit,
                           String category,
                           String description,
                           String imageUrl,
                           /** Tồn kho hiện tại. */
                           int stock,
                           /** Ngưỡng cảnh báo tồn thấp. */
                           int safetyThreshold,

                           /** Có đang ở dưới hoặc bằng ngưỡng cảnh báo hay không. */
                           boolean lowStock,
                           boolean active) {}

}
