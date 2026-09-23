package com.hospitality.mis.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.auth.RefreshTokenRepository;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:customerauth;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
/** Bảo vệ customer auth end-to-end: claims, refresh rotation, reset và phone uniqueness. */
class CustomerAuthenticationIntegrationTest {
    /** HTTP boundary thật cho đăng ký/login/refresh/reset. */
    @Autowired MockMvc mockMvc;
    /** Mapper đọc token response và kiểm tra claim JWT. */
    @Autowired ObjectMapper objectMapper;
    /** Encoder thật để xác minh mật khẩu không plaintext. */
    @Autowired PasswordEncoder passwordEncoder;
    /** Decoder thật để đọc principal_type/principal_id canonical. */
    @Autowired JwtDecoder jwtDecoder;
    /** Employee repository dùng seed phone collision. */
    @Autowired EmployeeRepository employees;
    /** Customer account repository dùng kiểm tra account. */
    @Autowired CustomerAccountRepository accounts;
    /** Refresh token repository dùng kiểm tra family/revoke. */
    @Autowired RefreshTokenRepository refreshTokens;
    /** SQL audit assertion cho password reset. */
    @Autowired JdbcTemplate jdbc;
    /** Dịch vụ OTP dùng để kiểm tra và xác nhận mã xác thực. */
    @Autowired com.hospitality.mis.service.auth.OtpService otpService;

    /** Dọn token/account/guest/audit và seed employee trước mỗi scenario. */
    @BeforeEach
    void setUp() {
        refreshTokens.deleteAll();
        accounts.deleteAll();
        employees.deleteAll();
        jdbc.update("delete from guests");
        jdbc.update("delete from audit_logs");
        Employee employee = new Employee();
        employee.setEmployeeId("employee");
        employee.setFullName("Employee");
        employee.setPassword(passwordEncoder.encode("employee-password"));
        employee.setRole(EmployeeRole.FRONT_DESK);
        employee.setPhone("0900000091");
        employees.saveAndFlush(employee);
    }

