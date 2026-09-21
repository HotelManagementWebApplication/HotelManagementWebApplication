package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.ReservationOverlapPort;
import com.hospitality.mis.dao.room.RoomStore;
import com.hospitality.mis.dto.room.RoomDtos;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.room.RoomService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
/** Bảo vệ room service: search/availability, lock trạng thái, actor và audit. */
class RoomServiceTest {
    /** Khoảng thời gian half-open dùng cho mọi availability assertion. */
    private static final LocalDateTime FROM = LocalDateTime.of(2031, 1, 10, 14, 0);
    /** TO sau FROM; expected overlap chỉ áp trên khoảng này. */
    private static final LocalDateTime TO = LocalDateTime.of(2031, 1, 11, 12, 0);

    /** RoomStore mock; findForUpdate thể hiện locking boundary khi đổi status. */
    @Mock RoomStore rooms;
    /** Overlap port mock để tách availability khỏi reservation persistence. */
    @Mock ReservationOverlapPort overlaps;
    /** Audit mock để kiểm tra actor/state transition. */
    @Mock AuditService audit;

    /** Service thật được dựng sau khi đặt actor manager. */
    private RoomService service;

    /** Đặt actor manager mặc định và dựng service thật cho mỗi test. */
    @BeforeEach
    void setUp() {
        setActor("manager", "MANAGER");
        service = new RoomService(rooms, overlaps, audit);
    }

    @AfterEach
    /** Dọn SecurityContext sau test. */
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    /** Given room/type canonical, When search, Then DTO map đủ field và không có legacy model. */
    void searchMapsCanonicalRoomAndRoomTypeWithoutLegacyTypesInTheServiceContract() {
        Room room = room("R101", RoomStatus.READY);
        when(rooms.search("STD", RoomStatus.READY)).thenReturn(List.of(room));

        RoomDtos.Response response = service.search("STD", RoomStatus.READY).getFirst();

        assertThat(response.id()).isEqualTo("R101");
        assertThat(response.name()).isEqualTo("Room 101");
        assertThat(response.roomTypeId()).isEqualTo("STD");
        assertThat(response.roomTypeName()).isEqualTo("Standard");
        assertThat(response.dailyPrice()).isEqualByComparingTo("2400.00");
        assertThat(response.floor()).isEqualTo(1);
        assertThat(response.status()).isEqualTo(RoomStatus.READY);
    }

    @Test
    /** Given READY/MAINTENANCE/CLEANING và overlap, When availability, Then chỉ room READY không overlap mới available. */
    void availabilityCombinesOperationalStateWithHalfOpenOverlapProtection() {
        Room ready = room("R101", RoomStatus.READY);
        Room maintenance = room("R102", RoomStatus.MAINTENANCE);
        Room cleaning = room("R103", RoomStatus.CLEANING);
        when(rooms.search(null, null)).thenReturn(List.of(ready, maintenance, cleaning));
        when(overlaps.hasOverlap("R101", FROM, TO)).thenReturn(true);
        when(overlaps.hasOverlap("R102", FROM, TO)).thenReturn(false);
        when(overlaps.hasOverlap("R103", FROM, TO)).thenReturn(false);

        List<RoomDtos.Availability> availability = service.availability(FROM, TO, null);

        assertThat(availability).extracting(RoomDtos.Availability::available)
                .containsExactly(false, false, false);
        verify(overlaps).hasOverlap("R101", FROM, TO);
        verify(overlaps).hasOverlap("R102", FROM, TO);
        verify(overlaps).hasOverlap("R103", FROM, TO);
    }

    @Test
    /** Given TO trước FROM, When availability, Then fail trước query persistence. */
    void availabilityRejectsNonPositiveIntervalsBeforeTouchingPersistence() {
        DomainException exception = assertThrows(DomainException.class,
                () -> service.availability(TO, FROM, null));

        assertThat(exception.getCode()).isEqualTo("INVALID_INTERVAL");
    }

