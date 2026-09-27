/* File này gom các lỗi nghiệp vụ và lỗi validate về một định dạng API thống nhất. */
package com.hospitality.mis.common.exception;



import com.hospitality.mis.common.api.ApiError;
import com.hospitality.mis.service.auth.EmailDeliveryException;

import org.springframework.http.HttpStatus;

import org.springframework.http.ResponseEntity;

import org.springframework.dao.DataIntegrityViolationException;

import jakarta.validation.ConstraintViolationException;

import org.springframework.security.access.AccessDeniedException;

import org.springframework.validation.BindException;

import org.springframework.web.bind.MethodArgumentNotValidException;

import org.springframework.web.bind.annotation.ExceptionHandler;

import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import org.springframework.web.bind.ServletRequestBindingException;

import org.springframework.http.converter.HttpMessageNotReadableException;



import java.time.Instant;

import java.util.List;



@RestControllerAdvice

/** Chuyển các ngoại lệ dùng chung thành payload lỗi nhất quán cho mọi endpoint. */
public class GlobalExceptionHandler {

    @ExceptionHandler(EmailDeliveryException.class)
    /** Báo SMTP không khả dụng để client không nhầm OTP đã được gửi thành công. */
    public ResponseEntity<ApiError> handleEmailDelivery(EmailDeliveryException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                new ApiError(Instant.now(), 503, "EMAIL_DELIVERY_FAILED", exception.getMessage(), List.of()));
    }



    @ExceptionHandler(DomainException.class)

    /** Trả lỗi miền với HTTP 422 và giữ nguyên mã nghiệp vụ. */
    public ResponseEntity<ApiError> handleDomain(DomainException exception) {

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(

                new ApiError(Instant.now(), 422, exception.getCode(), exception.getMessage(), List.of()));

    }



    @ExceptionHandler(MethodArgumentNotValidException.class)

    /** Gom lỗi validate theo tên trường để client có thể hiển thị đúng vị trí. */
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {

        var details = exception.getBindingResult().getFieldErrors().stream()

                .map(error -> error.getField() + ": " + error.getDefaultMessage()).toList();

        return ResponseEntity.badRequest().body(new ApiError(Instant.now(), 400, "VALIDATION_ERROR",

                "Dữ liệu yêu cầu không hợp lệ", details));

    }



    @ExceptionHandler({HttpMessageNotReadableException.class, BindException.class,
            ConstraintViolationException.class, ServletRequestBindingException.class,
            MethodArgumentTypeMismatchException.class})

    /** Chuẩn hóa body hỏng, binding thiếu/sai và tham số không hợp lệ về cùng ApiError. */
    public ResponseEntity<ApiError> handleInvalidRequest(Exception exception) {

        return ResponseEntity.badRequest().body(new ApiError(Instant.now(), 400, "INVALID_REQUEST",

                "Dữ liệu yêu cầu không hợp lệ", List.of()));

    }



    @ExceptionHandler(AccessDeniedException.class)

    /** Giữ lỗi từ phạm vi controller trong cùng contract 403 với filter bảo mật. */
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception) {

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError(Instant.now(), 403,

                "ACCESS_DENIED", "Bạn không có quyền thực hiện thao tác này", List.of()));

    }



    @ExceptionHandler(DataIntegrityViolationException.class)

    /** Che chi tiết phụ thuộc cơ sở dữ liệu và báo xung đột tài nguyên bằng HTTP 409. */
    public ResponseEntity<ApiError> handleConstraint(DataIntegrityViolationException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(Instant.now(), 409,

                "DATA_CONFLICT", "Dữ liệu đã tồn tại hoặc vừa được thay đổi bởi thao tác khác", List.of()));

    }

}
