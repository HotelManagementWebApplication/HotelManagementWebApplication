package com.hospitality.mis.service.auth;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountDatabase;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.auth.RefreshTokenDatabase;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;

import com.hospitality.mis.dao.identity.EmployeeDatabase.Snapshot;
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
    private final RefreshTokenDatabase refreshTokens;
    /** Tạo access/refresh token và mã hóa refresh token. */
    private final JwtTokenService tokenService;
    /** Lưu và kiểm tra tài khoản khách khi khách đăng nhập. */
    private final CustomerAccountDatabase customerAccounts;
    /** So khớp và băm mật khẩu khách hàng. */
    private final PasswordEncoder passwordEncoder;
    /** Ghi audit cho đăng nhập, đăng xuất và đổi mật khẩu. */
    private final AuditService audit;

    public AuthService(AuthenticationManager authenticationManager, UserDetailsService userDetailsService,
                       EmployeeService employeeService, RefreshTokenDatabase refreshTokens,
                       JwtTokenService tokenService, CustomerAccountDatabase customerAccounts,
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
        CustomerAccountDatabase.Snapshot account;
        String auditIdentifier;
        if (identifier.contains("@")) {
            String email = identifier.toLowerCase(java.util.Locale.ROOT);
            account = customerAccounts.email(email).orElse(null);
            auditIdentifier = email;
        } else {
            String phone;
            try {
                phone = PhoneNumberNormalizer.normalize(identifier);
            } catch (DomainException exception) {
                throw new AuthFailureException();
            }
            account = customerAccounts.phone(phone).orElse(null);
            auditIdentifier = phone;
        }
        if (account == null || !EmployeeUserDetailsService.isBcryptHash(account.password())
                || !passwordEncoder.matches(request.password(), account.password())) {
            audit.record("SYSTEM", "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    auditIdentifier, null, null, "Invalid credentials");
            throw new AuthFailureException();
        }
        if (!account.enabled()) {
            audit.record("customer:" + account.id(), "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    String.valueOf(account.id()), null, null, "Account disabled");
            throw new AuthFailureException();
        }
        if (!account.accountNonLocked()) {
            audit.record("customer:" + account.id(), "LOGIN_FAILED", "CUSTOMER_ACCOUNT",
                    String.valueOf(account.id()), null, null, "Account locked");
            throw new AuthFailureException();
        }
        UserDetails user = User.withUsername(String.valueOf(account.id())).password(account.password())
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER")).build();
        audit.record("customer:" + account.id(), "LOGIN_SUCCEEDED", "CUSTOMER_ACCOUNT",
                String.valueOf(account.id()), null, null, null);
        return issueAndStore(JwtTokenService.PrincipalType.CUSTOMER, String.valueOf(account.id()), user,
                tokenService.generateFamilyId());
    }

    /** Trả snapshot hồ sơ của employee hiện tại từ principal đã được JWT xác thực. */
    @Transactional(readOnly = true)
    public AuthDtos.EmployeeProfileResponse employeeMe(SecurityActor.Principal actor) {
        if (!actor.isEmployee()) throw new org.springframework.security.access.AccessDeniedException("Employee principal required");
        Snapshot employee = employeeService.findRequired(actor.id());
        return new AuthDtos.EmployeeProfileResponse(employee.employeeId(), employee.fullName(),
                employee.role(), employee.role().permissions().stream().sorted().toList());
    }

    /** Kiểm tra refresh token, phát hành token mới và thu hồi token cũ trong giao dịch. */
    @Transactional(noRollbackFor = AuthFailureException.class)
    public AuthDtos.TokenResponse refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) throw new AuthFailureException();
        Instant now = Instant.now();
        RefreshTokenDatabase.Token current = refreshTokens.lock(JwtTokenService.hash(rawRefreshToken))
                .orElseThrow(AuthFailureException::new);
        if (current.revokedAt() != null) {
            refreshTokens.revokeFamily(current, now);
            audit.record(current.auditActor(), "REFRESH_REPLAY_DETECTED", "REFRESH_TOKEN",
                    current.familyId(), null, null, "Revoked refresh token replay");
            throw new AuthFailureException();
        }
        if (!now.isBefore(current.expiresAt())) {
            refreshTokens.revoke(current, now);
            throw new AuthFailureException();
        }

        UserDetails user;
        JwtTokenService.PrincipalType type = current.principalType();
        try {
            if (type == JwtTokenService.PrincipalType.EMPLOYEE) {
                user = userDetailsService.loadUserByUsername(current.principalId());
            } else {
                CustomerAccountDatabase.Snapshot account = customerAccounts.find(current.customerAccountId())
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

        String principalId = current.principalId();
        JwtTokenService.IssuedTokens issued = tokenService.issue(type, principalId, user.getAuthorities(),
                current.familyId());
        refreshTokens.rotate(current, issued, now);
        audit.record(current.auditActor(), "REFRESH_ROTATED", "REFRESH_TOKEN", current.familyId(),
                null, issued.refreshTokenHash(), null);
        return issued.response();
    }

    /** Đăng xuất theo token cụ thể hoặc thu hồi toàn bộ họ token của actor. */
    @Transactional
    public void logout(SecurityActor.Principal actor, String rawRefreshToken) {
        Instant now = Instant.now();
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            if (actor.isEmployee()) refreshTokens.revokeEmployee(actor.id(), now);
            else if (actor.isCustomer()) refreshTokens.revokeCustomer(Long.valueOf(actor.id()), now);
            else throw new AuthFailureException();
            audit.record(actor.isCustomer() ? "customer:" + actor.id() : actor.id(), "LOGOUT", "REFRESH_TOKEN", actor.id(), null, null, null);
            return;
        }
        refreshTokens.lock(JwtTokenService.hash(rawRefreshToken)).ifPresent(token -> {
            if (actor.type().equals(token.principalType().name()) && actor.id().equals(token.principalId())) {
                refreshTokens.revokeFamily(token, now);
                audit.record(actor.isCustomer() ? "customer:" + actor.id() : actor.id(), "LOGOUT", "REFRESH_TOKEN", token.familyId(), null, null, null);
            }
        });
    }

    /** Tạo tài khoản nhân viên qua EmployeeService và ghi nhận sự kiện provisioning. */
    @Transactional
    public AuthDtos.EmployeeResponse provision(AuthDtos.ProvisionRequest request) {
        Snapshot employee = employeeService.provision(request.employeeId(), request.fullName(), request.password(),
                request.role(), request.phone(), request.address());
        audit.record(SecurityActor.currentActor(), "EMPLOYEE_PROVISIONED", "EMPLOYEE", employee.employeeId(),
                null, employee.role().name(), null);
        return new AuthDtos.EmployeeResponse(employee.employeeId(), employee.fullName(), employee.role(),
                employee.phone(), employee.address());
    }

    /** Đổi mật khẩu nhân viên và buộc mọi refresh token cũ hết hiệu lực. */
    @Transactional
    public void resetPassword(String employeeId, AuthDtos.PasswordResetRequest request,
                              SecurityActor.Principal actor) {
        if (!actor.isEmployee()) throw new AuthFailureException();
        SecurityActor.requireBoundActor(actor.id());
        Snapshot employee = employeeService.resetPassword(employeeId, request == null ? null : request.password());
        refreshTokens.revokeEmployee(employeeId, Instant.now());
        audit.record(actor.id(), "PASSWORD_RESET", "EMPLOYEE", employee.employeeId(), null, null, null);
    }

    @Transactional
    public void changeOwnPassword(SecurityActor.Principal actor, AuthDtos.ChangeOwnPasswordRequest request) {
        if (!actor.isEmployee()) throw new AuthFailureException();
        SecurityActor.requireBoundActor(actor.id());
        employeeService.changeOwnPassword(actor.id(), request == null ? null : request.password());
        refreshTokens.revokeEmployee(actor.id(), Instant.now());
        audit.record(actor.id(), "PASSWORD_CHANGED", "EMPLOYEE", actor.id(), null, null, null);
    }

    /** Đổi mật khẩu của chính khách đang đăng nhập và thu hồi token cũ của khách. */
    @Transactional
    public void resetCustomerPassword(SecurityActor.Principal actor,
                                      CustomerAccountDtos.PasswordResetRequest request) {
        if (!actor.isCustomer()) throw new AuthFailureException();
        CustomerAccountDatabase.Snapshot account = customerAccounts.find(Long.valueOf(actor.id()))
                .orElseThrow(AuthFailureException::new);
        if (request == null || request.password() == null || request.password().length() < 8
                || request.password().length() > 72) {
            throw new AuthFailureException("PASSWORD_INVALID");
        }
        customerAccounts.password(account.id(),passwordEncoder.encode(request.password()));
        refreshTokens.revokeCustomer(account.id(), Instant.now());
        audit.record("customer:" + actor.id(), "PASSWORD_RESET", "CUSTOMER_ACCOUNT", String.valueOf(account.id()),
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
        refreshTokens.issue(type, principalId, issued, familyId);
    }

    /** Chuyển tài khoản khách thành UserDetails để kiểm tra quyền và trạng thái. */
    private UserDetails customerUser(CustomerAccountDatabase.Snapshot account) {
        return User.withUsername(String.valueOf(account.id())).password(account.password())
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
                .accountLocked(!account.accountNonLocked()).disabled(!account.enabled()).build();
    }

    /** Thu hồi và lưu một refresh token vừa bị vô hiệu hóa. */
    private void revokeCurrent(RefreshTokenDatabase.Token token, Instant now) {
        refreshTokens.revoke(token, now);
    }

}
