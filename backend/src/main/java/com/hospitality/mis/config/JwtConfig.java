package com.hospitality.mis.config;



import com.hospitality.mis.middleware.security.EmployeeJwtAuthenticationConverter;

import com.nimbusds.jose.jwk.JWK;

import com.nimbusds.jose.jwk.JWKSet;

import com.nimbusds.jose.jwk.OctetSequenceKey;

import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

import com.nimbusds.jose.jwk.source.JWKSource;

import com.nimbusds.jose.proc.SecurityContext;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.context.annotation.Bean;

import org.springframework.context.annotation.Configuration;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;

import org.springframework.security.oauth2.jwt.JwtDecoder;

import org.springframework.security.oauth2.jwt.JwtEncoder;

import org.springframework.security.oauth2.jwt.JwtTimestampValidator;

import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;



import javax.crypto.SecretKey;

import javax.crypto.spec.SecretKeySpec;

import java.nio.charset.StandardCharsets;

import java.time.Duration;



@Configuration
/** Cấu hình toàn bộ vòng đời JWT: khóa ký/giải mã, kiểm tra thời gian và ánh xạ quyền.
 * Các dependency bắt buộc lấy từ cấu hình môi trường; thiếu hoặc yếu thì ứng dụng dừng
 * ngay khi khởi tạo để không chạy với cơ chế xác thực không an toàn.
 */
public class JwtConfig {



    @Bean

    /** Tạo khóa HMAC từ bí mật cấu hình; giới hạn tối thiểu 256 bit là điều kiện an toàn bắt buộc. */
    SecretKey jwtSecretKey(@Value("${JWT_SECRET}") String configuredSecret) {

        if (configuredSecret == null || configuredSecret.isBlank()) {

            throw new IllegalStateException("JWT_SECRET is required");

        }

        byte[] secret = configuredSecret.getBytes(StandardCharsets.UTF_8);

        if (secret.length < 32) {

            throw new IllegalStateException("JWT_SECRET must contain at least 256 bits");

        }

        return new SecretKeySpec(secret, "HmacSHA256");

    }



    @Bean

    /** Cung cấp bộ mã hóa dùng cùng khóa với decoder để token phát hành có thể được xác minh. */
    JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {

        // JWK chỉ bọc cùng SecretKey; key ID ổn định để encoder/decoder dùng chung cấu hình ký.
        JWK jwk = new OctetSequenceKey.Builder(jwtSecretKey).keyID("hotel-mis").build();

        JWKSource<SecurityContext> jwks = new ImmutableJWKSet<>(new JWKSet(jwk));

        return new NimbusJwtEncoder(jwks);

    }



    @Bean

    /** Chỉ chấp nhận JWT ký bằng HS256 và còn trong thời gian hiệu lực. */
    JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)

                .macAlgorithm(MacAlgorithm.HS256)

                .build();

        decoder.setJwtValidator(new JwtTimestampValidator(Duration.ZERO));

        return decoder;

    }



    @Bean

    /** Gắn tên principal vào claim {@code sub} và giao việc tính authority cho converter của hệ thống. */
    JwtAuthenticationConverter jwtAuthenticationConverter(EmployeeJwtAuthenticationConverter converter) {

        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();

        // sub là tên principal chuẩn của Spring; converter riêng chịu trách nhiệm lấy authority động.
        authenticationConverter.setPrincipalClaimName("sub");

        authenticationConverter.setJwtGrantedAuthoritiesConverter(converter);

        return authenticationConverter;

    }

}
