package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.billing.ServiceLineRepository;
import com.hospitality.mis.dao.guest.GuestRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.Service;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.operations.InventoryMovement;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Real JPA proof that addService locks, idempotently replays, and writes one ISSUE movement. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:reservationinventoryproducer;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ReservationInventoryProducerIntegrationTest {
    @Autowired ReservationService reservations;
    @Autowired GuestRepository guests;
    @Autowired EmployeeRepository employees;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired RoomRepository rooms;
    @Autowired ReservationRepository reservationRepository;
    @Autowired ServiceRepository services;
    @Autowired InventoryMovementRepository movements;
    @Autowired ServiceLineRepository serviceLines;

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    @Transactional
    void addServiceReplayDecrementsStockAndWritesExactlyOneCanonicalIssue() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("frontdesk", "", "ROLE_FRONT_DESK"));
        Reservation reservation = seedReservation();
        Service service = services.findById("MINI").orElseThrow();

        ReservationDtos.AddServiceRequest request =
                new ReservationDtos.AddServiceRequest("MINI", 2, LocalDateTime.of(2033, 1, 2, 10, 0));
        ReservationDtos.Response first = reservations.addService(reservation.getId(), request, "frontdesk", "service-1");
        ReservationDtos.Response replay = reservations.addService(reservation.getId(), request, "frontdesk", "service-1");

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(services.findById("MINI").orElseThrow().getStockQuantity()).isEqualTo(3);
        assertThat(serviceLines.findAll()).singleElement().satisfies(line -> assertThat(line.getQuantity()).isEqualTo(2));
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("MINI")).singleElement().satisfies(movement -> {
            assertThat(movement.getType()).isEqualTo(InventoryMovement.MovementType.ISSUE);
            assertThat(movement.getQuantity()).isEqualTo(2);
            assertThat(movement.getActorId()).isEqualTo("frontdesk");
            assertThat(movement.getReason()).isEqualTo("RESERVATION_SERVICE:" + reservation.getId());
        });
    }

    private Reservation seedReservation() {
        Guest guest = new Guest();
        guest.setFullName("Inventory Producer Guest"); guest.setPhone("0900000301");
        guest.setIdentityNumber("013000000001"); guests.saveAndFlush(guest);

        Employee employee = new Employee();
        employee.setEmployeeId("frontdesk"); employee.setFullName("Front Desk"); employee.setPassword("hash");
        employee.setRole(EmployeeRole.FRONT_DESK); employee.setPhone("0900000302"); employees.saveAndFlush(employee);

        RoomType roomType = new RoomType(); roomType.setId("RTINV"); roomType.setName("Inventory Test");
        roomType.setDailyPrice(new BigDecimal("100")); roomTypes.saveAndFlush(roomType);
        Room room = new Room(); room.setId("RINV1"); room.setName("Inventory Room"); room.setRoomType(roomType);
        room.setStatus(RoomStatus.RESERVED); rooms.saveAndFlush(room);

        Service service = new Service(); service.setId("MINI"); service.setName("Minibar water");
        service.setPrice(new BigDecimal("10")); service.setUnit("BOTTLE"); service.setStockQuantity(5);
        service.setSafetyThreshold(1); services.saveAndFlush(service);

        Reservation reservation = new Reservation(); reservation.setGuest(guest); reservation.setEmployee(employee);
        reservation.setDepositAmount(BigDecimal.ZERO); reservation.setRentalType("PACKAGE");
        reservation.transitionTo(ReservationStatus.CONFIRMED); reservation.transitionTo(ReservationStatus.CHECKED_IN);
        ReservationRoom line = new ReservationRoom(); line.setRoom(room);
        line.setCheckIn(LocalDateTime.of(2033, 1, 1, 14, 0)); line.setCheckOut(LocalDateTime.of(2033, 1, 3, 12, 0));
        line.setStatus(RoomStatus.RESERVED); reservation.addRoom(line);
        return reservationRepository.saveAndFlush(reservation);
    }
}
