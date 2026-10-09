package com.hospitality.mis.reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;


import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
/** Kiểm tra scope/read contract reservation qua HTTP với service mock. */
class ReservationControllerHttpScopeTest {
    /** MockMvc boundary thật của security và JSON mapping. */
    @Autowired MockMvc mockMvc;

    /** Service mock trả response reservation thuộc frontdesk. */
    @MockBean ReservationService service;
    /** Incident mock để context controller khởi động mà không kéo nghiệp vụ operations. */
    @MockBean EquipmentIncidentService incidents;

    /** Seed reservation id 7 cho mọi read-scope case. */
    @BeforeEach
    void stubReservation() {
        when(service.get(7L)).thenReturn(responseOwnedBy("frontdesk"));
    }

    /** Given filter snake_case, When list, Then service nhận đúng args và page metadata giữ nguyên. */
    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void listBindsSnakeCaseFiltersAndReturnsPageMetadata() throws Exception {
        when(service.list(ReservationStatus.CONFIRMED, 11L, 1, 10))
                .thenReturn(new ReservationDtos.PageResponse(List.of(responseOwnedBy("frontdesk")), 1, 10, 11, 2));
        mockMvc.perform(get("/api/reservations").param("status", "CONFIRMED")
                        .param("guest_id", "11").param("page", "1").param("size", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].guest_id").value(11))
                .andExpect(jsonPath("$.total_elements").value(11)).andExpect(jsonPath("$.total_pages").value(2));
    }

    /** Customer không có staff reservation read nên bị 403. */
    @Test
    @WithMockUser(username = "customer", roles = "CUSTOMER")
    void customerCannotReadStaffReservationList() throws Exception {
        mockMvc.perform(get("/api/reservations")).andExpect(status().isForbidden());
    }

    /** Owner frontdesk đọc reservation của mình qua HTTP. */
    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void ownerReadSucceedsOverHttp() throws Exception {
        mockMvc.perform(get("/api/reservations/{id}", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.employee_id").value("frontdesk"));
    }

    /** Ca sau vẫn đọc booking của ca trước, bảo vệ cross-shift continuity. */
    @Test
    @WithMockUser(username = "other", roles = "FRONT_DESK")
    void nextShiftCanReadReservation() throws Exception {
        mockMvc.perform(get("/api/reservations/{id}", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employee_id").value("frontdesk"))
                .andExpect(jsonPath("$.deposit_payment_status").value("NOT_REQUIRED"));
    }

    /** Manager có global read scope. */
    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void managerHasGlobalRead() throws Exception {
        assertGlobalRead("manager");
    }

    /** Director có global read scope. */
    @Test
    @WithMockUser(username = "director", roles = "DIRECTOR")
    void directorHasGlobalRead() throws Exception {
        assertGlobalRead("director");
    }

    /** Admin có global read scope. */
    @Test
    @WithMockUser(username = "admin", roles = "ADMIN")
    void adminHasGlobalRead() throws Exception {
        assertGlobalRead("admin");
    }

    /** Helper dùng chung assertion read 200 và owner id không bị đổi. */
    private void assertGlobalRead(String actor) throws Exception {
        mockMvc.perform(get("/api/reservations/{id}", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employee_id").value("frontdesk"));
    }

    /** Fixture response id 7/guest 11; employeeId thay đổi để kiểm tra scope. */
    private static ReservationDtos.Response responseOwnedBy(String employeeId) {
        return new ReservationDtos.Response(7L, 11L, employeeId,
                com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED,
                ReservationDtos.RentalType.PACKAGE, BigDecimal.ZERO, null, null, null, List.of(),
                null, null, "DIRECT", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                "NOT_APPLICABLE", List.of(), null,
                com.hospitality.mis.entity.reservation.DepositPaymentStatus.NOT_REQUIRED);
    }
}
