package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.RoomStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Read model tổng hợp cho màn hình Front Desk theo ngày nghiệp vụ. */
public final class FrontDeskDashboardDtos {
    private FrontDeskDashboardDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReservationItem(Long reservationId, Long guestId, String guestName, String guestPhone,
                                  ReservationStatus status, LocalDateTime checkIn, LocalDateTime checkOut,
                                  List<String> roomIds, BigDecimal depositAmount, String depositPaymentStatus,
                                  BigDecimal invoiceBalance) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomSummary(String roomId, String name, RoomStatus status, String roomTypeId,
                              String roomTypeName, Integer floor, BigDecimal dailyPrice,
                              String bedType) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record IncidentItem(Long id, Long reservationId, String roomId, BigDecimal compensation) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(LocalDate businessDate, List<ReservationItem> arrivals,
                           List<ReservationItem> departures, List<ReservationItem> currentStays,
                           List<ReservationItem> unpaidDeposits, List<ReservationItem> invoiceBalances,
                           List<RoomSummary> rooms, Map<String, Long> roomCounts,
                           List<IncidentItem> incidents, int page, int size, long totalElements,
                           int totalPages) {}
}
