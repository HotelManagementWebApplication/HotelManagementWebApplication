package com.hospitality.mis.security;

import com.hospitality.mis.middleware.security.EmployeeUserDetailsService;


import com.fasterxml.jackson.databind.JsonNode;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.hospitality.mis.dao.auth.RefreshTokenRepository;

import com.hospitality.mis.dto.auth.AuthDtos;

import com.hospitality.mis.service.auth.JwtTokenService;

import com.hospitality.mis.dao.governance.ApprovalRepository;

import com.hospitality.mis.entity.governance.ApprovalRequest;

import com.hospitality.mis.dao.identity.EmployeeRepository;

import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import org.junit.jupiter.api.BeforeEach;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import org.springframework.boot.test.context.SpringBootTest;

import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.security.core.userdetails.UserDetails;

import org.springframework.security.core.userdetails.UserDetailsService;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;

import org.springframework.security.oauth2.jwt.JwsHeader;

import org.springframework.security.oauth2.jwt.JwtClaimsSet;

import org.springframework.security.oauth2.jwt.JwtEncoder;

import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import org.springframework.test.web.servlet.MockMvc;



import java.nio.charset.StandardCharsets;

import java.time.Instant;

import java.util.Base64;

import java.util.List;



import static org.assertj.core.api.Assertions.assertThat;

import static org.junit.jupiter.api.Assertions.assertEquals;

import static org.junit.jupiter.api.Assertions.assertTrue;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;

import static org.springframework.http.HttpHeaders.ORIGIN;

import static org.springframework.http.MediaType.APPLICATION_JSON;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


@SpringBootTest(properties = {

        "spring.datasource.url=jdbc:h2:mem:securitytest;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",

        "spring.datasource.username=sa",

        "spring.datasource.password=",

        "spring.flyway.enabled=false",

        "spring.jpa.hibernate.ddl-auto=create-drop"

})

@AutoConfigureMockMvc

/** Bảo vệ security integration: token lifecycle, account state, role policy, audit và CORS. */
class SecurityIntegrationTest {

    /** MockMvc thật chạy qua filter/controller với H2 schema sạch. */
    @Autowired MockMvc mockMvc;

    /** Employee repository dùng seed, lock, disable và role administration assertions. */
    @Autowired EmployeeRepository employees;

    /** Approval repository cho self-approval/director policy. */
    @Autowired ApprovalRepository approvals;

    /** Refresh token repository để kiểm tra hash, rotation và revoke family. */
    @Autowired RefreshTokenRepository refreshTokens;

    /** Encoder thật; expected storage luôn là BCrypt. */
    @Autowired PasswordEncoder passwordEncoder;

    /** UserDetails service dùng kiểm tra authority runtime. */
    @Autowired UserDetailsService userDetailsService;

    /** Encoder JWT dùng tạo token hết hạn phục vụ negative security case. */
    @Autowired JwtEncoder jwtEncoder;

    /** Mapper dựng/đọc payload auth canonical. */
    @Autowired ObjectMapper objectMapper;

    /** SQL audit assertion cho login fail và actor binding. */
    @Autowired JdbcTemplate jdbc;



    @BeforeEach

    /** Xóa token/approval/employee và seed role fixture trước mỗi test độc lập. */
    void seedUsers() {

        refreshTokens.deleteAll();

        approvals.deleteAll();

        employees.deleteAll();

        jdbc.update("delete from NhatKyKiemSoat");
        employees.save(employee("admin", "admin-password", EmployeeRole.ADMIN, "0900000000"));
        employees.save(employee("director", "director-password", EmployeeRole.DIRECTOR, "0900000010"));
        employees.save(employee("manager", "manager-password", EmployeeRole.MANAGER, "0900000001"));
        employees.save(employee("hr", "hr-password", EmployeeRole.HR, "0900000011"));
        employees.save(employee("frontdesk", "frontdesk-password", EmployeeRole.FRONT_DESK, "0900000002"));
        employees.save(employee("staff", "staff-password", EmployeeRole.STAFF, "0900000003"));
        employees.save(employee("kitchen", "kitchen-password", EmployeeRole.KITCHEN, "0900000004"));
        employees.flush();

    }



    @Test

