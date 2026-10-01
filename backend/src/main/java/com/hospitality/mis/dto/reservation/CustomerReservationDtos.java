package com.hospitality.mis.dto.reservation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import com.hospitality.mis.entity.reservation.CustomerPaymentMethod;
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
            @NotBlank String idempotencyKey,
            @NotNull CustomerPaymentMethod paymentMethod,
            @Email String confirmationEmail) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomStay(
            @NotBlank String roomId,
            @NotNull LocalDateTime expectedCheckIn,
            @NotNull LocalDateTime expectedCheckOut,
            @jakarta.validation.constraints.Positive Integer guestCount) {
        public RoomStay(String roomId, LocalDateTime expectedCheckIn, LocalDateTime expectedCheckOut) {
            this(roomId, expectedCheckIn, expectedCheckOut, 1);
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomLine(
            String roomId,
            String roomName,
            String roomTypeName,
            BigDecimal unitPrice,
            BigDecimal totalPrice,
            LocalDateTime expectedCheckIn,
            LocalDateTime expectedCheckOut,
            int guestCount) {
        public RoomLine(String roomId, LocalDateTime expectedCheckIn, LocalDateTime expectedCheckOut, int guestCount) {
            this(roomId, roomId, null, null, null, expectedCheckIn, expectedCheckOut, guestCount);
        }
    }

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
            BigDecimal totalAmount,
            LocalDateTime bookedAt,
            List<RoomLine> rooms,
            PaymentInstruction depositPayment,
            List<com.hospitality.mis.service.reservation.HotelServiceBookingService.Response> services,
            String cancellationReason,
            com.hospitality.mis.entity.reservation.CancellationOutcome cancellationOutcome) {
        /** Giữ tương thích với các caller Java cũ */
        public Response(Long id, ReservationStatus status, ReservationDtos.RentalType rentalType,
                        String bookingSource, BigDecimal depositAmount, BigDecimal totalAmount,
                        LocalDateTime bookedAt, List<RoomLine> rooms, PaymentInstruction depositPayment) {
            this(id, status, rentalType, bookingSource, depositAmount, totalAmount, bookedAt, rooms, depositPayment, List.of(), null, null);
        }
        public Response(Long id, ReservationStatus status, ReservationDtos.RentalType rentalType,
                        String bookingSource, BigDecimal depositAmount, LocalDateTime bookedAt,
                        List<RoomLine> rooms, PaymentInstruction depositPayment) {
            this(id, status, rentalType, bookingSource, depositAmount,
                 depositAmount != null ? depositAmount.multiply(BigDecimal.valueOf(2)) : BigDecimal.ZERO,
                 bookedAt, rooms, depositPayment, List.of(), null, null);
        }
        public Response(Long id, ReservationStatus status, ReservationDtos.RentalType rentalType,
                        BigDecimal depositAmount, LocalDateTime bookedAt, List<RoomLine> rooms,
                        PaymentInstruction depositPayment) {
            this(id, status, rentalType, "DIRECT", depositAmount,
                 depositAmount != null ? depositAmount.multiply(BigDecimal.valueOf(2)) : BigDecimal.ZERO,
                 bookedAt, rooms, depositPayment, List.of(), null, null);
        }
    }
}
