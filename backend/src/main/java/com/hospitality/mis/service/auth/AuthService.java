package com.hospitality.mis.service.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.auth.RefreshTokenRepository;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.entity.auth.CustomerAccount;
import com.hospitality.mis.entity.auth.RefreshToken;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.middleware.security.EmployeeUserDetailsService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.identity.EmployeeService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Điều phối đăng nhập, phát hành/luân chuyển token và các thao tác mật khẩu.
 * Refresh token được khóa trong giao dịch khi cần để ngăn dùng lại token.
 */
@Service
public class AuthService {
    /** Bộ xác thực Spring dùng để kiểm tra thông tin nhân viên. */
    private final AuthenticationManager authenticationManager;
    /** Nạp quyền và trạng thái nhân viên khi cấp lại token. */
    private final UserDetailsService userDetailsService;
    /** Chủ sở hữu chính sách tài khoản và bộ đếm đăng nhập lỗi. */
    private final EmployeeService employeeService;
    /** Lưu refresh token; thao tác nhạy cảm dùng bản ghi đã khóa. */
    private final RefreshTokenRepository refreshTokens;
    /** Tạo access/refresh token và mã hóa refresh token. */
    private final JwtTokenService tokenService;
    /** Lưu và kiểm tra tài khoản khách khi khách đăng nhập. */
    private final CustomerAccountRepository customerAccounts;
    /** So khớp và băm mật khẩu khách hàng. */
    private final PasswordEncoder passwordEncoder;
    /** Ghi audit cho đăng nhập, đăng xuất và đổi mật khẩu. */
    private final AuditService audit;

