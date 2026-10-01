package com.hospitality.mis.dto.reservation;
import com.hospitality.mis.entity.billing.PaymentMethod;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.reservation.CancellationOutcome;
import com.hospitality.mis.entity.reservation.CustomerPaymentMethod;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import jakarta.validation.Valid;

import jakarta.validation.constraints.NotBlank;

import jakarta.validation.constraints.NotEmpty;

import jakarta.validation.constraints.NotNull;

import jakarta.validation.constraints.PositiveOrZero;



import java.math.BigDecimal;

import java.time.LocalDate;

import java.time.LocalDateTime;

import java.util.List;



/** DTO cho toàn bộ vòng đời đặt phòng và serialization snake_case của API. */
public final class ReservationDtos {

    /** Namespace không trạng thái cho payload đặt phòng. */
    private ReservationDtos() {}



    /** Cách tính thời lượng thuê: theo gói ngày hoặc theo giờ. */
    public enum RentalType { PACKAGE, HOURLY }

    /** Trang kết quả phân trang, giữ cả tổng số phần tử và tổng số trang. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PageResponse(
                              /** Các đặt phòng của trang hiện tại. */
                              List<Response> items,
                              /** Chỉ số trang theo quy ước endpoint. */
                              int page,
                              /** Kích thước trang được yêu cầu. */
                              int size,
                              /** Tổng số đặt phòng phù hợp bộ lọc. */
                              long totalElements,
                              /** Tổng số trang có thể truy cập. */
                              int totalPages) {}



    /** Khoảng ở của một phòng trong request tạo booking. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomStay(
                           /** Mã phòng được yêu cầu. */
                           @NotBlank String roomId,
                           /** Thời điểm dự kiến nhận phòng. */
                           @NotNull LocalDateTime expectedCheckIn,
                           /** Thời điểm dự kiến trả phòng. */
                           @NotNull LocalDateTime expectedCheckOut,
                           @jakarta.validation.constraints.Positive Integer guestCount) {
        public RoomStay(String roomId, LocalDateTime expectedCheckIn, LocalDateTime expectedCheckOut) {
            this(roomId, expectedCheckIn, expectedCheckOut, 1);
        }
    }

    /** Request tạo đặt phòng; rooms phải có ít nhất một phần tử hợp lệ. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
                                /** Khách đứng tên đặt phòng. */
                                @NotNull Long guestId,
                                /** Nhân viên tạo booking. */
                                @NotBlank String employeeId,
                                /** Tiền đặt cọc không âm. */
                                @PositiveOrZero BigDecimal deposit,
                                /** Kiểu tính thời gian thuê. */
                                @NotNull RentalType rentalType,
                                /** Danh sách phòng và thời gian ở, bắt buộc không rỗng và validate lồng nhau. */
                                @NotEmpty @Valid List<RoomStay> rooms,
                                /** Khóa tùy chọn chống tạo trùng khi client retry. */
                                String idempotencyKey,
                                /** Nguồn đặt phòng: DIRECT, BOOKING_COM, AGODA, EXPEDIA, AIRBNB... */
                                String bookingSource) {
        public CreateRequest(Long guestId, String employeeId, BigDecimal deposit, RentalType rentalType,
                             List<RoomStay> rooms, String idempotencyKey) {
            this(guestId, employeeId, deposit, rentalType, rooms, idempotencyKey, "DIRECT");
        }
    }

    /** Mốc thời gian dùng khi check-in; null cho phép service lấy giờ hiện tại. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CheckInRequest(
                                 /** Thời điểm nhận phòng do caller chỉ định. */
                                 LocalDateTime at) {}
    /** Mốc check-out và phương thức thanh toán cuối kỳ. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CheckOutRequest(
                                  /** Thời điểm trả phòng do caller chỉ định. */
                                  LocalDateTime at,
                                  /** Phương thức dùng thanh toán hóa đơn khi trả phòng. */
                                  com.hospitality.mis.entity.billing.PaymentMethod paymentMethod) {}
    /** Lý do bắt buộc khi hủy booking. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CancelRequest(
                                /** Lý do nghiệp vụ của việc hủy. */
                                @NotBlank String reason) {}
    /** Thời điểm trả phòng mới khi gia hạn. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ExtendRequest(
                                /** Mốc check-out mới, bắt buộc khác null. */
                                @NotNull LocalDateTime newExpectedCheckOut) {}

    /** Thay đổi lịch lưu trú trước khi khách nhận phòng; giữ nguyên tập phòng đã gán. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(
            @NotEmpty @Valid List<RoomStay> rooms,
            @PositiveOrZero BigDecimal deposit) {}
    /** Request thêm dịch vụ vào booking. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AddServiceRequest(
                                    /** Mã dịch vụ. */
                                    @NotBlank String serviceId,
                                    /** Số lượng sử dụng phải dương. */
                                    @NotNull @jakarta.validation.constraints.Positive Integer quantity,
                                    /** Thời điểm sử dụng, có thể để service mặc định. */
                                    LocalDateTime usedAt,
                                    String roomId,
                                    String mealPeriod) {
        public AddServiceRequest(String serviceId, Integer quantity, LocalDateTime usedAt) {
            this(serviceId, quantity, usedAt, null, null);
        }
    }

    /** Dòng phòng trong response, gồm cả thời gian dự kiến và thực tế. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomLine(
                           /** Mã phòng. */
                           String roomId,
                           /** Mốc nhận phòng dự kiến. */
                           LocalDateTime expectedCheckIn,
                           /** Mốc trả phòng dự kiến. */
                           LocalDateTime expectedCheckOut,
                           /** Mốc nhận phòng thực tế nếu đã nhận. */
                           LocalDateTime actualCheckIn,
                           /** Mốc trả phòng thực tế nếu đã trả. */
                           LocalDateTime actualCheckOut) {}
    /** Dòng dịch vụ đã sử dụng với đơn giá được chụp tại thời điểm phát sinh. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ServiceUsageLine(String serviceId, String serviceName, LocalDate usedOn,
                                   Integer quantity, BigDecimal unitPrice, BigDecimal amount) {}
    /** Biểu diễn đầy đủ booking cho frontend và các endpoint đọc. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, Long guestId, String employeeId, ReservationStatus status, RentalType rentalType,
                           BigDecimal deposit, LocalDateTime bookedAt, LocalDateTime actualCheckIn,
                           LocalDateTime actualCheckOut, List<RoomLine> rooms,
                           String cancellationReason, CancellationOutcome cancellationOutcome,
                           String bookingSource, BigDecimal otaGrossRevenue, BigDecimal otaCommission,
                           BigDecimal otaNetRevenue, String otaReconciliationStatus,
                           List<ServiceUsageLine> serviceUsages,
                           CustomerPaymentMethod customerPaymentMethod,
                           DepositPaymentStatus depositPaymentStatus) {
        public Response {
            serviceUsages = serviceUsages == null ? List.of() : List.copyOf(serviceUsages);
        }
    }

}
