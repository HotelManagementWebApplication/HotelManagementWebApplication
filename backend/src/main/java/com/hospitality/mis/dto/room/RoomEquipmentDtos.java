package com.hospitality.mis.dto.room;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

/** DTO tài sản/thiết bị gắn với một phòng. */
public final class RoomEquipmentDtos {
    /** Namespace không trạng thái cho payload thiết bị phòng. */
    private RoomEquipmentDtos() {}
    /** Request thêm thiết bị; giá trị và số lượng phải dương theo validation. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateRequest(
                                /** Phòng sở hữu thiết bị. */
                                @NotBlank String roomId,
                                /** Tên thiết bị. */
                                @NotBlank String name,
                                /** Giá trị gốc dương của thiết bị. */
                                @NotNull @Positive BigDecimal originalValue,
                                /** Ngày mua. */
                                @NotNull LocalDate purchasedOn,
                                /** Số lượng thiết bị dương. */
                                @Positive int quantity) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record UpdateRequest(@NotBlank String name, @NotNull @Positive BigDecimal originalValue,
                                @NotNull LocalDate purchasedOn, @Positive int quantity, @NotNull Boolean active) {}
    /** Thiết bị đã ghi nhận cùng giá trị gốc, ngày mua, số lượng và cờ hoạt động. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
                           /** Khóa thiết bị. */
                           Long id,
                           /** Phòng sở hữu. */
                           String roomId,
                           /** Tên thiết bị. */
                           String name,
                           /** Giá trị gốc. */
                           BigDecimal originalValue,
                           /** Ngày mua. */
                           LocalDate purchasedOn,
                           /** Số lượng. */
                           int quantity,
                           /** Thiết bị còn được sử dụng hay đã ngừng hoạt động. */
                           boolean active) {}
}
