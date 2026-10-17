package com.hospitality.mis.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP proof for the query names consumed by the shared frontend API clients. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}", "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}", "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class QueryParameterContractTest {
    @Autowired MockMvc mockMvc;

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    void camelCaseRoomIdFiltersBindAndReturnArrays() throws Exception {
        mockMvc.perform(get("/api/operations/housekeeping/tasks")
                        .param("roomId", "R-101")
                        .param("status", "NEEDS_CLEANING"))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "technical", roles = "TECHNICAL")
    void technicalCamelCaseRoomIdFilterBindsAndRejectsInvalidStatus() throws Exception {
        mockMvc.perform(get("/api/operations/technical/work-orders")
                        .param("roomId", "R-101")
                        .param("status", "NEW"))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/operations/technical/work-orders").param("status", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void exactSnakeCaseNamesBindTypedFiltersAndKeepPagedShape() throws Exception {
        mockMvc.perform(get("/api/finance/payments").param("invoice_id", "not-a-number"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/finance/ledger").param("entry_type", "PAYMENT").param("page", "0").param("size", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.total_elements").isNumber());
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void queryEndpointsEnforceTheirReadPermission() throws Exception {
        mockMvc.perform(get("/api/operations/housekeeping/tasks").param("roomId", "R-101"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void invoiceIdReservationIdAndEntryTypeFiltersBindToPagedShapes() throws Exception {
        mockMvc.perform(get("/api/invoices").param("reservation_id", "999999").param("page", "0").param("size", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(5));

        mockMvc.perform(get("/api/finance/payments").param("invoice_id", "999999").param("page", "0").param("size", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(5));

        mockMvc.perform(get("/api/finance/ledger").param("entry_type", "PAYMENT").param("page", "0").param("size", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(5));
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void invalidTypedQueryValuesFailAtTheHttpBoundary() throws Exception {
        mockMvc.perform(get("/api/invoices").param("reservation_id", "not-a-number"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/invoices").param("status", "NOT_A_PAYMENT_STATUS"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/finance/payments").param("method", "NOT_A_METHOD"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void reservationGuestIdFilterBindsToPagedResponse() throws Exception {
        mockMvc.perform(get("/api/reservations").param("guest_id", "999999").param("page", "0").param("size", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(5));
    }

    @Test
    void publicTypeFilterBindsAndMissingRequiredDatesAreRejected() throws Exception {
        mockMvc.perform(get("/api/public/rooms").param("type", "STD"))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/api/public/rooms/availability").param("from", "not-a-date").param("to", "2031-01-11T12:00:00"))
                .andExpect(status().isBadRequest());
    }
}
