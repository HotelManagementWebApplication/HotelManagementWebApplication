package com.hospitality.mis.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dao.auth.RefreshTokenRepository;
import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP proof for the current employee, shift and governance authorization contract. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class EmployeeAdminGovernanceHttpIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired EmployeeRepository employees;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired ApprovalRepository approvals;
    @Autowired AuditLogRepository audits;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanAndSeed() {
        jdbc.update("delete from CaLamViecNhanVien");
        jdbc.update("delete from SuKienDangNhapNhanVien");
        jdbc.update("delete from MaLamMoiDangNhap");
        jdbc.update("delete from YeuCauPheDuyet");
        jdbc.update("delete from NhatKyKiemSoat");
        jdbc.update("delete from NhanVien");
        save("director", EmployeeRole.DIRECTOR, "director-password");
        save("admin", EmployeeRole.ADMIN, "admin-password");
        save("manager", EmployeeRole.MANAGER, "manager-password");
        save("hr", EmployeeRole.HR, "hr-password");
        save("staff", EmployeeRole.STAFF, "staff-password");
    }

    @Test
    void employeeReadAndManagementMutationsEnforceHrCeilingsSelfGuardsAndSessionInvalidation() throws Exception {
        String hr = bearer(login("hr", "hr-password").get("access_token").asText());
        mockMvc.perform(get("/api/auth/employees").header("Authorization", hr))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].employee_id").exists());
        mockMvc.perform(get("/api/auth/employees/staff").header("Authorization", hr))
                .andExpect(status().isOk()).andExpect(jsonPath("$.password").doesNotExist());
        mockMvc.perform(get("/api/auth/employees/staff/sessions").header("Authorization", hr))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/employees/staff/login-history").header("Authorization", hr))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());

        String manager = bearer(login("manager", "manager-password").get("access_token").asText());
        String targetRefresh = login("staff", "staff-password").get("refresh_token").asText();

        mockMvc.perform(patch("/api/auth/employees/staff/status")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"enabled\":false,\"actor_id\":\"director\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        mockMvc.perform(patch("/api/auth/employees/staff/status")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new com.hospitality.mis.dto.auth.AuthDtos.RefreshRequest(targetRefresh))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(patch("/api/auth/employees/staff/role")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"role\":\"HR\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("HR"));
        mockMvc.perform(patch("/api/auth/employees/staff/role")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/staff/employment")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"status\":\"ON_LEAVE\",\"leave_start\":\"2026-09-20\",\"leave_end\":\"2026-09-22\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.employment_status").value("ON_LEAVE"));

        mockMvc.perform(post("/api/auth/employees/staff/password")
                        .header("Authorization", manager).contentType(APPLICATION_JSON)
                        .content("{\"password\":\"reset-password\"}"))
                .andExpect(status().isNoContent());
        assertThat(passwordEncoder.matches("reset-password", employees.findById("staff").orElseThrow().getPassword())).isTrue();

        String secondStaffRefresh = login("staff", "reset-password").get("refresh_token").asText();
        JsonNode sessions = objectMapper.readTree(mockMvc.perform(get("/api/auth/employees/staff/sessions")
                        .header("Authorization", manager)).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
        long sessionId = sessions.get(0).get("id").asLong();
        mockMvc.perform(delete("/api/auth/employees/staff/sessions/{id}", sessionId)
                        .header("Authorization", manager))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new com.hospitality.mis.dto.auth.AuthDtos.RefreshRequest(secondStaffRefresh))))
                .andExpect(status().isUnauthorized());

        String hrToken = bearer(login("hr", "hr-password").get("access_token").asText());
        mockMvc.perform(patch("/api/auth/employees/staff/status").header("Authorization", hrToken)
                        .contentType(APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/staff/role").header("Authorization", hrToken)
                        .contentType(APPLICATION_JSON).content("{\"role\":\"STAFF\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/staff/employment").header("Authorization", hrToken)
                        .contentType(APPLICATION_JSON).content("{\"status\":\"WORKING\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/employees/staff/password").header("Authorization", hrToken)
                        .contentType(APPLICATION_JSON).content("{\"password\":\"another-password\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/auth/employees/staff/sessions/1").header("Authorization", hrToken))
                .andExpect(status().isForbidden());

        String admin = bearer(login("admin", "admin-password").get("access_token").asText());
        mockMvc.perform(patch("/api/auth/employees/director/status").header("Authorization", admin)
                        .contentType(APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/director/role").header("Authorization", admin)
                        .contentType(APPLICATION_JSON).content("{\"role\":\"MANAGER\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/employees/director/password").header("Authorization", admin)
                        .contentType(APPLICATION_JSON).content("{\"password\":\"another-password\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/director/employment").header("Authorization", admin)
                        .contentType(APPLICATION_JSON).content("{\"status\":\"WORKING\"}"))
                .andExpect(status().isForbidden());

        String director = bearer(login("director", "director-password").get("access_token").asText());
        mockMvc.perform(patch("/api/auth/employees/director/role").header("Authorization", director)
                        .contentType(APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/auth/employees/director/status").header("Authorization", director)
                        .contentType(APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN"));
        mockMvc.perform(patch("/api/auth/employees/director/employment").header("Authorization", director)
                        .contentType(APPLICATION_JSON).content("{\"status\":\"TERMINATED\"}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN"));
    }

    @Test
    void shiftMutationsBindCreatedByAndAuditToAuthenticatedActor() throws Exception {
        String hr = bearer(login("hr", "hr-password").get("access_token").asText());
        String assigned = mockMvc.perform(post("/api/hr/shifts").header("Authorization", hr).contentType(APPLICATION_JSON)
                        .content("{\"employee_id\":\"staff\",\"shift_date\":\"2026-09-21\",\"shift_code\":\"AM\",\"starts_at\":\"2026-09-21T08:00:00\",\"ends_at\":\"2026-09-21T16:00:00\",\"actor_id\":\"director\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.created_by").value("hr"))
                .andReturn().getResponse().getContentAsString();
        long shiftId = objectMapper.readTree(assigned).get("id").asLong();
        mockMvc.perform(get("/api/hr/shifts").header("Authorization", hr)
                        .param("date", "2026-09-21").param("employeeId", "staff"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].employee_id").value("staff"));
        mockMvc.perform(get("/api/hr/shifts/coverage").header("Authorization", hr)
                        .param("date", "2026-09-21").param("shiftCode", "AM").param("minimum_staff", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigned_staff").value(1));
        mockMvc.perform(put("/api/hr/shifts/{id}", shiftId).header("Authorization", hr).contentType(APPLICATION_JSON)
                        .content("{\"shift_date\":\"2026-09-21\",\"shift_code\":\"DAY\",\"starts_at\":\"2026-09-21T09:00:00\",\"ends_at\":\"2026-09-21T17:00:00\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.shift_code").value("DAY"));
        mockMvc.perform(patch("/api/hr/shifts/{id}/status", shiftId).header("Authorization", hr)
                        .contentType(APPLICATION_JSON).content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(get("/api/governance/audit").header("Authorization", bearer(login("director", "director-password").get("access_token").asText())))
                .andExpect(status().isOk());
        assertThat(audits.findAll().stream()
                .anyMatch(item -> "EMPLOYEE_SHIFT_ASSIGNED".equals(item.getAction()) && "hr".equals(item.getActor()))).isTrue();
    }

    @Test
    void approvalRequestUsesAuthenticatedRequesterAndRequesterCannotApproveItself() throws Exception {
        String manager = bearer(login("manager", "manager-password").get("access_token").asText());
        String approvalBody = "{\"action\":\"PRICE_OVERRIDE\",\"target_id\":\"price-1\",\"payload\":\"{}\",\"reason\":\"review\",\"idempotency_key\":\"http-approval-1\",\"requester\":\"director\"}";
        String approval = mockMvc.perform(post("/api/governance/approvals").header("Authorization", manager)
                        .contentType(APPLICATION_JSON).content(approvalBody))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.requester").value("manager"))
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(approval).get("id").asLong();
        mockMvc.perform(post("/api/governance/approvals/{id}/approve", id).header("Authorization", manager))
                .andExpect(status().isForbidden());

        String director = bearer(login("director", "director-password").get("access_token").asText());
        mockMvc.perform(post("/api/governance/approvals/{id}/approve", id).header("Authorization", director))
                .andExpect(status().isOk()).andExpect(jsonPath("$.approver").value("director"));
        mockMvc.perform(get("/api/governance/audit").header("Authorization", director)
                        .param("entity_type", "APPROVAL").param("entity_id", String.valueOf(id)))
                .andExpect(status().isOk());
    }

    private Employee save(String id, EmployeeRole role, String password) {
        Employee employee = new Employee();
        employee.setEmployeeId(id);
        employee.setFullName(id);
        employee.setPassword(passwordEncoder.encode(password));
        employee.setRole(role);
        employee.setPhone("090" + Math.abs(id.hashCode()));
        return employees.saveAndFlush(employee);
    }

    private JsonNode login(String id, String password) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content(json(new com.hospitality.mis.dto.auth.AuthDtos.LoginRequest(id, password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private String bearer(String token) { return "Bearer " + token; }

    private String json(Object value) throws Exception { return objectMapper.writeValueAsString(value); }
}