    /** Given không có bearer, When gọi API protected, Then trả 401 và error canonical. */
    void unauthenticatedApiRequestIsRejected() throws Exception {

        mockMvc.perform(get("/api/services"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("application/json")))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"))
                .andExpect(jsonPath("$.message").value("Bạn cần đăng nhập để thực hiện thao tác này"))
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());
    }



    @Test

    /** Given anonymous, When gọi health/OpenAPI, Then public endpoints vẫn 200. */
    void healthAndOpenApiRemainPublic() throws Exception {

        mockMvc.perform(get("/actuator/health"))

                .andExpect(status().isOk());

        mockMvc.perform(get("/v3/api-docs"))

                .andExpect(status().isOk());

    }



    @Test

    /** Given credentials manager, When login, Then bearer TTL/refresh contract đúng và Basic bị từ chối. */
    void loginReturnsBearerTokensAndBasicIsRejected() throws Exception {

        JsonNode tokens = login("manager", "manager-password");

        assertThat(tokens.get("token_type").asText()).isEqualTo("Bearer");
        assertThat(tokens.get("expires_in").asLong()).isEqualTo(900L);
        assertThat(tokens.get("refresh_expires_in").asLong()).isEqualTo(7L * 24 * 60 * 60);
        assertThat(tokens.get("access_token").asText()).isNotBlank();
        assertThat(tokens.get("refresh_token").asText()).isNotBlank();


        mockMvc.perform(get("/api/services")

                        .header(AUTHORIZATION, bearer(tokens.get("access_token").asText())))
                .andExpect(status().isOk());



        mockMvc.perform(get("/api/services")

                        .header(AUTHORIZATION, basic("manager", "manager-password")))

                .andExpect(status().isUnauthorized());

    }



    @Test

    /** Given refresh token, When rotate rồi replay token cũ, Then cả family bị revoke chống reuse. */
    void refreshRotatesAndReuseRevokesTheFamily() throws Exception {

        JsonNode first = login("manager", "manager-password");

        assertThat(refreshTokens.findAll()).anySatisfy(token -> {

            assertThat(token.getTokenHash()).isEqualTo(JwtTokenService.hash(first.get("refresh_token").asText()));
            assertThat(token.getTokenHash()).isNotEqualTo(first.get("refresh_token").asText());
        });

        JsonNode rotated = refresh(first.get("refresh_token").asText());


        assertThat(rotated.get("refresh_token").asText())
                .isNotEqualTo(first.get("refresh_token").asText());
        mockMvc.perform(post("/api/auth/refresh")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.RefreshRequest(first.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/refresh")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.RefreshRequest(rotated.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());

    }



    @Test

    /** Given access+refresh hợp lệ, When logout, Then refresh row bị revoke và không refresh lại được. */
    void logoutRevokesRefreshToken() throws Exception {

        JsonNode tokens = login("manager", "manager-password");

        mockMvc.perform(post("/api/auth/logout")

                        .header(AUTHORIZATION, bearer(tokens.get("access_token").asText()))
                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.LogoutRequest(tokens.get("refresh_token").asText()))))
                .andExpect(status().isNoContent());



        mockMvc.perform(post("/api/auth/refresh")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.RefreshRequest(tokens.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());

    }



    @Test

    /** Given chữ ký giả hoặc exp quá khứ, When gọi API, Then JWT reject trước controller. */
    void invalidSignatureAndExpiredTokensAreRejected() throws Exception {

        JsonNode tokens = login("manager", "manager-password");

        String access = tokens.get("access_token").asText();
        String[] parts = access.split("\\.");

        String invalidSignature = parts[0] + "." + parts[1] + "." + Base64.getUrlEncoder()

                .withoutPadding().encodeToString("invalid-signature".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(get("/api/services").header(AUTHORIZATION, bearer(invalidSignature)))

                .andExpect(status().isUnauthorized());



        String expired = jwtEncoder.encode(JwtEncoderParameters.from(

                        JwsHeader.with(MacAlgorithm.HS256).type("JWT").keyId("hotel-mis").build(),

                        JwtClaimsSet.builder()

                                .subject("manager")

                                .issuedAt(Instant.now().minusSeconds(120))

                                .expiresAt(Instant.now().minusSeconds(60))

                                .claim("token_type", "access")

                                .build()))

                .getTokenValue();

        mockMvc.perform(get("/api/services").header(AUTHORIZATION, bearer(expired)))

                .andExpect(status().isUnauthorized());

    }



    @Test

    /** Given plaintext/malformed BCrypt credential, When login, Then không authenticate và trả 401. */
    void wrongPlaintextAndMalformedCostCredentialsAreRejectedWith401() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LoginRequest("manager", "wrong-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));


        Employee plaintext = employee("plaintext", "plaintext-password", EmployeeRole.FRONT_DESK, "0900000005");
        plaintext.setPassword("plaintext-password");

        employees.saveAndFlush(plaintext);

        Employee malformedCost = employee("badcost", "unused", EmployeeRole.FRONT_DESK, "0900000006");
        malformedCost.setPassword("$2a$03$" + "A".repeat(53));

        employees.saveAndFlush(malformedCost);



        for (String employeeId : List.of("plaintext", "badcost")) {

            mockMvc.perform(post("/api/auth/login")

                            .contentType(APPLICATION_JSON)

                            .content(json(new AuthDtos.LoginRequest(employeeId, "plaintext-password"))))

                    .andExpect(status().isUnauthorized());

        }
    }

    @Test
    /** Given năm password sai, When vượt threshold, Then audit đủ và account bị lock. */
    void failedLoginsAreAuditedAndLockTheAccountAtTheThreshold() throws Exception {
        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(APPLICATION_JSON)
                            .content(json(new AuthDtos.LoginRequest("staff", "wrong-password"))))
                    .andExpect(status().isUnauthorized());
        }

        Employee locked = employees.findById("staff").orElseThrow();
        assertThat(locked.getFailedLoginAttempts()).isEqualTo(5);
        assertThat(locked.isAccountNonLocked()).isFalse();
        assertThat(locked.getLastFailedLoginAt()).isNotNull();
        assertThat(jdbc.queryForObject(
                "select count(*) from NhatKyKiemSoat where nguoiThucHien = 'staff' and hanhDong = 'LOGIN_FAILED'",
                Integer.class)).isEqualTo(5);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LoginRequest("staff", "staff-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
    }

    @Test
    /** Given account disabled, When login, Then credentials không tạo token. */
    void disabledAccountCannotAuthenticate() throws Exception {
        Employee disabled = employees.findById("staff").orElseThrow();
        disabled.setEnabled(false);
        employees.saveAndFlush(disabled);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LoginRequest("staff", "staff-password"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
    }

    @Test
    /** Given access token đã phát, When disable hoặc lock account, Then token cũ cũng bị reject. */
    void existingAccessTokenIsRejectedAfterAccountIsDisabledOrLocked() throws Exception {
        JsonNode disabledTokens = login("staff", "staff-password");
        Employee disabled = employees.findById("staff").orElseThrow();
        disabled.setEnabled(false);
        employees.saveAndFlush(disabled);

        mockMvc.perform(get("/api/services")
                        .header(AUTHORIZATION, bearer(disabledTokens.get("access_token").asText())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

        seedUsers();
        JsonNode lockedTokens = login("staff", "staff-password");
        Employee locked = employees.findById("staff").orElseThrow();
        locked.setAccountNonLocked(false);
        employees.saveAndFlush(locked);

        mockMvc.perform(get("/api/services")
                        .header(AUTHORIZATION, bearer(lockedTokens.get("access_token").asText())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    /** Given refresh của account disabled/locked, When refresh, Then reject và revoke token hiện tại. */
    void refreshRejectsDisabledOrLockedAccountAndRevokesCurrentToken() throws Exception {
        JsonNode disabledTokens = login("staff", "staff-password");
        Employee disabled = employees.findById("staff").orElseThrow();
        disabled.setEnabled(false);
        employees.saveAndFlush(disabled);

        String disabledRefreshToken = disabledTokens.get("refresh_token").asText();
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(
                                disabledRefreshToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
        assertThat(refreshTokens.findAll()).anySatisfy(token -> {
            if (token.getTokenHash().equals(JwtTokenService.hash(disabledRefreshToken))) {
                assertThat(token.getRevokedAt()).isNotNull();
            }
        });
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(disabledRefreshToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        seedUsers();
        JsonNode lockedTokens = login("staff", "staff-password");
        Employee locked = employees.findById("staff").orElseThrow();
        locked.setAccountNonLocked(false);
        employees.saveAndFlush(locked);

        String lockedRefreshToken = lockedTokens.get("refresh_token").asText();
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(
                                lockedRefreshToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        assertThat(refreshTokens.findAll()).anySatisfy(token -> {
            if (token.getTokenHash().equals(JwtTokenService.hash(lockedRefreshToken))) {
                assertThat(token.getRevokedAt()).isNotNull();
            }
        });
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(lockedRefreshToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }


    @Test

    /** Given mọi EmployeeRole, When map authority/UserDetails, Then mapping exhaustive và quyền thật tồn tại. */
    void roleMappingIsExhaustiveAndUserDetailsHasRealAuthority() {

        for (EmployeeRole role : EmployeeRole.values()) assertEquals(role.name(), EmployeeUserDetailsService.roleFor(role));


        UserDetails user = userDetailsService.loadUserByUsername("manager");

        assertTrue(user.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER")));

        assertTrue(user.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PERMISSION_EMPLOYEE_PROVISION")));

        assertTrue(user.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PERMISSION_APPROVAL_APPROVE")));

        assertTrue(user.isAccountNonLocked());

        assertTrue(user.isEnabled());

    }



    @Test

    /** Given pending approval, When requester/manager approve, Then self-approval fail và manager được phép. */
    void onlyManagersCanApproveAndRequesterCannotSelfApprove() throws Exception {

        ApprovalRequest pending = approvals.saveAndFlush(

                new ApprovalRequest("frontdesk", "PRICE_OVERRIDE", "price-1", "{}",
                        com.hospitality.mis.service.governance.ApprovalService.fingerprintFor("{}"), null, "manager review", null, null));



        mockMvc.perform(post("/api/governance/approvals/{id}/approve", pending.getId())
                        .header(AUTHORIZATION, bearer(login("frontdesk", "frontdesk-password")

                                .get("access_token").asText())))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("application/json")))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.message").value("Bạn không có quyền thực hiện thao tác này"))
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());


        mockMvc.perform(post("/api/governance/approvals/{id}/approve", pending.getId())

                        .header(AUTHORIZATION, bearer(login("manager", "manager-password")

                                .get("access_token").asText())))
                .andExpect(status().isOk());



        ApprovalRequest self = approvals.saveAndFlush(

                new ApprovalRequest("manager", "PRICE_OVERRIDE", "price-2", "{}",
                        com.hospitality.mis.service.governance.ApprovalService.fingerprintFor("{}"), null, "cannot self approve", null, null));

        mockMvc.perform(post("/api/governance/approvals/{id}/approve", self.getId())

                        .header(AUTHORIZATION, bearer(login("manager", "manager-password")

                                .get("access_token").asText())))
                .andExpect(status().isForbidden());

    }



    @Test

    /** Given header actor giả mạo, When mutate, Then audit lấy principal trong SecurityContext. */
    void auditActorComesFromSecurityContextNotHeader() throws Exception {

        mockMvc.perform(post("/api/governance/approvals")

                        .header(AUTHORIZATION, bearer(login("frontdesk", "frontdesk-password")

                                .get("access_token").asText()))
                        .header("X-Actor-Id", "manager")

                        .contentType(APPLICATION_JSON)

                        .content("{\"action\":\"PRICE_OVERRIDE\",\"target_id\":\"price-2\",\"payload\":\"{}\",\"reason\":\"review\",\"idempotency_key\":\"security-audit-actor\"}"))

                .andExpect(status().isCreated());



        String actor = jdbc.queryForObject(

                "select top 1 nguoiThucHien from NhatKyKiemSoat where hanhDong = 'APPROVAL_REQUESTED' order by maNhatKyKiemSoat desc",
                String.class);

        assertEquals("frontdesk", actor);

        assertTrue(passwordEncoder.matches("manager-password",

                employees.findById("manager").orElseThrow().getPassword()));

    }



    @Test

    /** Given từng role không đủ quyền, When gọi mutation, Then trả 403 nhất quán. */
    void mutatingEndpointRoleChecksReturn403() throws Exception {

        String staffToken = bearer(login("staff", "staff-password").get("access_token").asText());
        mockMvc.perform(post("/api/auth/employees")

                        .header(AUTHORIZATION, staffToken)

                        .contentType(APPLICATION_JSON)

                        .content("{\"employee_id\":\"new\",\"full_name\":\"New\",\"password\":\"new-password\",\"role\":\"FRONT_DESK\",\"phone\":\"0900000007\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/services")

                        .header(AUTHORIZATION, staffToken)

                        .contentType(APPLICATION_JSON)

                        .content("{\"id\":\"S1\",\"name\":\"Water\",\"price\":1,\"opening_stock\":0,\"safety_threshold\":0}"))

                .andExpect(status().isForbidden());

    }



    @Test

    /** Given manager provision/reset, When đổi password, Then lưu BCrypt, không lộ password và revoke sessions. */
    void managerProvisioningAndPasswordResetAlwaysUseBcryptAndRevokeSessions() throws Exception {

        String managerToken = bearer(login("manager", "manager-password").get("access_token").asText());
        mockMvc.perform(post("/api/auth/employees")

                        .header(AUTHORIZATION, managerToken)

                        .contentType(APPLICATION_JSON)

                        .content("{\"employee_id\":\"prov01\",\"full_name\":\"Provisioned\",\"password\":\"initial-password\",\"role\":\"FRONT_DESK\",\"phone\":\"0900000008\"}"))
                .andExpect(status().isCreated())

                .andExpect(result -> assertThat(result.getResponse().getContentAsString()).doesNotContain("password"));



        String stored = employees.findById("prov01").orElseThrow().getPassword();

        assertTrue(EmployeeUserDetailsService.isBcryptHash(stored));

        assertTrue(passwordEncoder.matches("initial-password", stored));

        JsonNode provisionedTokens = login("prov01", "initial-password");



        mockMvc.perform(post(
                                "/api/auth/employees/{employeeId}/password", "prov01")
                        .header(AUTHORIZATION, managerToken)

                        .contentType(APPLICATION_JSON)

                        .content("{\"password\":\"reset-password\"}"))

                .andExpect(status().isNoContent());

        String resetStored = employees.findById("prov01").orElseThrow().getPassword();

        assertTrue(EmployeeUserDetailsService.isBcryptHash(resetStored));

        assertTrue(passwordEncoder.matches("reset-password", resetStored));

        mockMvc.perform(post("/api/auth/refresh")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.RefreshRequest(provisionedTokens.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());

        login("prov01", "reset-password");

    }

    @Test
    /** Given manager/admin/director, When provision/reset các role, Then owner ceiling được enforce từng chiều. */
    void employeeAdministrationEnforcesRoleCeilingsForProvisionAndReset() throws Exception {
        String managerToken = bearer(login("manager", "manager-password").get("access_token").asText());
        provision(managerToken, "m-admin", EmployeeRole.ADMIN, "0900000012")
                .andExpect(status().isForbidden());
        provision(managerToken, "m-direct", EmployeeRole.DIRECTOR, "0900000013")
                .andExpect(status().isForbidden());
        provision(managerToken, "m-hr", EmployeeRole.HR, "0900000014")
                .andExpect(status().isCreated());

        reset(managerToken, "director")
                .andExpect(status().isForbidden());
        reset(managerToken, "admin")
                .andExpect(status().isForbidden());
        reset(managerToken, "hr")
                .andExpect(status().isNoContent());

        String adminToken = bearer(login("admin", "admin-password").get("access_token").asText());
        provision(adminToken, "a-direct", EmployeeRole.DIRECTOR, "0900000015")
                .andExpect(status().isForbidden());
        provision(adminToken, "a-staff", EmployeeRole.STAFF, "0900000016")
                .andExpect(status().isCreated());
        reset(adminToken, "director")
                .andExpect(status().isForbidden());
        reset(adminToken, "manager")
                .andExpect(status().isNoContent());

        String directorToken = bearer(login("director", "director-password").get("access_token").asText());
        provision(directorToken, "d-admin", EmployeeRole.ADMIN, "0900000017")
                .andExpect(status().isCreated());
        provision(directorToken, "d-direct", EmployeeRole.DIRECTOR, "0900000018")
                .andExpect(status().isCreated());
        reset(directorToken, "admin")
                .andExpect(status().isNoContent());
        reset(directorToken, "director")
                .andExpect(status().isNoContent());
    }

    @Test
    /** Given HR, When đọc authority hoặc gọi admin/finance, Then không có quyền và mọi mutation bị 403. */
    void hrCannotProvisionOrResetAndHasNoFinancialPermissions() throws Exception {
        UserDetails hr = userDetailsService.loadUserByUsername("hr");
        assertThat(hr.getAuthorities()).extracting(a -> a.getAuthority())
                .containsExactlyInAnyOrder("ROLE_HR", "PERMISSION_EMPLOYEE_READ",
                        "PERMISSION_SHIFT_READ", "PERMISSION_SHIFT_WRITE");

        String hrToken = bearer(login("hr", "hr-password").get("access_token").asText());
        provision(hrToken, "hr-created", EmployeeRole.STAFF, "0900000019")
                .andExpect(status().isForbidden());
        reset(hrToken, "staff")
                .andExpect(status().isForbidden());
    }



    @Test

    /** Given origin trong/ngoài allowlist, When preflight, Then chỉ origin cấu hình được CORS. */
    void corsAllowsConfiguredOriginAndRejectsUnconfiguredOrigin() throws Exception {

        mockMvc.perform(options("/api/services")

                        .header(ORIGIN, "http://localhost:3000")

                        .header("Access-Control-Request-Method", "GET"))

                .andExpect(status().isOk())

                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));



        mockMvc.perform(options("/api/services")

                        .header(ORIGIN, "https://evil.example")

                        .header("Access-Control-Request-Method", "GET"))

                .andExpect(status().isForbidden());

    }



    /** Gọi login endpoint và parse token response dùng lại cho lifecycle tests. */
    private JsonNode login(String employeeId, String password) throws Exception {

        return objectMapper.readTree(mockMvc.perform(post("/api/auth/login")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.LoginRequest(employeeId, password))))

                .andExpect(status().isOk())

                .andReturn().getResponse().getContentAsString());

    }

    private org.springframework.test.web.servlet.ResultActions provision(String token, String employeeId,
                                                                          EmployeeRole role, String phone)
            throws Exception {
        return mockMvc.perform(post("/api/auth/employees")
                .header(AUTHORIZATION, token)
                .contentType(APPLICATION_JSON)
                .content("{\"employee_id\":\"" + employeeId + "\",\"full_name\":\"Test\","
                        + "\"password\":\"valid-password\",\"role\":\"" + role.name()
                        + "\",\"phone\":\"" + phone + "\"}"));
    }

    /** Gửi password reset với bearer token để assertion role/ownership không lặp request boilerplate. */
    private org.springframework.test.web.servlet.ResultActions reset(String token, String employeeId)
            throws Exception {
        return mockMvc.perform(post("/api/auth/employees/{employeeId}/password", employeeId)
                .header(AUTHORIZATION, token)
                .contentType(APPLICATION_JSON)
                .content("{\"password\":\"reset-password\"}"));
    }



    /** Gọi refresh endpoint với raw token; repository lưu hash chứ không lưu plaintext. */
    private JsonNode refresh(String refreshToken) throws Exception {

        return objectMapper.readTree(mockMvc.perform(post("/api/auth/refresh")

                        .contentType(APPLICATION_JSON)

                        .content(json(new AuthDtos.RefreshRequest(refreshToken))))

                .andExpect(status().isOk())

                .andReturn().getResponse().getContentAsString());

    }



    /** Serialize DTO auth thành JSON đúng request contract. */
    private String json(Object value) throws Exception {

        return objectMapper.writeValueAsString(value);

    }



    /** Tạo employee fixture với password hash và phone unique cho role matrix. */
    private Employee employee(String id, String password, EmployeeRole role, String phone) {
        Employee employee = new Employee();
        employee.setEmployeeId(id);
        employee.setFullName(id);
        employee.setPassword(password.startsWith("plaintext-") ? password : passwordEncoder.encode(password));
        employee.setRole(role);
        employee.setPhone(phone);
        return employee;
    }



    /** Thêm scheme Bearer vào access token raw. */
    private String bearer(String token) {

        return "Bearer " + token;

    }



    /** Tạo header Basic để chứng minh cơ chế cũ không còn được chấp nhận. */
    private String basic(String username, String password) {

        String credentials = username + ":" + password;

        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));

    }

}
