package com.hospitality.mis.dto.auth;



import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.identity.Permission;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;



/** Các payload xác thực nhân viên; JsonNaming chuyển tên Java sang snake_case khi trao đổi JSON. */
public final class AuthDtos {

    /** Không cho tạo instance vì lớp chỉ là namespace chứa các record DTO. */
    private AuthDtos() {

    }



    /** Thông tin đăng nhập; cả mã nhân viên và mật khẩu đều bắt buộc không được để trống. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LoginRequest(
            /** Mã nhân viên dùng để tìm tài khoản xác thực. */
            @NotBlank String employeeId,
            /** Mật khẩu dạng plain text chỉ tồn tại trong request để kiểm tra đăng nhập. */
            @NotBlank String password) {
    }

    /** Token làm mới phiên; bắt buộc để cấp cặp access token mới. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RefreshRequest(
            /** Refresh token hiện tại của phiên đăng nhập. */
            @NotBlank String refreshToken) {
    }

    /** Request đăng xuất; token có thể vắng mặt khi phía client đã mất phiên. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LogoutRequest(
            /** Refresh token cần thu hồi nếu client gửi lên. */
            String refreshToken) {
    }

    /** Kết quả cấp token, được serialize thành snake_case cho frontend. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TokenResponse(
            /** Token ngắn hạn dùng gọi API được bảo vệ. */
            String accessToken,
            /** Token dài hạn dùng xin access token mới. */
            String refreshToken,
            /** Kiểu token theo hợp đồng xác thực, thường là Bearer. */
            String tokenType,
            /** Thời gian sống của access token tính bằng giây. */
            long expiresIn,
            /** Thời gian sống của refresh token tính bằng giây. */
            long refreshExpiresIn) {
    }

    /** Payload tạo tài khoản nhân viên, với ràng buộc định dạng ở biên API. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ProvisionRequest(
            /** Mã nhân viên tối đa 10 ký tự và không được trống. */
            @NotBlank @Size(max = 10) String employeeId,
            /** Họ tên hiển thị của nhân viên. */
            @NotBlank String fullName,
            /** Mật khẩu dài 8–72 ký tự để phù hợp giới hạn bộ mã hóa. */
            @NotBlank @Size(min = 8, max = 72) String password,
            /** Vai trò quyết định quyền mặc định của tài khoản. */
            @NotNull EmployeeRole role,
            /** Số điện thoại liên hệ của nhân viên. */
            @NotBlank String phone,
            /** Địa chỉ tùy chọn dùng cho hồ sơ nhân viên. */
            String address) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AutoProvisionRequest(
            @NotBlank String fullName,
            @NotNull EmployeeRole role,
            @NotBlank String phone,
            @NotBlank String email,
            String address) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AutoProvisionResponse(String employeeId, String fullName, EmployeeRole role,
                                        String phone, String email, String temporaryPassword,
                                        boolean mustChangePassword) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ChangeOwnPasswordRequest(@NotBlank @Size(min = 8, max = 72) String password) {}

    /** Mật khẩu mới dùng trong luồng đặt lại mật khẩu. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PasswordResetRequest(
            /** Mật khẩu mới phải không trống và nằm trong giới hạn mã hóa. */
            @NotBlank @Size(min = 8, max = 72) String password) { }

    /** Biểu diễn công khai hồ sơ nhân viên, không chứa mật khẩu hay token. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record EmployeeResponse(
            /** Mã định danh nhân viên. */
            String employeeId,
            /** Họ tên dùng trên giao diện và audit. */
            String fullName,
            /** Vai trò hiện tại của nhân viên. */
            EmployeeRole role,
            /** Số điện thoại liên hệ. */
            String phone,
            /** Địa chỉ hồ sơ, có thể null. */
            String address) {
    }

    /** Hồ sơ employee hiện tại; role và permissions do backend suy ra từ actor/JWT. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record EmployeeProfileResponse(
            String employeeId,
            String fullName,
            EmployeeRole role,
            List<Permission> permissions) {
    }

}
