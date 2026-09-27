package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.ServiceLineRepository;
import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.service.reservation.ReservationService;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.entity.room.Room;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
/** Bảo vệ reservation service dùng GuestStore shared port và attach entity đã resolve. */
class ReservationServiceGuestPortTest {
    @org.junit.jupiter.api.BeforeEach
    /** Đặt frontdesk actor hợp lệ cho create. */
    void authenticateActor() {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
            new org.springframework.security.authentication.TestingAuthenticationToken("frontdesk", "", "ROLE_FRONT_DESK"));
    }
    @org.junit.jupiter.api.AfterEach
    /** Dọn actor sau test. */
    void clearActor() { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }

    /** Reservation repository mock; verify save và overlap check của create. */
    @Mock ReservationRepository reservations;
    /** Shared GuestStore là port bắt buộc: service phải resolve guest chung qua đây. */
    @Mock GuestStore sharedGuests;
    /** Employee lookup mock cho actor owner. */
    @Mock EmployeeRepository employees;
    /** Room lock/availability mock cho line reservation. */
    @Mock RoomRepository rooms;
    /** Audit mock giữ construction service đúng production graph. */
    @Mock AuditService audit;
    /** Billing, catalog và inventory ports không được test này giả lập thành model khác. */
    @Mock BillingService billing;
    @Mock ServiceRepository serviceCatalog;
    @Mock ServiceLineRepository serviceLines;
    @Mock InventoryMovementRepository inventoryMovements;

    @Test
    /** Given guest_id 41 resolve thành guest chung, When create, Then reservation attach đúng object và response id. */
    void createUsesSharedGuestPortAndAttachesResolvedGuestToReservation() {
        Guest guest = guest(41L);
        Employee employee = employee("frontdesk");
        Room room = new Room();
        room.setId("101");

        when(sharedGuests.findSharedById(41L)).thenReturn(Optional.of(guest));
        when(employees.findById("frontdesk")).thenReturn(Optional.of(employee));
        when(rooms.findAllForUpdateOrdered(List.of("101"))).thenReturn(List.of(room));
        when(reservations.hasOverlap(eq("101"), any(), any(), any(), any(), any())).thenReturn(false);
        when(reservations.saveAndFlush(any(Reservation.class))).thenAnswer(invocation -> {
            Reservation saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 100L);
            return saved;
        });

        ReservationDtos.Response response = service().create(
                new ReservationDtos.CreateRequest(41L, "frontdesk", BigDecimal.ZERO,
                        ReservationDtos.RentalType.PACKAGE,
                        List.of(new ReservationDtos.RoomStay("101",
                                LocalDateTime.of(2026, 9, 10, 14, 0),
                                LocalDateTime.of(2026, 9, 11, 12, 0))),
                        "reservation-41"),
                "frontdesk");

        ArgumentCaptor<Reservation> saved = ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).saveAndFlush(saved.capture());
        verify(sharedGuests).findSharedById(41L);
        assertThat(saved.getValue().getGuest()).isSameAs(guest);
        assertThat(response.guestId()).isEqualTo(41L);
        assertThat(response.employeeId()).isEqualTo("frontdesk");
    }

    /** Dựng service thật với toàn bộ dependency mock của reservation create. */
    private ReservationService service() {
        return new ReservationService(reservations, sharedGuests, employees, rooms, audit, billing,
                serviceCatalog, serviceLines, inventoryMovements);
    }

    /** Guest fixture shared có identity/phone canonical để port lookup nhận diện. */
    private static Guest guest(Long id) {
        Guest guest = new Guest();
        guest.setId(id);
        guest.setFullName("Shared Reservation Guest");
        guest.setIdentityNumber("001001001001");
        guest.setPhone("0901000001");
        return guest;
    }

    /** Employee fixture tối thiểu cho reservation owner. */
    private static Employee employee(String id) {
        Employee employee = new Employee();
        employee.setEmployeeId(id);
        return employee;
    }
}
