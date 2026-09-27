package com.hospitality.mis.config;



import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.api.ApiError;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;

import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;

import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.oauth2.jwt.JwtDecoder;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

import org.springframework.security.web.AuthenticationEntryPoint;

import org.springframework.security.web.SecurityFilterChain;

import org.springframework.security.web.access.AccessDeniedHandler;

import java.time.Instant;
import java.util.List;



import static org.springframework.security.config.Customizer.withDefaults;



@Configuration

@EnableMethodSecurity
/** Thiết lập biên bảo vệ HTTP, với mặc định mọi endpoint chưa nêu rõ đều cần xác thực. */
public class SecurityConfig {



    @Bean

    /**
     * Lắp chuỗi filter stateless, JWT resource server và các dependency xử lý lỗi/audit.
     * CORS, endpoint công khai và phương thức HTTP giữ nguyên hợp đồng hiện tại; mọi request
     * khác phải qua authentication, còn quyết định quyền chi tiết tiếp tục do method security.
     */
    SecurityFilterChain securityFilterChain(HttpSecurity http,

                                            JwtDecoder jwtDecoder,

                                            JwtAuthenticationConverter jwtAuthenticationConverter,

                                            AuthenticationEntryPoint authenticationEntryPoint,

                                            AccessDeniedHandler accessDeniedHandler,
                                            com.hospitality.mis.service.governance.SecurityAuditService securityAudit) throws Exception {

        http
                .addFilterBefore(new com.hospitality.mis.middleware.security.SecurityAuditFilter(securityAudit),
                        org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class)

                .csrf(AbstractHttpConfigurer::disable)

                .cors(withDefaults())

                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .httpBasic(AbstractHttpConfigurer::disable)

                .formLogin(AbstractHttpConfigurer::disable)

                .logout(AbstractHttpConfigurer::disable)

                .exceptionHandling(exception -> exception

                        .authenticationEntryPoint(authenticationEntryPoint)

                        .accessDeniedHandler(accessDeniedHandler))

                .authorizeHttpRequests(authorize -> authorize

                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers(

                                "/actuator/health",

                                "/actuator/health/**",

                                "/v3/api-docs",

                                "/v3/api-docs/**",

                                "/swagger-ui.html",

                                "/swagger-ui/**",

                                "/webjars/**",

                                "/api/auth/login",

                                "/api/auth/customers/login",

                                "/api/auth/refresh",

                                "/api/auth/customers/register",

                                "/api/auth/customers/register-with-otp",

                                "/api/auth/customers/reset-password-otp",

                                "/api/auth/otp/**",

                                "/api/public/**"

                        ).permitAll()

                        .anyRequest().authenticated())

                .oauth2ResourceServer(resourceServer -> resourceServer

                        .authenticationEntryPoint(authenticationEntryPoint)

                        .jwt(jwt -> jwt

                                .decoder(jwtDecoder)

                                .jwtAuthenticationConverter(jwtAuthenticationConverter)));

        return http.build();

    }



    @Bean

    /** Trả lỗi 401 thống nhất khi request chưa có hoặc có credential không hợp lệ. */
    AuthenticationEntryPoint authenticationEntryPoint(ObjectMapper objectMapper) {

        return (request, response, exception) -> writeError(response, HttpServletResponse.SC_UNAUTHORIZED,
                "AUTHENTICATION_REQUIRED", "Bạn cần đăng nhập để thực hiện thao tác này", objectMapper);

    }



    @Bean

    /** Trả lỗi 403 khi principal hợp lệ nhưng không có quyền vào tài nguyên. */
    AccessDeniedHandler accessDeniedHandler(ObjectMapper objectMapper) {
        return (request, response, exception) -> writeError(response, HttpServletResponse.SC_FORBIDDEN,
                "ACCESS_DENIED", "Bạn không có quyền thực hiện thao tác này", objectMapper);
    }

    /** Ghi đúng schema ApiError cho lỗi phát sinh trước khi request vào controller. */
    private static void writeError(HttpServletResponse response, int status, String code, String message,
                                   ObjectMapper objectMapper)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(),
                new ApiError(Instant.now(), status, code, message, List.of()));
    }
}
