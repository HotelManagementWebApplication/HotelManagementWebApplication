package com.hospitality.mis.operations;

import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.operations.EquipmentIncident;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Bảo vệ query dashboard thật: DB lọc/sort/count/page trước khi nạp aggregate. */
@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
class FrontDeskDashboardQueryIntegrationTest {
    private static final LocalDate BUSINESS_DATE = LocalDate.of(2031, 1, 10);

    @Autowired EntityManager entityManager;
    @Autowired ReservationRepository reservations;
    @Autowired EquipmentIncidentRepository incidents;

    @Test
    void dashboardReservationQueryAppliesSearchSortAndCountBeforePage() {
        Guest guest = guest("Target Guest", "0900000101", "010000000001");
        Room room = room("R101");
        Reservation first = reservation(guest, room, ReservationStatus.CONFIRMED,
                BUSINESS_DATE.atTime(8, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        Reservation second = reservation(guest, room("R102"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.plusDays(1).atTime(8, 0), BUSINESS_DATE.plusDays(2).atTime(12, 0));
        reservation(guest("Other Guest", "0900000102", "010000000002"), room("R103"),
                ReservationStatus.CONFIRMED, BUSINESS_DATE.atTime(9, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        entityManager.flush();
        entityManager.clear();

        var page = reservations.dashboardIds("target", null, "ALL",
                BUSINESS_DATE.atStartOfDay(), BUSINESS_DATE.plusDays(1).atStartOfDay(), PageRequest.of(1, 1));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).containsExactly(second.getId());
        assertThat(reservations.findDashboardDetails(page.getContent())).extracting(Reservation::getId)
                .containsExactly(second.getId());
        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test
    void dashboardArrivalBucketUsesMinCheckInDateAndStatusInDatabase() {
        Guest guest = guest("Arrival Guest", "0900000111", "010000000011");
        Reservation validArrival = reservation(guest, room("R201"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        Reservation earlierRoom = reservation(guest, room("R202"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.atTime(12, 0));
        addRoom(earlierRoom, room("R203"), BUSINESS_DATE.atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        reservation(guest, room("R204"), ReservationStatus.CHECKED_IN,
                BUSINESS_DATE.atTime(15, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        entityManager.flush();
        entityManager.clear();

        var page = reservations.dashboardIds("", null, "ARRIVALS",
                BUSINESS_DATE.atStartOfDay(), BUSINESS_DATE.plusDays(1).atStartOfDay(), PageRequest.of(0, 20));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).containsExactly(validArrival.getId());
    }

    @Test
    void dashboardUpcomingBucketReturnsFutureReservedRoomsWithoutMixingThemIntoTodaysArrivals() {
        Guest guest = guest("Future Guest", "0900000112", "010000000012");
        Reservation future = reservation(guest, room("R205"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.plusDays(1).atTime(18, 0), BUSINESS_DATE.plusDays(1).atTime(21, 0));
        reservation(guest, room("R206"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.atTime(18, 0), BUSINESS_DATE.atTime(21, 0));
        Reservation cancelledLine = reservation(guest, room("R207"), ReservationStatus.CONFIRMED,
                BUSINESS_DATE.plusDays(2).atTime(18, 0), BUSINESS_DATE.plusDays(2).atTime(21, 0));
        cancelledLine.getRooms().get(0).setStatus(com.hospitality.mis.entity.room.RoomStatus.CANCELLED);
        entityManager.flush();
        entityManager.clear();

        var page = reservations.dashboardIds("", null, "UPCOMING",
                BUSINESS_DATE.atStartOfDay(), BUSINESS_DATE.plusDays(1).atStartOfDay(), PageRequest.of(0, 20));

        assertThat(page.getContent()).containsExactly(future.getId());
    }

    @Test
    void dashboardIncidentQueryIsStableAndBoundedByRequestedPage() {
        Guest guest = guest("Incident Guest", "0900000121", "010000000021");
        Reservation reservation = reservation(guest, room("R301"), ReservationStatus.CHECKED_IN,
                BUSINESS_DATE.atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0));
        Room secondRoom = room("R302");
        entityManager.persist(secondRoom);
        EquipmentIncident first = new EquipmentIncident(reservation, room("R303"), "TV",
                BigDecimal.TEN, LocalDate.of(2030, 1, 1), 1, BigDecimal.ONE);
        entityManager.persist(first);
        EquipmentIncident second = new EquipmentIncident(reservation, secondRoom, "Lamp",
                BigDecimal.TEN, LocalDate.of(2030, 1, 1), 1, BigDecimal.ONE);
        entityManager.persist(second);
        entityManager.flush();
        entityManager.clear();

        var page = incidents.dashboardPage(PageRequest.of(1, 1));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(EquipmentIncident::getId).containsExactly(second.getId());
    }

    private Guest guest(String name, String phone, String identity) {
        Guest guest = new Guest();
        guest.setFullName(name);
        guest.setPhone(phone);
        guest.setIdentityNumber(identity);
        entityManager.persist(guest);
        return guest;
    }

    private Room room(String id) {
        RoomType type = new RoomType();
        type.setId("STD" + id.substring(id.length() - 1));
        type.setName("Standard " + id);
        type.setDailyPrice(BigDecimal.valueOf(100));
        entityManager.persist(type);
        Room room = new Room();
        room.setId(id);
        room.setName("Room " + id);
        room.setRoomType(type);
        entityManager.persist(room);
        return room;
    }

    private Reservation reservation(Guest guest, Room room, ReservationStatus status,
                                    LocalDateTime checkIn, LocalDateTime checkOut) {
        Reservation reservation = new Reservation();
        reservation.setGuest(guest);
        if (status == ReservationStatus.CHECKED_IN) {
            reservation.transitionTo(ReservationStatus.CONFIRMED);
            reservation.transitionTo(ReservationStatus.CHECKED_IN);
        } else {
            reservation.transitionTo(status);
        }
        addRoom(reservation, room, checkIn, checkOut);
        entityManager.persist(reservation);
        return reservation;
    }

    private void addRoom(Reservation reservation, Room room, LocalDateTime checkIn, LocalDateTime checkOut) {
        ReservationRoom line = new ReservationRoom();
        line.setRoom(room);
        line.setCheckIn(checkIn);
        line.setCheckOut(checkOut);
        reservation.addRoom(line);
    }
}
