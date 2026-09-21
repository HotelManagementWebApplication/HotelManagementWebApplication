package com.hospitality.mis.controller.auth;
import com.hospitality.mis.dto.auth.AuthDtos;




import com.hospitality.mis.service.auth.AuthService;

import com.hospitality.mis.middleware.security.SecurityActor;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;

import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.ResponseStatus;

import org.springframework.web.bind.annotation.RestController;


/**
 * Điều phối các luồng xác thực, cấp và thu hồi thông tin đăng nhập cho nhân viên và khách hàng.
 */
@RestController

@RequestMapping("/api/auth")

public class AuthController {

    /** Dịch vụ thực hiện xác thực, phát hành token, thu hồi phiên và quản lý tài khoản nhân viên. */
    private final AuthService service;



    public AuthController(AuthService service) {

        this.service = service;

    }



    /**
     * Đăng nhập nhân viên; POST /api/auth/login nhận thông tin đăng nhập hợp lệ trong body và trả token.
     * Body được kiểm tra bằng {@code @Valid}; endpoint công khai, lỗi thông tin đăng nhập hoặc dữ liệu không hợp lệ
     * được chuyển thành lỗi xác thực tương ứng. Không nhận khóa idempotency nên mỗi yêu cầu là một lần cấp token mới.
     */
    @PostMapping("/login")

    public AuthDtos.TokenResponse login(@Valid @RequestBody AuthDtos.LoginRequest request) {

        return service.login(request);

    }

    /**
     * Đăng nhập khách hàng; POST /api/auth/customers/login nhận request đăng nhập khách hàng trong body và trả token.
     * Body dùng {@code @Valid}; không yêu cầu quyền trước khi đăng nhập, còn thông tin sai được xử lý như lỗi xác thực.
     * Endpoint không có khóa idempotency nên không cam kết lặp lại sẽ dùng cùng token.
     */
    @PostMapping("/customers/login")
    public AuthDtos.TokenResponse customerLogin(
            @Valid @RequestBody com.hospitality.mis.dto.auth.CustomerAccountDtos.LoginRequest request) {
        return service.customerLogin(request);
    }



    /**
     * Đổi refresh token lấy token mới qua POST /api/auth/refresh; refresh token nằm trong body và được kiểm tra hợp lệ.
     * Đây là endpoint công khai về mặt quyền; token hết hạn, đã thu hồi hoặc sai định dạng tạo lỗi từ dịch vụ.
     * Không có khóa idempotency, vì vậy việc gọi lại tuân theo chính sách luân chuyển refresh token của dịch vụ.
     */
    @PostMapping("/refresh")

    public AuthDtos.TokenResponse refresh(@Valid @RequestBody AuthDtos.RefreshRequest request) {

        return service.refresh(request.refreshToken());

    }



    /**
     * Đăng xuất phiên hiện tại qua POST /api/auth/logout, có thể nhận body tùy chọn chứa refresh token cần thu hồi.
     * Chỉ principal đã xác thực được phép gọi; trả 204 và không có response body. Không dùng idempotency key; lỗi token
     * hoặc trạng thái phiên do dịch vụ xác định.
     */
    @PreAuthorize("isAuthenticated()")

    @PostMapping("/logout")

    @ResponseStatus(HttpStatus.NO_CONTENT)

    public void logout(@RequestBody(required = false) AuthDtos.LogoutRequest request) {

        service.logout(SecurityActor.currentPrincipal(), request == null ? null : request.refreshToken());

    }

    /** Lấy identity/role/permission snapshot của employee hiện tại từ JWT actor và authority backend. */
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','MANAGER','HR','FRONT_DESK','ACCOUNTING','HOUSEKEEPING','TECHNICAL','KITCHEN','STAFF')")
    public AuthDtos.EmployeeProfileResponse me() {
        return service.employeeMe(SecurityActor.currentPrincipal());
    }




    /**
     * Tạo tài khoản nhân viên qua POST /api/auth/employees; body phải là request cấp tài khoản hợp lệ và response là nhân viên mới.
     * {@code @PreAuthorize} giới hạn quyền EMPLOYEE_PROVISION đồng thời kiểm tra người gọi được quản lý role yêu cầu.
     * Không có khóa idempotency; dữ liệu trùng hoặc không hợp lệ được dịch vụ trả về dưới dạng lỗi nghiệp vụ/validation.
     */
    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)

    @PreAuthorize("@departmentAccess.allows(authentication, 'EMPLOYEE_PROVISION') && @employeeService.canManageRole(authentication, #request.role())")
    public AuthDtos.EmployeeResponse provision(@Valid @RequestBody AuthDtos.ProvisionRequest request) {

        return service.provision(request);

    }




    /**
     * Đặt lại mật khẩu nhân viên qua POST /api/auth/employees/{employeeId}/password.
     * {@code employeeId} là path parameter, body là yêu cầu mật khẩu được {@code @Valid} kiểm tra; trả 204 không body.
     * Chỉ người có EMPLOYEE_PASSWORD_RESET và được phép reset đúng nhân viên theo SpEL mới gọi được; không có idempotency key.
     */
    @PostMapping("/employees/{employeeId}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)

    @PreAuthorize("@departmentAccess.allows(authentication, 'EMPLOYEE_PASSWORD_RESET') && @employeeService.canResetEmployee(authentication, #employeeId)")
    public void resetPassword(@PathVariable String employeeId,
                              @Valid @RequestBody AuthDtos.PasswordResetRequest request) {
        service.resetPassword(employeeId, request, SecurityActor.currentPrincipal());

    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("isAuthenticated()")
    public void changeOwnPassword(@Valid @RequestBody AuthDtos.ChangeOwnPasswordRequest request) {
        service.changeOwnPassword(SecurityActor.currentPrincipal(), request);
    }

    /**
     * Đổi mật khẩu tài khoản khách hàng hiện tại qua POST /api/auth/customers/password.
     * Body được {@code @Valid} kiểm tra, trả 204 không body; {@code hasRole('CUSTOMER')} giới hạn đúng principal khách hàng.
     * Không có path parameter hay idempotency key; lỗi dữ liệu và trạng thái tài khoản do dịch vụ xử lý.
     */
    @PreAuthorize("hasRole('CUSTOMER')")
    @PostMapping("/customers/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetCustomerPassword(
            @Valid @RequestBody com.hospitality.mis.dto.auth.CustomerAccountDtos.PasswordResetRequest request) {
        service.resetCustomerPassword(SecurityActor.currentPrincipal(), request);
    }

}
