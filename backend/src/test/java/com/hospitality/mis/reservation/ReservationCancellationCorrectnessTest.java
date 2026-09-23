package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.ServiceLineRepository;
import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.reservation.CancellationOutcome;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/** Bảo vệ cancellation boundary, idempotency và check-in lock/overlap invariants. */
class ReservationCancellationCorrectnessTest {
    @org.junit.jupiter.api.BeforeEach
    /** Đặt frontdesk actor để mutation không bị chặn bởi security. */
    void authenticateActor() {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
            new org.springframework.security.authentication.TestingAuthenticationToken("frontdesk", "", "ROLE_FRONT_DESK"));
    }
    @org.junit.jupiter.api.AfterEach
    /** Dọn actor sau test. */
    void clearActor() { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }

    /** Reservation repository mock; findForUpdate là boundary lock của cancellation/check-in. */
    @Mock ReservationRepository reservations;
    /** Shared guest port mock giữ test độc lập với guest persistence. */
    @Mock GuestStore guests;
    /** Employee lookup mock cho owner của reservation fixture. */
    @Mock EmployeeRepository employees;
    /** Room repository mock để test lock và physical readiness. */
    @Mock RoomRepository rooms;
    /** Audit mock để chứng minh rejected path không ghi sự kiện. */
    @Mock AuditService audit;
    /** Billing mock để kiểm tra settle deposit đúng branch refund/forfeit. */
    @Mock BillingService billing;
    /** Catalog/service-line ports không phải trọng tâm nhưng giữ dependency graph production. */
    @Mock ServiceRepository serviceCatalog;
    @Mock ServiceLineRepository serviceLines;
    /** Inventory port giữ construction service đầy đủ cho workflow reservation. */
    @Mock InventoryMovementRepository inventoryMovements;
    /** Service thật với toàn bộ port mock, được dựng lại mỗi test. */
    private ReservationService service;
    /** Clock cố định để boundary 48 giờ không phụ thuộc thời gian chạy. */
    private final LocalDateTime now = LocalDateTime.of(2031, 1, 1, 12, 0);

    /** Dựng service và inject clock cố định cho mọi cancellation/check-in assertion. */
    @BeforeEach
    void setUp() {
        service = new ReservationService(reservations, guests, employees, rooms, audit, billing,
                serviceCatalog, serviceLines, inventoryMovements);
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(now.atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault()));
    }

    @Test
    /** Given đúng 48h và 48h+1m, When cancel, Then lần đầu forfeit, lần sau refund. */
    void exactlyConfiguredBoundaryIsLateAndMoreThanBoundaryIsFree() {
        Reservation atBoundary = reservation(new GuestWithId(41L), employee(), now.plusHours(48));
        when(reservations.findForUpdate(7L)).thenReturn(Optional.of(atBoundary));
        var result = service.cancel(7L, new ReservationDtos.CancelRequest("guest request"), "frontdesk", "cancel-boundary");
        assertThat(result.cancellationOutcome()).isEqualTo(CancellationOutcome.FORFEIT);
        verify(billing).settleCancellationDeposit(atBoundary, "frontdesk", true);

        Reservation outside = reservation(new GuestWithId(42L), employee(), now.plusHours(48).plusMinutes(1));
        when(reservations.findForUpdate(8L)).thenReturn(Optional.of(outside));
        var free = service.cancel(8L, new ReservationDtos.CancelRequest("changed plans"), "frontdesk", "cancel-free");
        assertThat(free.cancellationOutcome()).isEqualTo(CancellationOutcome.REFUND);
        verify(billing).settleCancellationDeposit(outside, "frontdesk", false);
    }

    @Test
    /** Given cùng key, When retry giống payload, Then replay một result; payload khác thì conflict. */
    void sameKeyReturnsOneResultAndDifferentPayloadConflicts() {
        Reservation reservation = reservation(new GuestWithId(41L), employee(), now.plusHours(72));
        when(reservations.findForUpdate(7L)).thenReturn(Optional.of(reservation));
        var first = service.cancel(7L, new ReservationDtos.CancelRequest("guest request"), "frontdesk", "cancel-retry");
        var retry = service.cancel(7L, new ReservationDtos.CancelRequest("guest request"), "frontdesk", "cancel-retry");
        assertThat(retry).isEqualTo(first);
        verify(billing, times(1)).settleCancellationDeposit(any(), eq("frontdesk"), eq(false));
        assertThatThrownBy(() -> service.cancel(7L, new ReservationDtos.CancelRequest("other reason"), "frontdesk", "cancel-retry"))
                .hasMessageContaining("Idempotency key");
    }

    @Test
    /** Given room MAINTENANCE, When check-in, Then reject trước transition/audit. */
    void checkInRejectsMaintenanceRoomBeforeChangingReservation() {
        Reservation blocked = reservation(new GuestWithId(43L), employee(), now);
        blocked.getRooms().get(0).getRoom().setStatus(com.hospitality.mis.entity.room.RoomStatus.MAINTENANCE);
        when(reservations.findForUpdate(10L)).thenReturn(Optional.of(blocked));
        when(rooms.findAllForUpdateOrdered(List.of("101"))).thenReturn(List.of(blocked.getRooms().get(0).getRoom()));

        assertThatThrownBy(() -> service.checkIn(10L, new ReservationDtos.CheckInRequest(now), "frontdesk", "check-in-maintenance"))
                .extracting("code").isEqualTo("ROOM_NOT_AVAILABLE");
        assertThat(blocked.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
        verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = com.hospitality.mis.entity.room.RoomStatus.class,
            names = {"OCCUPIED", "CLEANING", "OUT_OF_SERVICE"})
    /** Given status vật lý không READY, When check-in, Then reject và booking vẫn CONFIRMED. */
    void checkInRejectsUnreadyPhysicalRoom(com.hospitality.mis.entity.room.RoomStatus status) {
        Reservation blocked = reservation(new GuestWithId(43L), employee(), now);
        blocked.getRooms().get(0).getRoom().setStatus(status);
        when(reservations.findForUpdate(10L)).thenReturn(Optional.of(blocked));
        when(rooms.findAllForUpdateOrdered(List.of("101"))).thenReturn(List.of(blocked.getRooms().get(0).getRoom()));
        assertThatThrownBy(() -> service.checkIn(10L, new ReservationDtos.CheckInRequest(now), "frontdesk", "check-in-unready"))
                .extracting("code").isEqualTo("ROOM_NOT_AVAILABLE");
        assertThat(blocked.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
    }

    /** Given overlap phát hiện lại dưới lock, When check-in, Then OVERBOOKING trước mutation. */
    @Test void checkInRechecksOverlapsBeforeChangingState() {
        Reservation blocked = reservation(new GuestWithId(43L), employee(), now);
        blocked.getRooms().get(0).getRoom().setStatus(com.hospitality.mis.entity.room.RoomStatus.READY);
        when(reservations.findForUpdate(10L)).thenReturn(Optional.of(blocked));
        when(rooms.findAllForUpdateOrdered(List.of("101"))).thenReturn(List.of(blocked.getRooms().get(0).getRoom()));
        when(reservations.hasOverlapExcludingReservation(eq(10L), eq("101"), eq(now), eq(now.plusHours(4)), any(), any()))
                .thenReturn(true);
        assertThatThrownBy(() -> service.checkIn(10L, new ReservationDtos.CheckInRequest(now), "frontdesk", "check-in-overlap"))
                .extracting("code").isEqualTo("OVERBOOKING");
        assertThat(blocked.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
    }

    /** Dựng reservation CONFIRMED với deposit và một line RESERVED cho test state. */
    private Reservation reservation(Guest guest, Employee employee, LocalDateTime checkIn) {
        Reservation result = new Reservation(); result.setGuest(guest); result.setEmployee(employee);
        result.setDepositAmount(new BigDecimal("100.00"));
        result.setDepositPaymentStatus(com.hospitality.mis.entity.reservation.DepositPaymentStatus.PAID);
        result.transitionTo(ReservationStatus.CONFIRMED);
        Room room = new Room(); room.setId("101");
        ReservationRoom line = new ReservationRoom(); line.setRoom(room); line.setCheckIn(checkIn); line.setCheckOut(checkIn.plusHours(4)); line.setStatus(com.hospitality.mis.entity.room.RoomStatus.RESERVED);
        result.addRoom(line);
        return result;
    }

    /** Employee fixture khớp actor authenticated frontdesk. */
    private Employee employee() { Employee employee = new Employee(); employee.setEmployeeId("frontdesk"); return employee; }

    private static class GuestWithId extends Guest {
        /** Guest id ổn định để cancellation/audit binding không bị mơ hồ. */
        GuestWithId(Long id) { setId(id); setFullName("Guest"); setPhone("090000000" + id); setIdentityNumber("00100100100" + id); }
    }
}
