package com.hospitality.mis.controller.auth;

import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.service.auth.CustomerAccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import com.hospitality.mis.middleware.security.SecurityActor;

/**
 * Cung cấp API đăng ký và truy vấn hồ sơ tài khoản khách hàng hiện đang đăng nhập.
 */
@RestController
@RequestMapping("/api/auth/customers")
public class CustomerAccountController {
    /** Dịch vụ tạo tài khoản và đọc thông tin khách hàng từ principal hiện tại. */
    private final CustomerAccountService service;
    public CustomerAccountController(CustomerAccountService service) { this.service = service; }
    /**
     * Đăng ký tài khoản khách hàng qua POST /api/auth/customers/register.
     * Body đăng ký được {@code @Valid} kiểm tra; trả 201 cùng thông tin tài khoản mới. Endpoint công khai,
     * còn dữ liệu trùng hoặc không hợp lệ được dịch vụ báo lỗi; không có idempotency key nên không cam kết tạo một lần khi gửi lặp.
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerAccountDtos.Response register(@Valid @RequestBody CustomerAccountDtos.RegisterRequest request) {
        return service.register(request);
    }

    /**
     * Lấy hồ sơ khách hàng hiện tại qua GET /api/auth/customers/me, không có path/query/header/body tham số.
     * {@code hasRole('CUSTOMER')} và kiểm tra principal trong thân phương thức giới hạn phạm vi đúng tài khoản khách hàng;
     * trả thông tin hồ sơ, còn principal sai loại bị từ chối truy cập.
     */
    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public CustomerAccountDtos.MeResponse me() {
        SecurityActor.Principal actor = SecurityActor.currentPrincipal();
        if (!actor.isCustomer()) throw new org.springframework.security.access.AccessDeniedException("Customer principal required");
        return service.me(Long.valueOf(actor.id()));
    }

    /**
     * Cập nhật thông tin hồ sơ khách hàng hiện tại qua PUT /api/auth/customers/me.
     * Lưu trực tiếp vào cơ sở dữ liệu thật và trả về hồ sơ mới nhất.
     */
    @PutMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public CustomerAccountDtos.MeResponse updateProfile(@Valid @RequestBody CustomerAccountDtos.UpdateProfileRequest request) {
        SecurityActor.Principal actor = SecurityActor.currentPrincipal();
        if (!actor.isCustomer()) throw new org.springframework.security.access.AccessDeniedException("Customer principal required");
        return service.updateProfile(Long.valueOf(actor.id()), request);
    }
}
