package com.hospitality.mis.service.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.dto.guest.GuestDtos;
import com.hospitality.mis.entity.auth.CustomerAccount;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Quản lý đăng ký tài khoản khách và ảnh chiếu hồ sơ khách hàng. */
@Service
public class CustomerAccountService {
    /** Kho tài khoản, dùng để kiểm tra số điện thoại và lưu credential đã băm. */
    private final CustomerAccountRepository accounts;
    /** Kho hồ sơ khách được liên kết với tài khoản. */
    private final GuestStore guests;
    /** Kho nhân viên, ngăn số điện thoại dùng chung giữa hai loại tài khoản. */
    private final EmployeeRepository employees;
    /** Băm mật khẩu trước khi persistence. */
    private final PasswordEncoder passwordEncoder;
    /** Ghi audit cho việc đăng ký tài khoản. */
    private final AuditService audit;
    /** Dịch vụ xác thực mã OTP. */
    private final OtpService otpService;

    public CustomerAccountService(CustomerAccountRepository accounts, GuestStore guests,
                                  EmployeeRepository employees, PasswordEncoder passwordEncoder,
                                  AuditService audit, OtpService otpService) {
        this.accounts = accounts;
        this.guests = guests;
        this.employees = employees;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.otpService = otpService;
    }

    /** Đăng ký tài khoản, liên kết khách hiện có hoặc tạo khách mới theo giấy tờ. */
    @Transactional
    public CustomerAccountDtos.Response register(CustomerAccountDtos.RegisterRequest request) {
        if (request == null) throw new DomainException("INVALID_CUSTOMER_REQUEST", "Thiếu nội dung đăng ký");
        String phone = PhoneNumberNormalizer.normalize(request.phone());
        String identityNumber = request.identityNumber().trim();
        if (accounts.existsByPhone(phone) || employees.existsByPhone(phone)) {
            throw new DomainException("PHONE_ALREADY_IN_USE", "Số điện thoại đã được sử dụng");
        }
        if (request.password() == null || request.password().length() < 8 || request.password().length() > 72) {
            throw new DomainException("PASSWORD_INVALID", "Mật khẩu phải có từ 8 đến 72 ký tự");
        }
        Guest savedGuest = guests.findByPhone(phone).map(existing -> {
            if (!identityNumber.equals(existing.getIdentityNumber())) {
                throw new DomainException("GUEST_IDENTITY_MISMATCH", "Thông tin giấy tờ không khớp hồ sơ khách hàng");
            }
            return existing;
        }).orElseGet(() -> {
            if (guests.findByIdentityNumber(identityNumber).isPresent()) {
                throw new DomainException("GUEST_IDENTITY_EXISTS", "Số giấy tờ khách hàng đã tồn tại");
            }
            Guest guest = guests.newGuest();
            guest.setFullName(request.fullName().trim());
            guest.setIdentityNumber(identityNumber);
            guest.setPhone(phone);
            return guests.save(guest);
        });
        CustomerAccount account = new CustomerAccount();
        account.setGuest(savedGuest);
        account.setPhone(phone);
        account.setPassword(passwordEncoder.encode(request.password()));
        CustomerAccount saved = accounts.save(account);
        audit.record("SYSTEM", "CUSTOMER_REGISTERED", "CUSTOMER_ACCOUNT", String.valueOf(saved.getId()),
                null, null, null);
        return toResponse(saved);
    }

    /** Đăng ký tài khoản khách hàng kèm xác thực mã OTP gửi về email. */
    @Transactional
    public CustomerAccountDtos.Response registerWithOtp(CustomerAccountDtos.RegisterWithOtpRequest request) {
        if (request == null) throw new DomainException("INVALID_CUSTOMER_REQUEST", "Thiếu nội dung đăng ký");
        String email = request.email().trim().toLowerCase();
        // Xác minh mã OTP trước khi kiểm tra logic khác
        otpService.verifyOtp(email, request.otp(), OtpPurpose.REGISTER);

        String phone = PhoneNumberNormalizer.normalize(request.phone());
        String identityNumber = request.identityNumber().trim();
        if (accounts.existsByPhone(phone) || employees.existsByPhone(phone)) {
            throw new DomainException("PHONE_ALREADY_IN_USE", "Số điện thoại đã được sử dụng");
        }
        if (accounts.existsByGuestEmail(email)) {
            throw new DomainException("EMAIL_ALREADY_IN_USE", "Địa chỉ email đã được liên kết với tài khoản khác");
        }
        if (request.password() == null || request.password().length() < 8 || request.password().length() > 72) {
            throw new DomainException("PASSWORD_INVALID", "Mật khẩu phải có từ 8 đến 72 ký tự");
        }
        Guest savedGuest = guests.findByPhone(phone).map(existing -> {
            if (!identityNumber.equals(existing.getIdentityNumber())) {
                throw new DomainException("GUEST_IDENTITY_MISMATCH", "Thông tin giấy tờ không khớp hồ sơ khách hàng");
            }
            existing.setEmail(email);
            return guests.save(existing);
        }).orElseGet(() -> {
            if (guests.findByIdentityNumber(identityNumber).isPresent()) {
                throw new DomainException("GUEST_IDENTITY_EXISTS", "Số giấy tờ khách hàng đã tồn tại");
            }
            Guest guest = guests.newGuest();
            guest.setFullName(request.fullName().trim());
            guest.setIdentityNumber(identityNumber);
            guest.setPhone(phone);
            guest.setEmail(email);
            return guests.save(guest);
        });
        CustomerAccount account = new CustomerAccount();
        account.setGuest(savedGuest);
        account.setPhone(phone);
        account.setPassword(passwordEncoder.encode(request.password()));
        CustomerAccount saved = accounts.save(account);
        audit.record("SYSTEM", "CUSTOMER_REGISTERED_WITH_OTP", "CUSTOMER_ACCOUNT", String.valueOf(saved.getId()),
                null, null, null);
        return toResponse(saved);
    }