    @Test
    /** Given registration hợp lệ, When login, Then JWT định danh CUSTOMER bằng claim và subject đúng account. */
    void customerRegistrationAndLoginUseCustomerPrincipalClaims() throws Exception {
        JsonNode registration = objectMapper.readTree(mockMvc.perform(post("/api/auth/customers/register")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterRequest(
                                "0900000092", "customer-password", "Customer", "ID09000092"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String accountId = registration.get("id").asText();

        JsonNode tokens = customerLogin();
        var jwt = jwtDecoder.decode(tokens.get("access_token").asText());
        assertThat(jwt.getClaimAsString("principal_type")).isEqualTo("CUSTOMER");
        assertThat(jwt.getClaimAsString("principal_id")).isEqualTo(accountId);
        assertThat(jwt.getSubject()).isEqualTo(accountId);
        mockMvc.perform(get("/api/auth/customers/me")
                        .header(AUTHORIZATION, bearer(tokens.get("access_token").asText())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.id").value(Integer.valueOf(accountId)))
                .andExpect(jsonPath("$.guest.phone").value("0900000092"));
    }

    @Test
    /** Employee profile is actor-bound and exposes current backend role/permissions. */
    void employeeProfileUsesJwtActorAndBackendAuthorities() throws Exception {
        JsonNode tokens = objectMapper.readTree(mockMvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LoginRequest("employee", "employee-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/auth/me")
                        .header(AUTHORIZATION, bearer(tokens.get("access_token").asText())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employee_id").value("employee"))
                .andExpect(jsonPath("$.full_name").value("Employee"))
                .andExpect(jsonPath("$.role").value("FRONT_DESK"))
                .andExpect(jsonPath("$.permissions").isArray())
                .andExpect(jsonPath("$.permissions").value(org.hamcrest.Matchers.hasItem("ROOM_READ")));
    }

    @Test
    /** The employee profile rejects anonymous access and customer principals. */
    void employeeProfileRejectsAnonymousAndCustomerPrincipal() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

        registerCustomer();
        JsonNode customer = customerLogin();
        mockMvc.perform(get("/api/auth/me")
                        .header(AUTHORIZATION, bearer(customer.get("access_token").asText())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    /** Given employee/customer cùng hệ thống, When login/refresh, Then principal type và token rows không lẫn. */
    void employeeAndCustomerTokensAndRefreshRowsRemainDistinct() throws Exception {
        registerCustomer();
        JsonNode employee = objectMapper.readTree(mockMvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LoginRequest("employee", "employee-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode customer = customerLogin();

        assertThat(jwtDecoder.decode(employee.get("access_token").asText()).getClaimAsString("principal_type"))
                .isEqualTo("EMPLOYEE");
        assertThat(jwtDecoder.decode(customer.get("access_token").asText()).getClaimAsString("principal_type"))
                .isEqualTo("CUSTOMER");
        mockMvc.perform(get("/api/auth/customers/me")
                        .header(AUTHORIZATION, bearer(employee.get("access_token").asText())))
                .andExpect(status().isForbidden());
        assertThat(refreshTokens.findAll()).allSatisfy(token -> {
            assertThat(token.getPrincipalType()).isIn("EMPLOYEE", "CUSTOMER");
            if ("EMPLOYEE".equals(token.getPrincipalType())) assertThat(token.getEmployeeId()).isEqualTo("employee");
            else assertThat(token.getCustomerAccountId()).isNotNull();
        });
        assertThat(refresh(customer.get("refresh_token").asText())
                .get("access_token").asText()).isNotBlank();
        assertThat(jwtDecoder.decode(refresh(employee.get("refresh_token").asText()).get("access_token").asText())
                .getClaimAsString("principal_type")).isEqualTo("EMPLOYEE");
    }

    @Test
    /** Given refresh family customer, When rotate/replay/logout, Then token cũ và cả family bị revoke đúng. */
    void customerRefreshRotationReplayAndLogoutRevokeTheFamily() throws Exception {
        registerCustomer();
        JsonNode first = customerLogin();
        JsonNode rotated = refresh(first.get("refresh_token").asText());
        assertThat(rotated.get("refresh_token").asText()).isNotEqualTo(first.get("refresh_token").asText());
        mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(first.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        assertThat(refreshTokens.findAll()).allMatch(token -> token.getRevokedAt() != null);

        JsonNode fresh = customerLogin();
        mockMvc.perform(post("/api/auth/logout")
                        .header(AUTHORIZATION, bearer(fresh.get("access_token").asText()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.LogoutRequest(fresh.get("refresh_token").asText()))))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(fresh.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    /** Given customer đã login, When reset password, Then chỉ chính customer đổi được và session bị revoke. */
    void customerPasswordResetIsBoundToAuthenticatedCustomerAndRevokesSessions() throws Exception {
        registerCustomer();
        JsonNode tokens = customerLogin();
        mockMvc.perform(post("/api/auth/customers/password")
                        .header(AUTHORIZATION, bearer(tokens.get("access_token").asText()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.PasswordResetRequest("new-password"))))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(tokens.get("refresh_token").asText()))))
                .andExpect(status().isUnauthorized());
        customerLoginWithPassword("new-password");
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where action = 'PASSWORD_RESET'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    /** Given phone đã thuộc employee, When register customer, Then uniqueness được enforce tại boundary. */
    void customerRegistrationCannotReuseEmployeePhone() throws Exception {
        mockMvc.perform(post("/api/auth/customers/register")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterRequest(
                                "0900000091", "customer-password", "Customer", "ID09000093"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PHONE_ALREADY_IN_USE"));
    }

    @Test
    /** Kiểm tra luồng gửi OTP và đăng ký tài khoản khách hàng bằng mã OTP. */
    void customerRegisterWithOtpFlow() throws Exception {
        String email = "newguest@example.com";
        // 1. Gửi OTP đăng ký
        mockMvc.perform(post("/api/auth/otp/send-register")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.OtpSendRequest(email))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());

        // Sinh lại OTP có kiểm soát để test xác thực
        String otp = otpService.generateOtp(email, com.hospitality.mis.service.auth.OtpPurpose.REGISTER);

        // 2. Nhập sai OTP -> 422
        mockMvc.perform(post("/api/auth/customers/register-with-otp")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterWithOtpRequest(
                                "0900000095", "customer-password", "OTP Customer", "ID09000095", email, "000000"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("OTP_INCORRECT"));

        // 3. Đăng ký đúng OTP -> 201
        mockMvc.perform(post("/api/auth/customers/register-with-otp")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterWithOtpRequest(
                                "0900000095", "customer-password", "OTP Customer", "ID09000095", email, otp))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.phone").value("0900000095"));

        // 4. Đăng nhập với tài khoản vừa tạo thành công
        mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.LoginRequest("0900000095", "customer-password"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty());
    }

    @Test
    /** Kiểm tra luồng gửi OTP và đặt lại mật khẩu khi quên mật khẩu. */
    void customerResetPasswordWithOtpFlow() throws Exception {
        String email = "resetguest@example.com";
        String otp = otpService.generateOtp(email, com.hospitality.mis.service.auth.OtpPurpose.REGISTER);

        // Đăng ký tài khoản trước
        mockMvc.perform(post("/api/auth/customers/register-with-otp")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterWithOtpRequest(
                                "0900000096", "old-password", "Reset Customer", "ID09000096", email, otp))))
                .andExpect(status().isCreated());

        // 1. Gửi OTP quên mật khẩu
        mockMvc.perform(post("/api/auth/otp/send-forgot-password")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.OtpSendRequest(email))))
                .andExpect(status().isOk());

        // Lấy mã OTP đặt lại mật khẩu
        String resetOtp = otpService.generateOtp(email, com.hospitality.mis.service.auth.OtpPurpose.FORGOT_PASSWORD);

        // 2. Đặt lại mật khẩu với OTP hợp lệ
        mockMvc.perform(post("/api/auth/customers/reset-password-otp")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.ResetPasswordOtpRequest(
                                email, resetOtp, "new-secret-pwd"))))
                .andExpect(status().isOk());

        // 3. Đăng nhập bằng mật khẩu mới thành công
        mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.LoginRequest("0900000096", "new-secret-pwd"))))
                .andExpect(status().isOk());
    }

    /** Đăng ký customer fixture chuẩn dùng lại trong login/reset tests. */
    private void registerCustomer() throws Exception {
        mockMvc.perform(post("/api/auth/customers/register").contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterRequest(
                                "0900000092", "customer-password", "Customer", "ID09000092"))))
                .andExpect(status().isCreated());
    }

    /** Login customer bằng password fixture hiện hành. */
    private JsonNode customerLogin() throws Exception {
        return customerLoginWithPassword("customer-password");
    }

    /** Login customer với password chỉ định để kiểm tra reset. */
    private JsonNode customerLoginWithPassword(String password) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.LoginRequest("0900000092", password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** Gửi refresh token qua HTTP để kiểm tra rotation/replay semantics. */
    private JsonNode refresh(String refreshToken) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/refresh").contentType(APPLICATION_JSON)
                        .content(json(new AuthDtos.RefreshRequest(refreshToken))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private String json(Object value) throws Exception { return objectMapper.writeValueAsString(value); }
    private String bearer(String value) { return "Bearer " + value; }
}
