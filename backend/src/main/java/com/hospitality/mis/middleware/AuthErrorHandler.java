package com.hospitality.mis.middleware;

import com.hospitality.mis.common.api.ApiError;
import com.hospitality.mis.service.auth.AuthFailureException;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.controller.auth.AuthController;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.time.Instant;
import java.util.List;

@RestControllerAdvice(basePackageClasses = AuthController.class)
@Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
/** Chuẩn hóa lỗi của các endpoint xác thực mà không tiết lộ dữ liệu nhạy cảm của exception. */
public class AuthErrorHandler {
    @ExceptionHandler(AuthFailureException.class)
    /** Trả 401 cho thất bại đăng nhập/refresh theo mã lỗi nghiệp vụ đã định nghĩa. */
    ResponseEntity<ApiError> authenticationFailure(AuthFailureException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(error(HttpStatus.UNAUTHORIZED, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler(DomainException.class)
    /** Trả lỗi nghiệp vụ ở biên auth dưới dạng 422, giữ nguyên mã để client xử lý ổn định. */
    ResponseEntity<ApiError> domainFailure(DomainException exception) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(HttpStatus.UNPROCESSABLE_ENTITY, exception.getCode(), exception.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            ConstraintViolationException.class})
    /** Gom mọi request auth sai định dạng thành một lỗi 400 không làm lộ chi tiết binding. */
    ResponseEntity<ApiError> invalidRequest(Exception exception) {
        return ResponseEntity.badRequest().body(error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "Dữ liệu yêu cầu không hợp lệ"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    /** Trả 403 thống nhất cho principal đã xác thực nhưng bị từ chối quyền. */
    ResponseEntity<ApiError> accessDenied() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(error(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Bạn không có quyền thực hiện thao tác này"));
    }

    private static ApiError error(HttpStatus status, String code, String message) {
        return new ApiError(Instant.now(), status.value(), code, message, List.of());
    }
}