    public AuthService(AuthenticationManager authenticationManager, UserDetailsService userDetailsService,
                       EmployeeService employeeService, RefreshTokenRepository refreshTokens,
                       JwtTokenService tokenService, CustomerAccountRepository customerAccounts,
                       PasswordEncoder passwordEncoder, AuditService audit) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.employeeService = employeeService;
        this.refreshTokens = refreshTokens;
        this.tokenService = tokenService;
        this.customerAccounts = customerAccounts;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    /** Xác thực nhân viên, cập nhật bộ đếm đăng nhập và cấp một họ token mới. */
    @Transactional(noRollbackFor = AuthFailureException.class)
    public AuthDtos.TokenResponse login(AuthDtos.LoginRequest request) {
        try {
            var authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.employeeId(), request.password()));
            UserDetails user = (UserDetails) authentication.getPrincipal();
            employeeService.recordLoginSuccess(user.getUsername());
            return issueAndStore(JwtTokenService.PrincipalType.EMPLOYEE, user.getUsername(), user,
                    tokenService.generateFamilyId());
        } catch (DisabledException exception) {
            throw new AuthFailureException("ACCOUNT_DISABLED");
        } catch (LockedException exception) {
            throw new AuthFailureException("ACCOUNT_LOCKED");
        } catch (AuthenticationException exception) {
            try {
                employeeService.recordLoginFailure(request.employeeId());
            } catch (RuntimeException ignored) {
                // Các lỗi xác thực phải luôn không thể phân biệt được đối với phía máy khách.
            }
            throw new AuthFailureException();
        }
    }

    /** Xác thực tài khoản khách bằng số điện thoại hoặc email và cấp token có quyền khách. */
    @Transactional(noRollbackFor = AuthFailureException.class)
    public AuthDtos.TokenResponse customerLogin(CustomerAccountDtos.LoginRequest request) {
        String identifier = request.phone() == null ? "" : request.phone().trim();
        CustomerAccount account;
        String auditIdentifier;
        if (identifier.contains("@")) {
            String email = identifier.toLowerCase(java.util.Locale.ROOT);
            account = customerAccounts.findByGuestEmail(email).orElse(null);
            auditIdentifier = email;
        } else {
            String phone;
            try {
                phone = PhoneNumberNormalizer.normalize(identifier);
            } catch (DomainException exception) {
                throw new AuthFailureException();
            }
            account = customerAccounts.findByPhone(phone).orElse(null);
            auditIdentifier = phone;
        }
        if (account == null || !EmployeeUserDetailsService.isBcryptHash(account.getPassword())
                || !passwordEncoder.matches(request.password(), account.getPassword())) {
            audit.record("SYSTEM", "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    auditIdentifier, null, null, "Invalid credentials");
            throw new AuthFailureException();
        }
        if (!account.isEnabled()) {
            audit.record("customer:" + account.getId(), "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    String.valueOf(account.getId()), null, null, "Account disabled");
            throw new AuthFailureException();
        }
        if (!account.isAccountNonLocked()) {
            audit.record("customer:" + account.getId(), "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    String.valueOf(account.getId()), null, null, "Account locked");
            throw new AuthFailureException();
        }
        UserDetails user = User.withUsername(String.valueOf(account.getId())).password(account.getPassword())
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER")).build();
        audit.record("customer:" + account.getId(), "LOGIN_SUCCEEDED", "CUSTOMER_ACCOUNT",
                String.valueOf(account.getId()), null, null, null);
        return issueAndStore(JwtTokenService.PrincipalType.CUSTOMER, String.valueOf(account.getId()), user,
                tokenService.generateFamilyId());
    }

    /** Trả snapshot hồ sơ của employee hiện tại từ principal đã được JWT xác thực. */
    @Transactional(readOnly = true)
    public AuthDtos.EmployeeProfileResponse employeeMe(SecurityActor.Principal actor) {
        if (!actor.isEmployee()) throw new org.springframework.security.access.AccessDeniedException("Employee principal required");
        Employee employee = employeeService.findRequired(actor.id());
        return new AuthDtos.EmployeeProfileResponse(employee.getEmployeeId(), employee.getFullName(),
                employee.getRole(), employee.getPermissions().stream().sorted().toList());
    }

    /** Kiểm tra refresh token, phát hành token mới và thu hồi token cũ trong giao dịch. */
    @Transactional(noRollbackFor = AuthFailureException.class)
    public AuthDtos.TokenResponse refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) throw new AuthFailureException();
        Instant now = Instant.now();
        RefreshToken current = refreshTokens.findForUpdate(JwtTokenService.hash(rawRefreshToken))
                .orElseThrow(AuthFailureException::new);
        if (current.getRevokedAt() != null) {
            revokeFamily(current.getFamilyId(), now);
            audit.record(current.auditActor(), "REFRESH_REPLAY_DETECTED", "REFRESH_TOKEN",
                    current.getFamilyId(), null, null, "Revoked refresh token replay");
            throw new AuthFailureException();
        }
        if (!now.isBefore(current.getExpiresAt())) {
            current.revoke(now, null);
            refreshTokens.save(current);
            throw new AuthFailureException();
        }

        UserDetails user;
        JwtTokenService.PrincipalType type = current.principalType();
        try {
            if (type == JwtTokenService.PrincipalType.EMPLOYEE) {
                user = userDetailsService.loadUserByUsername(current.getPrincipalId());
            } else {
                CustomerAccount account = customerAccounts.findById(current.getCustomerAccountId())
                        .orElseThrow(AuthFailureException::new);
                user = customerUser(account);
            }
        } catch (DisabledException exception) {
            revokeCurrent(current, now);
            throw new AuthFailureException("ACCOUNT_DISABLED");
        } catch (LockedException exception) {
            revokeCurrent(current, now);
            throw new AuthFailureException("ACCOUNT_LOCKED");
        } catch (AuthenticationException exception) {
            revokeCurrent(current, now);
            throw new AuthFailureException();
        }
        if (!user.isEnabled()) {
            revokeCurrent(current, now);
            throw new AuthFailureException("ACCOUNT_DISABLED");
        }
        if (!user.isAccountNonLocked()) {
            revokeCurrent(current, now);
            throw new AuthFailureException("ACCOUNT_LOCKED");
        }

        String principalId = current.getPrincipalId();
        JwtTokenService.IssuedTokens issued = tokenService.issue(type, principalId, user.getAuthorities(),
                current.getFamilyId());
        current.revoke(now, issued.refreshTokenHash());
        refreshTokens.save(current);
        saveRefreshToken(type, principalId, issued, current.getFamilyId());
        audit.record(current.auditActor(), "REFRESH_ROTATED", "REFRESH_TOKEN", current.getFamilyId(),
                null, issued.refreshTokenHash(), null);
        return issued.response();
    }

    /** Đăng xuất theo token cụ thể hoặc thu hồi toàn bộ họ token của actor. */
    @Transactional
    public void logout(SecurityActor.Principal actor, String rawRefreshToken) {
        Instant now = Instant.now();
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            if (actor.isEmployee()) refreshTokens.revokeAllForEmployee(actor.id(), now);
            else if (actor.isCustomer()) refreshTokens.revokeAllForCustomer(Long.valueOf(actor.id()), now);
            else throw new AuthFailureException();
            audit.record(actor.isCustomer() ? "customer:" + actor.id() : actor.id(), "LOGOUT", "REFRESH_TOKEN", actor.id(), null, null, null);
            return;
        }
        refreshTokens.findForUpdate(JwtTokenService.hash(rawRefreshToken)).ifPresent(token -> {
            if (actor.type().equals(token.getPrincipalType()) && actor.id().equals(token.getPrincipalId())) {
                revokeFamily(token.getFamilyId(), now);
                audit.record(actor.isCustomer() ? "customer:" + actor.id() : actor.id(), "LOGOUT", "REFRESH_TOKEN", token.getFamilyId(), null, null, null);
            }
        });
    }

    /** Tạo tài khoản nhân viên qua EmployeeService và ghi nhận sự kiện provisioning. */
    @Transactional
    public AuthDtos.EmployeeResponse provision(AuthDtos.ProvisionRequest request) {
        Employee employee = employeeService.provision(request.employeeId(), request.fullName(), request.password(),
                request.role(), request.phone(), request.address());
        audit.record(SecurityActor.currentActor(), "EMPLOYEE_PROVISIONED", "EMPLOYEE", employee.getEmployeeId(),
                null, employee.getRole().name(), null);
        return new AuthDtos.EmployeeResponse(employee.getEmployeeId(), employee.getFullName(), employee.getRole(),
                employee.getPhone(), employee.getAddress());
    }

    /** Đổi mật khẩu nhân viên và buộc mọi refresh token cũ hết hiệu lực. */
    @Transactional
    public void resetPassword(String employeeId, AuthDtos.PasswordResetRequest request,
                              SecurityActor.Principal actor) {
        if (!actor.isEmployee()) throw new AuthFailureException();
        SecurityActor.requireBoundActor(actor.id());
        Employee employee = employeeService.resetPassword(employeeId, request == null ? null : request.password());
        refreshTokens.revokeAllForEmployee(employeeId, Instant.now());
        audit.record(actor.id(), "PASSWORD_RESET", "EMPLOYEE", employee.getEmployeeId(), null, null, null);
    }

    @Transactional
    public void changeOwnPassword(SecurityActor.Principal actor, AuthDtos.ChangeOwnPasswordRequest request) {
        if (!actor.isEmployee()) throw new AuthFailureException();
        SecurityActor.requireBoundActor(actor.id());
        employeeService.changeOwnPassword(actor.id(), request == null ? null : request.password());
        refreshTokens.revokeAllForEmployee(actor.id(), Instant.now());
        audit.record(actor.id(), "PASSWORD_CHANGED", "EMPLOYEE", actor.id(), null, null, null);
    }

    /** Đổi mật khẩu của chính khách đang đăng nhập và thu hồi token cũ của khách. */
    @Transactional
    public void resetCustomerPassword(SecurityActor.Principal actor,
                                      CustomerAccountDtos.PasswordResetRequest request) {
        if (!actor.isCustomer()) throw new AuthFailureException();
        CustomerAccount account = customerAccounts.findById(Long.valueOf(actor.id()))
                .orElseThrow(AuthFailureException::new);
        if (request == null || request.password() == null || request.password().length() < 8
                || request.password().length() > 72) {
            throw new AuthFailureException("PASSWORD_INVALID");
        }
        account.setPassword(passwordEncoder.encode(request.password()));
        customerAccounts.save(account);
        refreshTokens.revokeAllForCustomer(account.getId(), Instant.now());
        audit.record("customer:" + actor.id(), "PASSWORD_RESET", "CUSTOMER_ACCOUNT", String.valueOf(account.getId()),
                null, null, null);
    }

    /** Cấp token và lưu refresh token tương ứng trước khi trả response. */
    private AuthDtos.TokenResponse issueAndStore(JwtTokenService.PrincipalType type, String principalId,
                                                 UserDetails user, String familyId) {
        JwtTokenService.IssuedTokens issued = tokenService.issue(type, principalId, user.getAuthorities(), familyId);
        saveRefreshToken(type, principalId, issued, familyId);
        return issued.response();
    }

    /** Chọn cách lưu token theo loại principal, giữ liên kết cùng familyId. */
    private void saveRefreshToken(JwtTokenService.PrincipalType type, String principalId,
                                  JwtTokenService.IssuedTokens issued, String familyId) {
        if (type == JwtTokenService.PrincipalType.CUSTOMER) {
            refreshTokens.save(RefreshToken.issueCustomer(Long.valueOf(principalId), issued.refreshTokenHash(),
                    familyId, issued.issuedAt(), issued.refreshExpiresAt()));
        } else {
            refreshTokens.save(RefreshToken.issue(principalId, issued.refreshTokenHash(), familyId,
                    issued.issuedAt(), issued.refreshExpiresAt()));
        }
    }

    /** Chuyển tài khoản khách thành UserDetails để kiểm tra quyền và trạng thái. */
    private UserDetails customerUser(CustomerAccount account) {
        return User.withUsername(String.valueOf(account.getId())).password(account.getPassword())
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
                .accountLocked(!account.isAccountNonLocked()).disabled(!account.isEnabled()).build();
    }

    /** Thu hồi và lưu một refresh token vừa bị vô hiệu hóa. */
    private void revokeCurrent(RefreshToken token, Instant now) {
        token.revoke(now, null);
        refreshTokens.save(token);
    }

    /** Thu hồi tất cả token trong một family khi phát hiện replay hoặc logout. */
    private void revokeFamily(String familyId, Instant at) {
        refreshTokens.findAllByFamilyId(familyId).forEach(token -> {
            if (token.getRevokedAt() == null) token.revoke(at, null);
        });
        refreshTokens.flush();
    }

}
