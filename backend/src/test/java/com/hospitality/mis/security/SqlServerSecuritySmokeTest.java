package com.hospitality.mis.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dao.auth.RefreshTokenRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Kiểm tra nhanh bảo mật trên SQL Server thực tế mà không xóa schema QLKS. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class SqlServerSecuritySmokeTest {
    /** Employee fixture id dùng để seed và cleanup mà không đụng dữ liệu ngoài test. */
    private static final String EMPLOYEE_ID = "msec001";
    /** Phone unique cho row employee fixture. */
    private static final String PHONE = "0999999001";
    /** Plain password chỉ dùng input login; expected storage là hash. */
    private static final String PASSWORD = "sqlserver-sec-password";

    /** HTTP boundary thật trên SQL Server schema hiện hành. */
    @Autowired MockMvc mvc;
    /** Repository employee để seed/disable actor. */
    @Autowired EmployeeRepository employees;
    /** Repository refresh để kiểm tra token revoke. */
    @Autowired RefreshTokenRepository refreshTokens;
    /** Encoder tạo hash seed. */
    @Autowired PasswordEncoder passwordEncoder;
    /** Mapper đọc access token. */
    @Autowired ObjectMapper objectMapper;
    /** SQL audit assertion. */
    @Autowired JdbcTemplate jdbc;

    /** Seed employee enabled trước mỗi smoke case. */
    @BeforeEach
    void seed() {
        refreshTokens.deleteAll();
        jdbc.update("delete from NhatKyKiemSoat where nguoiThucHien = ?", EMPLOYEE_ID);
        employees.findById(EMPLOYEE_ID).ifPresent(employees::delete);
        Employee employee = new Employee();
        employee.setEmployeeId(EMPLOYEE_ID);
        employee.setFullName("SQL Server Security Test");
        employee.setPassword(passwordEncoder.encode(PASSWORD));
        employee.setPhone(PHONE);
        employee.setRole(EmployeeRole.FRONT_DESK);
        employees.saveAndFlush(employee);
    }

    @AfterEach
    /** Xóa refresh/audit/employee fixture để SQL Server test có thể chạy lặp. */
    void cleanup() {
        refreshTokens.deleteAll();
        jdbc.update("delete from NhatKyKiemSoat where nguoiThucHien = ?", EMPLOYEE_ID);
        employees.findById(EMPLOYEE_ID).ifPresent(employees::delete);
    }

    @Test
    /** Given request anonymous, When gọi API SQL Server-backed, Then authentication bị từ chối. */
    void anonymousRequestIsRejectedBySqlServerBackedApplication() throws Exception {
        mvc.perform(get("/api/services"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    /** Given staff token, When đọc/ghi endpoint, Then read được nhưng write ngoài department bị 403. */
    void authenticatedStaffCanReadButCannotWriteDepartmentData() throws Exception {
        JsonNode token = login();
        String bearer = "Bearer " + token.get("access_token").asText();
        mvc.perform(get("/api/services").header(AUTHORIZATION, bearer))
                .andExpect(status().isOk());
        mvc.perform(post("/api/services").header(AUTHORIZATION, bearer)
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":\"SEC1\",\"name\":\"Test\",\"price\":1,\"opening_stock\":0,\"safety_threshold\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    /** Given access token hợp lệ rồi disable account, When dùng token cũ, Then request bị reject. */
    void tokenIsRejectedAfterSqlServerAccountIsDisabled() throws Exception {
        JsonNode token = login();
        Employee employee = employees.findById(EMPLOYEE_ID).orElseThrow();
        employee.setEnabled(false);
        employees.saveAndFlush(employee);
        mvc.perform(get("/api/services")
                        .header(AUTHORIZATION, "Bearer " + token.get("access_token").asText()))
                .andExpect(status().isUnauthorized());
    }

    /** Login employee fixture và parse token response. */
    private JsonNode login() throws Exception {
        return objectMapper.readTree(mvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AuthDtos.LoginRequest(EMPLOYEE_ID, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
