package com.hospitality.mis.guest;

import com.hospitality.mis.dto.guest.GuestDtos;
import com.hospitality.mis.service.guest.GuestService;
import com.hospitality.mis.entity.guest.MembershipTier;
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
/** Kiểm tra scope đọc guest qua HTTP với service mock, tách RBAC khỏi nghiệp vụ guest. */
class GuestControllerHttpScopeTest {
    /** Boundary HTTP dùng security filter và exception handler thật. */
    @Autowired MockMvc mockMvc;

    /** Service mock trả cùng guest cho các role được phép đọc. */
    @MockBean GuestService service;

    /** Seed response id 7 để mọi role assertion cùng một fixture. */
    @BeforeEach
    void stubSharedGuest() {
        when(service.get(7L)).thenReturn(sharedGuest());
        when(service.search("binh")).thenReturn(List.of(sharedGuest()));
    }

    /** Anonymous không có authentication nên bị 401 trước khi gọi service. */
    @Test
    void anonymousReadReturnsStableUnauthorizedError() throws Exception {
        mockMvc.perform(get("/api/guests/{id}", 7L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    /** Given front desk, When đọc guest chung, Then trả 200 và id fixture 7. */
    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void frontDeskCanReadSharedGuestOverHttp() throws Exception {
        mockMvc.perform(get("/api/guests/{id}", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7));
    }

    /** Given front desk, When search, Then service result được bind thành response HTTP. */
    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void frontDeskCanSearchSharedGuestsOverHttp() throws Exception {
        mockMvc.perform(get("/api/guests").param("q", "binh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7));
    }

    /** Given staff không thuộc nhóm guest reader, When đọc, Then bị 403. */
    @Test
    @WithMockUser(username = "staff", roles = "STAFF")
    void unauthorizedGuestRoleReturnsStableForbiddenError() throws Exception {
        mockMvc.perform(get("/api/guests/{id}", 7L))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    /** Manager có quyền đọc shared guest trên toàn hệ thống. */
    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void managerCanReadSharedGuest() throws Exception {
        assertSharedReadSucceeds();
    }

    /** Director có quyền đọc shared guest trên toàn hệ thống. */
    @Test
    @WithMockUser(username = "director", roles = "DIRECTOR")
    void directorCanReadSharedGuest() throws Exception {
        assertSharedReadSucceeds();
    }

    /** Admin có quyền đọc shared guest trên toàn hệ thống. */
    @Test
    @WithMockUser(username = "admin", roles = "ADMIN")
    void adminCanReadSharedGuest() throws Exception {
        assertSharedReadSucceeds();
    }

    /** Helper dùng chung assertion HTTP 200 cho các role global reader. */
    private void assertSharedReadSucceeds() throws Exception {
        mockMvc.perform(get("/api/guests/{id}", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7));
    }

    /** Fixture DTO id 7; zero spend và STANDARD là trạng thái mặc định có ý nghĩa. */
    private static GuestDtos.Response sharedGuest() {
        return new GuestDtos.Response(7L, "Tran Thi Binh", 1990, "098765432109",
                "0912345678", "binh@example.test", "Quan 1", MembershipTier.STANDARD,
                BigDecimal.ZERO, 0, 0, false);
    }
}
