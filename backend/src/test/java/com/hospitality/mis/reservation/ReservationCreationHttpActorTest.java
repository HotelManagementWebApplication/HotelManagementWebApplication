package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.ServiceLineRepository;
import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.entity.room.Room;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:reservationcreationhttpactor;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
/** Bảo vệ actor binding khi tạo reservation HTTP và guest port resolution. */
class ReservationCreationHttpActorTest {
    /** Boundary HTTP thật để kiểm tra authentication và request validation. */
    @Autowired MockMvc mockMvc;

    @MockBean ReservationRepository reservations;
    @MockBean GuestStore sharedGuests;
    @MockBean EmployeeRepository employees;
    @MockBean RoomRepository rooms;
    @MockBean AuditService audit;
    @MockBean BillingService billing;
    @MockBean ServiceRepository serviceCatalog;
    @MockBean ServiceLineRepository serviceLines;
    @MockBean EquipmentIncidentService incidents;

    /** Guest shared được resolve từ guest_id 41, không lấy actor/client làm nguồn danh tính. */
    private Guest guest;
    /** Employee frontdesk canonical được attach vào reservation mới. */
    private Employee employee;

    /** Stub happy path: guest/employee/room tồn tại, không overlap và save trả id 100. */
    @BeforeEach
    void stubSuccessfulCreation() {
        guest = new Guest();
        guest.setId(41L);
        guest.setFullName("Shared Reservation Guest");
        guest.setIdentityNumber("001001001001");
        guest.setPhone("0901000001");

        employee = new Employee();
        employee.setEmployeeId("frontdesk");

        Room room = new Room();
        room.setId("101");

        when(sharedGuests.findSharedById(41L)).thenReturn(Optional.of(guest));
        when(employees.findById("frontdesk")).thenReturn(Optional.of(employee));
        when(rooms.findAllForUpdateOrdered(List.of("101"))).thenReturn(List.of(room));
        when(reservations.hasOverlap(eq("101"), any(LocalDateTime.class), any(LocalDateTime.class),
                any(), anyList(), any(LocalDateTime.class))).thenReturn(false);
        when(reservations.saveAndFlush(any(Reservation.class))).thenAnswer(invocation -> {
            Reservation saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 100L);
            return saved;
        });
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    /** Given employee_id khớp principal, When POST create, Then CONFIRMED và attach đúng guest fixture. */
    void matchingAuthenticatedPrincipalCreatesConfirmedReservationWithResolvedGuest() throws Exception {
        mockMvc.perform(post("/api/reservations")
                        .contentType(APPLICATION_JSON)
                        .content(validCreateRequest("frontdesk")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.guest_id").value(41))
                .andExpect(jsonPath("$.employee_id").value("frontdesk"))
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        verify(sharedGuests).findSharedById(41L);
        ArgumentCaptor<Reservation> saved = ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getGuest()).isSameAs(guest);
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    /** Given client spoof employee_id manager, When POST, Then ACTOR_MISMATCH trước lookup/save. */
    void spoofedEmployeeIdIsRejectedBeforeGuestLookupOrSave() throws Exception {
        mockMvc.perform(post("/api/reservations")
                        .contentType(APPLICATION_JSON)
                        .content(validCreateRequest("manager")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.code").value("ACTOR_MISMATCH"));

        verify(sharedGuests, never()).findSharedById(anyLong());
        verify(reservations, never()).saveAndFlush(any(Reservation.class));
    }

    @Test
    /** Given anonymous request, When POST, Then 401 và không chạm guest/repository. */
    void anonymousCreationIsRejectedBeforeGuestLookupOrSave() throws Exception {
        mockMvc.perform(post("/api/reservations")
                        .contentType(APPLICATION_JSON)
                        .content(validCreateRequest("frontdesk")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

        verify(sharedGuests, never()).findSharedById(anyLong());
        verify(reservations, never()).saveAndFlush(any(Reservation.class));
    }

    /** Tạo JSON canonical với room/time/idempotency cố định; employeeId dùng cho spoof case. */
    private static String validCreateRequest(String employeeId) {
        return """
                {
                  "guest_id":41,
                  "employee_id":"%s",
                  "deposit":0,
                  "rental_type":"PACKAGE",
                  "rooms":[{
                    "room_id":"101",
                    "expected_check_in":"2031-01-10T14:00:00",
                    "expected_check_out":"2031-01-11T12:00:00"
                  }],
                  "idempotency_key":"reservation-actor-proof"
                }
                """.formatted(employeeId);
    }
}
