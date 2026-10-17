package com.hospitality.mis.service.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.auth.CustomerAccountDatabase;
import com.hospitality.mis.dao.guest.GuestDatabase;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Customer account commands and immutable profile projections. */
@Service
public class CustomerAccountService {
    private final CustomerAccountDatabase accounts;
    private final GuestDatabase guests;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final OtpService otpService;
    public CustomerAccountService(CustomerAccountDatabase accounts,GuestDatabase guests,PasswordEncoder passwordEncoder,AuditService audit,OtpService otpService){
        this.accounts=accounts;this.guests=guests;this.passwordEncoder=passwordEncoder;this.audit=audit;this.otpService=otpService;
    }
    @Transactional
    public CustomerAccountDtos.Response register(CustomerAccountDtos.RegisterRequest request){
        if(request==null)throw new DomainException("INVALID_CUSTOMER_REQUEST","Thiếu nội dung đăng ký");
        String phone=PhoneNumberNormalizer.normalize(request.phone()),identity=request.identityNumber().trim();
        var scope=accounts.registrationScope(phone,null);
        if(scope.phoneUsed())throw new DomainException("PHONE_ALREADY_IN_USE","Số điện thoại đã được sử dụng");
        password(request.password());
        var result=accounts.register(phone,request.fullName().trim(),identity,null,passwordEncoder.encode(request.password()));
        audit.record("SYSTEM","CUSTOMER_REGISTERED","CUSTOMER_ACCOUNT",result.id().toString(),null,null,null);return result.response();
    }
    @Transactional
    public CustomerAccountDtos.Response registerWithOtp(CustomerAccountDtos.RegisterWithOtpRequest request){
        if(request==null)throw new DomainException("INVALID_CUSTOMER_REQUEST","Thiếu nội dung đăng ký");
        String email=request.email().trim().toLowerCase();otpService.verifyOtp(email,request.otp(),OtpPurpose.REGISTER);
        String phone=PhoneNumberNormalizer.normalize(request.phone()),identity=request.identityNumber().trim();
        var scope=accounts.registrationScope(phone,email);
        if(scope.phoneUsed())throw new DomainException("PHONE_ALREADY_IN_USE","Số điện thoại đã được sử dụng");
        if(scope.emailUsed())throw new DomainException("EMAIL_ALREADY_IN_USE","Địa chỉ email đã được liên kết với tài khoản khác");
        password(request.password());
        var result=accounts.register(phone,request.fullName().trim(),identity,email,passwordEncoder.encode(request.password()));
        audit.record("SYSTEM","CUSTOMER_REGISTERED_WITH_OTP","CUSTOMER_ACCOUNT",result.id().toString(),null,null,null);return result.response();
    }
    @Transactional
    public void resetPasswordOtp(CustomerAccountDtos.ResetPasswordOtpRequest request){
        if(request==null)throw new DomainException("INVALID_REQUEST","Thiếu thông tin đặt lại mật khẩu");
        String email=request.email().trim().toLowerCase();otpService.verifyOtp(email,request.otp(),OtpPurpose.FORGOT_PASSWORD);password(request.newPassword());
        var account=accounts.email(email).orElseThrow(()->new DomainException("CUSTOMER_ACCOUNT_NOT_FOUND","Không tìm thấy tài khoản liên kết với email này"));
        accounts.password(account.id(),passwordEncoder.encode(request.newPassword()));
        audit.record("SYSTEM","CUSTOMER_PASSWORD_RESET_OTP","CUSTOMER_ACCOUNT",account.id().toString(),null,null,null);
    }
    @Transactional(readOnly=true)
    public CustomerAccountDtos.MeResponse me(Long id){var account=required(id);return new CustomerAccountDtos.MeResponse(account.response(),guests.find(account.guestId()).orElseThrow().response());}
    @Transactional
    public CustomerAccountDtos.MeResponse updateProfile(Long id,CustomerAccountDtos.UpdateProfileRequest request){
        var account=required(id);var guest=guests.find(account.guestId()).orElseThrow();
        var result=guests.profile(account.guestId(),request.fullName().trim(),request.identityNumber().trim(),request.email()==null?null:request.email().trim(),request.address()==null?null:request.address().trim(),request.birthYear(),guest.version());
        return new CustomerAccountDtos.MeResponse(account.response(),result);
    }
    private CustomerAccountDatabase.Snapshot required(Long id){return accounts.find(id).orElseThrow(()->new DomainException("CUSTOMER_ACCOUNT_NOT_FOUND","Không tìm thấy tài khoản khách hàng"));}
    private void password(String value){if(value==null||value.length()<8||value.length()>72)throw new DomainException("PASSWORD_INVALID","Mật khẩu phải có từ 8 đến 72 ký tự");}
}
