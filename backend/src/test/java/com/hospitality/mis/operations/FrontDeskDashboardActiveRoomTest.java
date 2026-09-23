package com.hospitality.mis.operations;

import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.operations.FrontDeskDashboardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FrontDeskDashboardActiveRoomTest {
    @Mock ReservationRepository reservations;
    @Mock RoomRepository rooms;
    @Mock EquipmentIncidentRepository incidents;

    @Test
    void currentStayExposesOnlyTheActiveRoomAfterRepeatedTransfers() {
        Reservation reservation = new Reservation();
        ReflectionTestUtils.setField(reservation, "id", 77L);
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.transitionTo(ReservationStatus.CHECKED_IN);
        reservation.addRoom(line("502", RoomStatus.CANCELLED,
                LocalDateTime.of(2026, 9, 21, 14, 0), LocalDateTime.of(2026, 9, 23, 1, 0)));
        reservation.addRoom(line("603", RoomStatus.CANCELLED,
                LocalDateTime.of(2026, 9, 23, 1, 0), LocalDateTime.of(2026, 9, 23, 2, 0)));
        reservation.addRoom(line("604", RoomStatus.OCCUPIED,
                LocalDateTime.of(2026, 9, 23, 2, 0), LocalDateTime.of(2026, 9, 26, 12, 0)));

        when(reservations.dashboardIds(anyString(), isNull(), anyString(), any(), any(), any()))
                .thenAnswer(invocation -> "CURRENT".equals(invocation.getArgument(2))
                        ? new PageImpl<>(List.of(77L))
                        : Page.empty(invocation.getArgument(5)));
        when(reservations.findDashboardDetails(List.of(77L))).thenReturn(List.of(reservation));
        when(rooms.search(null, null)).thenReturn(List.of());
        when(incidents.dashboardPage(any())).thenAnswer(invocation -> Page.empty(invocation.getArgument(0)));

        FrontDeskDashboardService service = new FrontDeskDashboardService(reservations, rooms, incidents,
                Clock.fixed(Instant.parse("2026-09-23T02:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));

        var response = service.get(null, null, null, 0, 100);

        assertThat(response.currentStays()).hasSize(1);
        assertThat(response.currentStays().get(0).roomIds()).containsExactly("604");
    }

    private ReservationRoom line(String roomId, RoomStatus status, LocalDateTime from, LocalDateTime to) {
        Room room = new Room();
        room.setId(roomId);
        ReservationRoom line = new ReservationRoom();
        line.setRoom(room);
        line.setCheckIn(from);
        line.setCheckOut(to);
        line.setStatus(status);
        return line;
    }
}
