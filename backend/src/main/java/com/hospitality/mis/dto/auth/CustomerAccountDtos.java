package com.hospitality.mis.dto.auth;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import com.hospitality.mis.dto.guest.GuestDtos;

/** DTO cho tài khoản khách; các record được serialize theo tên trường snake_case. */
public final class CustomerAccountDtos {
    /** Namespace chỉ chứa DTO, không tạo đối tượng tiện ích. */
    private CustomerAccountDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Trạng thái tài khoản công khai, không trả mật khẩu. */
    public record Response(
            /** Khóa chính tài khoản. */
            Long id,
            /** Khóa khách liên kết với tài khoản. */
            Long guestId,
            /** Số điện thoại dùng đăng nhập. */
            String phone,
            /** Tài khoản có được phép đăng nhập hay không. */
            boolean enabled,
            /** Tài khoản có đang bị khóa bởi cơ chế bảo mật hay không. */
            boolean accountNonLocked) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Payload hồ sơ hiện tại gồm tài khoản và thông tin khách tương ứng. */
    public record MeResponse(
            /** Phần trạng thái tài khoản. */
            Response account,
            /** Hồ sơ khách được nhúng để frontend tải một lần. */
            GuestDtos.Response guest) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Request đăng nhập của khách bằng số điện thoại và mật khẩu bắt buộc. */
    public record LoginRequest(
            /** Số điện thoại định danh tài khoản. */
            @NotBlank String phone,
            /** Mật khẩu dùng xác thực. */
            @NotBlank String password) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Request đăng ký tài khoản khách và hồ sơ nhận diện tối thiểu. */
    public record RegisterRequest(
            /** Số điện thoại mới, bắt buộc để đăng nhập. */
            @NotBlank String phone,
            /** Mật khẩu ban đầu, không được trống. */
            @NotBlank String password,
            /** Họ tên khách. */
            @NotBlank String fullName,
            /** Số giấy tờ dùng nhận diện khách. */
            @NotBlank String identityNumber) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Request đặt lại mật khẩu khách. */
    public record PasswordResetRequest(
            /** Mật khẩu mới bắt buộc phải có giá trị. */
            @NotBlank String password) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Request cập nhật thông tin cá nhân khách hàng. */
    public record UpdateProfileRequest(
            /** Họ tên khách. */
            @NotBlank String fullName,
            /** Số giấy tờ nhận diện khách. */
            @NotBlank String identityNumber,
            /** Email liên hệ. */
            String email,
            /** Địa chỉ liên hệ. */
            String address,
            /** Năm sinh. */
            Integer birthYear) {}
}
