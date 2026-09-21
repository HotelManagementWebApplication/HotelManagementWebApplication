package com.hospitality.mis.config;



import org.springframework.beans.factory.annotation.Value;

import org.springframework.context.annotation.Bean;

import org.springframework.context.annotation.Configuration;

import org.springframework.web.cors.CorsConfiguration;

import org.springframework.web.cors.CorsConfigurationSource;

import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;



import java.util.Arrays;

import java.util.List;



@Configuration
/** Cấu hình CORS từ môi trường, chỉ cho phép các origin cụ thể đã được vận hành khai báo. */
public class WebConfig implements WebMvcConfigurer {

    private final String roomImagesDirectory;

    public WebConfig(@Value("${hotel.media.room-images-dir:./data/room-images}") String roomImagesDirectory) {
        this.roomImagesDirectory = roomImagesDirectory;
    }

    /** Public URL chỉ phục vụ file trong thư mục ảnh đã cấu hình; filename được server sinh. */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = java.nio.file.Path.of(roomImagesDirectory).toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler("/media/rooms/**").addResourceLocations(location);
    }



    @Bean

    /**
     * Chuyển dependency {@code CORS_ALLOWED_ORIGINS} thành policy dùng cho mọi đường dẫn.
     * Origin rỗng hoặc wildcard bị từ chối lúc khởi động để không vô tình mở rộng biên trình duyệt.
     */
    CorsConfigurationSource corsConfigurationSource(
            @Value("${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173}") String configuredOrigins) {

        // Chỉ giữ origin cụ thể sau khi trim; danh sách này là biên tin cậy cho trình duyệt.
        List<String> origins = Arrays.stream(configuredOrigins.split(","))

                .map(String::trim)

                .filter(origin -> !origin.isBlank())

                .toList();

        if (origins.isEmpty() || origins.stream().anyMatch(origin -> origin.equals("*") || origin.contains("*"))) {

            throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain explicit origins and cannot contain '*'");

        }



        // Policy này không cho credential cross-origin và chỉ công khai các header cần thiết.
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(origins);

        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "Idempotency-Key"));

        configuration.setExposedHeaders(List.of("Location"));

        configuration.setAllowCredentials(false);

        configuration.setMaxAge(3600L);



        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;

    }

}