    @Test
    /** Given technical và room READY, When chuyển MAINTENANCE, Then dùng findForUpdate và audit actor. */
    void technicalMaintenanceTransitionUsesTheLockedStateAndAuditActor() {
        setActor("technical", "TECHNICAL");
        Room room = room("R101", RoomStatus.READY);
        when(rooms.findForUpdate("R101")).thenReturn(Optional.of(room));

        RoomDtos.Response response = service.updateStatus("R101", RoomStatus.MAINTENANCE, "technical");

        assertThat(response.status()).isEqualTo(RoomStatus.MAINTENANCE);
        verify(rooms).findForUpdate("R101");
        verify(audit).record("technical", "ROOM_STATUS_CHANGED", "ROOM", "R101",
                "available", "maintenance", null);
    }

    @Test
    /** Given manager có quyền, When chuyển READY -> MAINTENANCE, Then mutation hợp lệ. */
    void managerCanUseTheExplicitMaintenancePath() {
        Room room = room("R101", RoomStatus.READY);
        when(rooms.findForUpdate("R101")).thenReturn(Optional.of(room));

        service.updateStatus("R101", RoomStatus.MAINTENANCE, "manager");

        assertThat(room.getStatus()).isEqualTo(RoomStatus.MAINTENANCE);
    }

    @Test
    /** Given status null, When update, Then INVALID_ROOM_STATUS trước load và không có side effect. */
    void statusUpdateRejectsNullStatusWithoutChangingAStoredRoom() {
        DomainException exception = assertThrows(DomainException.class,
                () -> service.updateStatus("R101", null, "manager"));

        assertThat(exception.getCode()).isEqualTo("INVALID_ROOM_STATUS");
        verifyNoInteractions(rooms, audit);
    }

    @Test
    /** Given OCCUPIED, When patch READY, Then state machine reject và audit không ghi. */
    void occupiedRoomCannotBePatchedToReady() {
        Room room = room("R101", RoomStatus.OCCUPIED);
        when(rooms.findForUpdate("R101")).thenReturn(Optional.of(room));

        DomainException exception = assertThrows(DomainException.class,
                () -> service.updateStatus("R101", RoomStatus.READY, "manager"));

        assertThat(exception.getCode()).isEqualTo("INVALID_ROOM_TRANSITION");
        assertThat(room.getStatus()).isEqualTo(RoomStatus.OCCUPIED);
        verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    /** Given housekeeping room MAINTENANCE, When patch READY, Then role forbidden và state giữ nguyên. */
    void housekeepingCannotMakeRoomAvailable() {
        setActor("housekeeping", "HOUSEKEEPING");
        Room room = room("R101", RoomStatus.MAINTENANCE);
        when(rooms.findForUpdate("R101")).thenReturn(Optional.of(room));

        DomainException exception = assertThrows(DomainException.class,
                () -> service.updateStatus("R101", RoomStatus.READY, "housekeeping"));

        assertThat(exception.getCode()).isEqualTo("ROOM_STATUS_FORBIDDEN");
        assertThat(room.getStatus()).isEqualTo(RoomStatus.MAINTENANCE);
        verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    /** Given actor request khác authenticated, When update, Then fail trước room/audit interaction. */
    void statusUpdateRejectsClientActorThatDiffersFromAuthenticatedActor() {
        DomainException exception = assertThrows(DomainException.class,
                () -> service.updateStatus("R101", RoomStatus.MAINTENANCE, "other"));

        assertThat(exception.getCode()).isEqualTo("ACTOR_MISMATCH");
        verifyNoInteractions(rooms, audit);
    }

    /** Tạo security context role canonical để kiểm tra actor/authorization. */
    private void setActor(String actor, String role) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(actor, "test",
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        SecurityContextHolder.setContext(context);
    }

    /** Dựng room fixture với type STD và giá 2400 để expected DTO có ý nghĩa. */
    private Room room(String id, RoomStatus status) {
        RoomType type = new RoomType();
        type.setId("STD");
        type.setName("Standard");
        type.setDailyPrice(new BigDecimal("2400.00"));

        Room room = new Room();
        room.setId(id);
        room.setName("Room 101");
        room.setFloor(1);
        room.setRoomType(type);
        room.setStatus(status);
        return room;
    }
}
