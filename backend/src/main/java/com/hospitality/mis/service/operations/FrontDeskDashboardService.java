package com.hospitality.mis.service.operations;

import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;

/** Tổng hợp một lần đọc các chỉ báo vận hành mà lễ tân cần trong ngày. */
@Service
public class FrontDeskDashboardService {
    private final ReservationRepository reservations;
    private final RoomRepository rooms;
    private final EquipmentIncidentRepository incidents;
    private final Clock clock;

    public FrontDeskDashboardService(ReservationRepository reservations, RoomRepository rooms,
                                     EquipmentIncidentRepository incidents, Clock clock) {
        this.reservations = reservations;
        this.rooms = rooms;
        this.incidents = incidents;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FrontDeskDashboardDtos.Response get(LocalDate date, String query, ReservationStatus status,
                                               int page, int size) {
        LocalDate businessDate = date == null ? LocalDate.now(clock) : date;
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        LocalDateTime fromAt = businessDate.atStartOfDay();
        LocalDateTime toAt = businessDate.plusDays(1).atStartOfDay();
        PageRequest pageRequest = PageRequest.of(safePage, safeSize);

        Page<Long> allReservations = reservations.dashboardIds(normalized, status, "ALL", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.ReservationItem> arrivals = dashboardItems(
                normalized, status, "ARRIVALS", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.ReservationItem> departures = dashboardItems(
                normalized, status, "DEPARTURES", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.ReservationItem> current = dashboardItems(
                normalized, status, "CURRENT", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.ReservationItem> unpaidDeposits = dashboardItems(
                normalized, status, "UNPAID_DEPOSITS", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.ReservationItem> balances = dashboardItems(
                normalized, status, "INVOICE_BALANCES", fromAt, toAt, pageRequest);
        List<FrontDeskDashboardDtos.RoomSummary> roomItems = rooms.search(null, null).stream()
                .map(r -> new FrontDeskDashboardDtos.RoomSummary(r.getId(), r.getName(), r.getStatus(),
                        r.getRoomType().getId(), r.getRoomType().getName(), r.getFloor(),
                        r.getRoomType().getDailyPrice(), r.getRoomType().getBedType()))
                .toList();
        Map<String, Long> roomCounts = roomItems.stream().collect(Collectors.groupingBy(
                x -> x.status().databaseCode(), TreeMap::new, Collectors.counting()));
        List<FrontDeskDashboardDtos.IncidentItem> incidentItems = incidents.dashboardPage(pageRequest).getContent().stream()
                .map(i -> new FrontDeskDashboardDtos.IncidentItem(i.getId(),
                        i.getReservation() == null ? null : i.getReservation().getId(),
                        i.getRoom() == null ? null : i.getRoom().getId(), i.getCompensation()))
                .toList();

        int totalPages = allReservations.getTotalPages();
        return new FrontDeskDashboardDtos.Response(businessDate,
                arrivals, departures, current, unpaidDeposits, balances, roomItems, roomCounts, incidentItems,
                safePage, safeSize, allReservations.getTotalElements(), totalPages);
    }

    private List<FrontDeskDashboardDtos.ReservationItem> dashboardItems(
            String query, ReservationStatus status, String bucket, LocalDateTime fromAt,
            LocalDateTime toAt, PageRequest pageRequest) {
        Page<Long> ids = reservations.dashboardIds(query, status, bucket, fromAt, toAt, pageRequest);
        if (ids.isEmpty()) return List.of();
        Map<Long, Reservation> details = reservations.findDashboardDetails(ids.getContent()).stream()
                .collect(Collectors.toMap(Reservation::getId, r -> r));
        return ids.getContent().stream().map(details::get).filter(Objects::nonNull).map(this::toItem).toList();
    }

    private FrontDeskDashboardDtos.ReservationItem toItem(Reservation r) {
        LocalDateTime checkIn = r.getRooms().stream().map(ReservationRoom::getCheckIn)
                .min(LocalDateTime::compareTo).orElse(null);
        LocalDateTime checkOut = r.getRooms().stream().map(ReservationRoom::getCheckOut)
                .max(LocalDateTime::compareTo).orElse(null);
        Invoice invoice = r.getInvoice();
        return new FrontDeskDashboardDtos.ReservationItem(r.getId(),
                r.getGuest() == null ? null : r.getGuest().getId(),
                r.getGuest() == null ? null : r.getGuest().getFullName(),
                r.getGuest() == null ? null : r.getGuest().getPhone(), r.getStatus(), checkIn, checkOut,
                r.getRooms().stream().map(x -> x.getRoom().getId()).toList(), r.getDepositAmount(),
                r.getDepositPaymentStatus() == null ? null : r.getDepositPaymentStatus().name(),
                invoice == null ? BigDecimal.ZERO : invoice.getAmountDue());
    }
}
