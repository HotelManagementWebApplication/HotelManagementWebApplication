package com.hospitality.mis.dto.reservation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** DTO tối thiểu cho booking online và phạm vi dữ liệu của chính customer. */
public final class CustomerReservationDtos {
    private CustomerReservationDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotNull ReservationDtos.RentalType rentalType,
            String bookingSource,
            @NotEmpty @Valid List<RoomStay> rooms,
            @NotBlank String idempotencyKey) {
        /** Giữ tương thích với các caller Java cũ chưa truyền nguồn đặt phòng. */
        public CreateRequest(ReservationDtos.RentalType rentalType, List<RoomStay> rooms, String idempotencyKey) {
            this(rentalType, "DIRECT", rooms, idempotencyKey);
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomStay(
            @NotBlank String roomId,
            @NotNull LocalDateTime expectedCheckIn,
            @NotNull LocalDateTime expectedCheckOut) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomLine(
            String roomId,
            LocalDateTime expectedCheckIn,
            LocalDateTime expectedCheckOut) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PaymentInstruction(
            String paymentCode,
            BigDecimal amount,
            DepositPaymentStatus status,
            LocalDateTime expiresAt,
            String instruction) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(
            Long id,
            ReservationStatus status,
            ReservationDtos.RentalType rentalType,
            String bookingSource,
            BigDecimal depositAmount,
            LocalDateTime bookedAt,
            List<RoomLine> rooms,
            PaymentInstruction depositPayment) {
        /** Giữ tương thích với các caller Java cũ chưa có nguồn đặt phòng trong response. */
        public Response(Long id, ReservationStatus status, ReservationDtos.RentalType rentalType,
                        BigDecimal depositAmount, LocalDateTime bookedAt, List<RoomLine> rooms,
                        PaymentInstruction depositPayment) {
            this(id, status, rentalType, "DIRECT", depositAmount, bookedAt, rooms, depositPayment);
        }
    }
}
