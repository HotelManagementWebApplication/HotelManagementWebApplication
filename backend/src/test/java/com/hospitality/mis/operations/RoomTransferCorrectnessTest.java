package com.hospitality.mis.operations;

import com.hospitality.mis.dao.operations.RoomTransferRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.RoomTransferDtos;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.reservation.RoomTransfer;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.operations.RoomTransferService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/** Bảo vệ room transfer: lock thứ tự, composite identity, timestamp và actor scope. */
class RoomTransferCorrectnessTest {
    /** Các mock đại diện reservation lock, room lock, persisted transfer và audit side effect. */
    @Mock ReservationRepository reservations;
    @Mock RoomRepository rooms;
    @Mock RoomTransferRepository transfers;
    @Mock AuditService audit;

    @BeforeEach
    /** Đặt front desk actor hợp lệ cho mutation. */
    void authenticateFrontDesk() {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("frontdesk", "test",
                List.of(new SimpleGrantedAuthority("ROLE_FRONT_DESK"))));
        SecurityContextHolder.setContext(context);
    }

    @AfterEach
    /** Dọn SecurityContext sau test. */
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    /** Given booking 101, When chuyển sang 102, Then line cũ cancel, line mới thêm và timestamp giữ nguyên. */
    void transferFlushesWithoutMutatingCompositeIdentityAndKeepsPersistedTimestamp() {
        Room from = room("101", RoomStatus.OCCUPIED);
        Room to = room("102", RoomStatus.READY);
        Reservation reservation = new Reservation();
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.transitionTo(ReservationStatus.CHECKED_IN);
        ReservationRoom assignment = new ReservationRoom();
        assignment.setRoom(from);
        assignment.setCheckIn(LocalDateTime.of(2031, 1, 1, 14, 0));
        assignment.setCheckOut(LocalDateTime.of(2031, 1, 5, 12, 0));
        assignment.setStatus(RoomStatus.OCCUPIED);
        reservation.addRoom(assignment);
        when(reservations.findForUpdate(9L)).thenReturn(Optional.of(reservation));
        when(rooms.findAllForUpdateOrdered(List.of("101", "102"))).thenReturn(List.of(from, to));
        when(reservations.hasOverlapExcludingReservation(eq(9L), eq("102"),
                eq(LocalDateTime.of(2031, 1, 2, 10, 30)), eq(LocalDateTime.of(2031, 1, 5, 12, 0)),
                eq(RoomStatus.CANCELLED), anyList(), any(LocalDateTime.class))).thenReturn(false);
        when(transfers.save(any(RoomTransfer.class))).thenAnswer(invocation -> {
            RoomTransfer saved = invocation.getArgument(0);
            saved.setTransferredAt(LocalDateTime.of(2031, 1, 2, 10, 30));
            ReflectionTestUtils.setField(saved, "id", 77L);
            return saved;
        });

        RoomTransferService service = new RoomTransferService(reservations, rooms, transfers, audit);
        var response = service.transfer(9L,
                new RoomTransferDtos.CreateRequest("101", "102", LocalDateTime.of(2031, 1, 2, 10, 30), "maintenance"),
                "frontdesk", "transfer-9");

        verify(reservations).saveAndFlush(reservation);
        assertThat(assignment.getRoom()).isSameAs(from);
        assertThat(assignment.getStatus()).isEqualTo(RoomStatus.CANCELLED);
        assertThat(reservation.getRooms()).hasSize(2);
        assertThat(reservation.getRooms().get(1).getRoom()).isSameAs(to);
        assertThat(response.transferredAt()).isEqualTo(LocalDateTime.of(2031, 1, 2, 10, 30));
        assertThat(response.id()).isEqualTo(77L);
    }

    @Test
    /** Given phòng đích đã được giữ, When lễ tân chuyển phòng, Then chặn trước khi ghi transfer. */
    void transferRejectsTargetThatIsNotCurrentlyEmptyAndReady() {
        Room from = room("502", RoomStatus.OCCUPIED);
        Room reserved = room("503", RoomStatus.RESERVED);
        Reservation reservation = checkedInReservation(from,
                LocalDateTime.of(2031, 1, 1, 14, 0), LocalDateTime.of(2031, 1, 5, 12, 0));
        when(reservations.findForUpdate(9L)).thenReturn(Optional.of(reservation));
        when(rooms.findAllForUpdateOrdered(List.of("502", "503"))).thenReturn(List.of(from, reserved));

        RoomTransferService service = new RoomTransferService(reservations, rooms, transfers, audit);
        var error = org.junit.jupiter.api.Assertions.assertThrows(
                com.hospitality.mis.common.exception.DomainException.class,
                () -> service.transfer(9L,
                        new RoomTransferDtos.CreateRequest("502", "503", LocalDateTime.of(2031, 1, 2, 10, 30), "đổi phòng"),
                        "frontdesk", "transfer-reserved"));

        assertThat(error.getCode()).isEqualTo("ROOM_NOT_AVAILABLE");
        verify(reservations, never()).saveAndFlush(any());
        verifyNoInteractions(transfers, audit);
    }

    @Test
    /** Given phòng READY nhưng có booking trùng kỳ còn lại, When chuyển, Then chặn overbooking. */
    void transferRejectsOverlappingBookingForTheRemainingStay() {
        Room from = room("502", RoomStatus.OCCUPIED);
        Room target = room("504", RoomStatus.READY);
        LocalDateTime transferredAt = LocalDateTime.of(2031, 1, 2, 10, 30);
        LocalDateTime checkout = LocalDateTime.of(2031, 1, 5, 12, 0);
        Reservation reservation = checkedInReservation(from, LocalDateTime.of(2031, 1, 1, 14, 0), checkout);
        when(reservations.findForUpdate(9L)).thenReturn(Optional.of(reservation));
        when(rooms.findAllForUpdateOrdered(List.of("502", "504"))).thenReturn(List.of(from, target));
        when(reservations.hasOverlapExcludingReservation(eq(9L), eq("504"), eq(transferredAt), eq(checkout),
                eq(RoomStatus.CANCELLED),
                eq(List.of(ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT)),
                any(LocalDateTime.class)))
                .thenReturn(true);

        RoomTransferService service = new RoomTransferService(reservations, rooms, transfers, audit);
        var error = org.junit.jupiter.api.Assertions.assertThrows(
                com.hospitality.mis.common.exception.DomainException.class,
                () -> service.transfer(9L,
                        new RoomTransferDtos.CreateRequest("502", "504", transferredAt, "đổi phòng"),
                        "frontdesk", "transfer-overlap"));

        assertThat(error.getCode()).isEqualTo("OVERBOOKING");
        verify(reservations, never()).saveAndFlush(any());
        verifyNoInteractions(transfers, audit);
    }

    @Test
    /** Given actor request khác authenticated, When transfer, Then fail trước load reservation/room. */
    void transferRejectsClientActorThatDiffersFromAuthenticatedActorBeforeLoadingReservation() {
        RoomTransferService service = new RoomTransferService(reservations, rooms, transfers, audit);

        var exception = org.junit.jupiter.api.Assertions.assertThrows(
                com.hospitality.mis.common.exception.DomainException.class,
                () -> service.transfer(9L,
                        new RoomTransferDtos.CreateRequest("101", "102", null, "maintenance"),
                        "other", "transfer-actor-mismatch"));

        assertThat(exception.getCode()).isEqualTo("ACTOR_MISMATCH");
        verifyNoInteractions(reservations, rooms, transfers, audit);
    }

    /** Dựng room tối thiểu với status để fixture thể hiện rõ room nguồn/đích. */
    private static Room room(String id, RoomStatus status) {
        Room room = new Room(); room.setId(id); room.setStatus(status); return room;
    }

    private static Reservation checkedInReservation(Room room, LocalDateTime checkIn, LocalDateTime checkOut) {
        Reservation reservation = new Reservation();
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.transitionTo(ReservationStatus.CHECKED_IN);
        ReservationRoom assignment = new ReservationRoom();
        assignment.setRoom(room); assignment.setCheckIn(checkIn); assignment.setCheckOut(checkOut);
        assignment.setStatus(RoomStatus.OCCUPIED); reservation.addRoom(assignment);
        return reservation;
    }
}