    /** Đặt lại mật khẩu tài khoản khách hàng thông qua mã OTP gửi về email. */
    @Transactional
    public void resetPasswordOtp(CustomerAccountDtos.ResetPasswordOtpRequest request) {
        if (request == null) throw new DomainException("INVALID_REQUEST", "Thiếu thông tin đặt lại mật khẩu");
        String email = request.email().trim().toLowerCase();
        otpService.verifyOtp(email, request.otp(), OtpPurpose.FORGOT_PASSWORD);

        if (request.newPassword() == null || request.newPassword().length() < 8 || request.newPassword().length() > 72) {
            throw new DomainException("PASSWORD_INVALID", "Mật khẩu mới phải có từ 8 đến 72 ký tự");
        }

        CustomerAccount account = accounts.findByGuestEmail(email)
                .orElseThrow(() -> new DomainException("CUSTOMER_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản liên kết với email này"));

        account.setPassword(passwordEncoder.encode(request.newPassword()));
        accounts.save(account);
        audit.record("SYSTEM", "CUSTOMER_PASSWORD_RESET_OTP", "CUSTOMER_ACCOUNT", String.valueOf(account.getId()),
                null, null, null);
    }

    /** Đọc tài khoản và khách liên quan để tạo hồ sơ hiện tại. */
    @Transactional(readOnly = true)
    public CustomerAccountDtos.MeResponse me(Long customerAccountId) {
        CustomerAccount account = accounts.findById(customerAccountId)
                .orElseThrow(() -> new DomainException("CUSTOMER_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản khách hàng"));
        Guest guest = account.getGuest();
        GuestDtos.Response guestResponse = new GuestDtos.Response(guest.getId(), guest.getFullName(), guest.getBirthYear(),
                guest.getIdentityNumber(), guest.getPhone(), guest.getEmail(), guest.getAddress(), guest.getMembershipTier(),
                guest.getTotalSpend(), guest.getLateCancellationCount(), guest.getLateCheckoutCount(), guest.isBookingBlocked());
        return new CustomerAccountDtos.MeResponse(toResponse(account), guestResponse);
    }

    /** Chuyển entity tài khoản sang DTO mà không làm lộ mật khẩu. */
    public CustomerAccountDtos.Response toResponse(CustomerAccount account) {
        return new CustomerAccountDtos.Response(account.getId(), account.getGuest().getId(), account.getPhone(),
                account.isEnabled(), account.isAccountNonLocked());
    }

    /** Cập nhật thông tin hồ sơ khách lưu trú trong cơ sở dữ liệu thật. */
    @Transactional
    public CustomerAccountDtos.MeResponse updateProfile(Long customerAccountId, CustomerAccountDtos.UpdateProfileRequest request) {
        CustomerAccount account = accounts.findById(customerAccountId)
                .orElseThrow(() -> new DomainException("CUSTOMER_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản khách hàng"));
        Guest guest = account.getGuest();
        guest.setFullName(request.fullName().trim());
        guest.setIdentityNumber(request.identityNumber().trim());
        if (request.email() != null) guest.setEmail(request.email().trim());
        if (request.address() != null) guest.setAddress(request.address().trim());
        if (request.birthYear() != null) guest.setBirthYear(request.birthYear());
        Guest savedGuest = guests.save(guest);
        GuestDtos.Response guestResponse = new GuestDtos.Response(savedGuest.getId(), savedGuest.getFullName(), savedGuest.getBirthYear(),
                savedGuest.getIdentityNumber(), savedGuest.getPhone(), savedGuest.getEmail(), savedGuest.getAddress(), savedGuest.getMembershipTier(),
                savedGuest.getTotalSpend(), savedGuest.getLateCancellationCount(), savedGuest.getLateCheckoutCount(), savedGuest.isBookingBlocked());
        return new CustomerAccountDtos.MeResponse(toResponse(account), guestResponse);
    }
}
