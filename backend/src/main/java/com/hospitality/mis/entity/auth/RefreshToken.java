package com.hospitality.mis.entity.auth;

import com.hospitality.mis.service.auth.JwtTokenService;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "MaLamMoiDangNhap")
/** Phiên refresh token đã phát hành, dùng để xoay vòng và thu hồi phiên đăng nhập. */
public class RefreshToken {
    /** Khóa kỹ thuật của bản ghi token. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maMaLamMoiDangNhap")
    private Long id;

    @Column(name = "maNhanVien", length = 10)
    /** Mã nhân viên sở hữu token; loại trừ khi token thuộc tài khoản khách. */
    private String employeeId;

    @Column(name = "maTaiKhoanKhachHang")
    /** ID tài khoản khách sở hữu token; loại trừ khi token thuộc nhân viên. */
    private Long customerAccountId;

    @Column(name = "maBamToken", nullable = false, unique = true, length = 64)
    /** Băm SHA-256 của token bí mật, không lưu token gốc. */
    private String tokenHash;

    @Column(name = "maNhomPhien", nullable = false, length = 36)
    /** Nhóm token dùng để thu hồi cả chuỗi khi phát hiện reuse. */
    private String familyId;

    @Column(name = "thoiDiemPhatHanh", nullable = false)
    /** Thời điểm token bắt đầu có hiệu lực. */
    private Instant issuedAt;

    @Column(name = "thoiDiemHetHan", nullable = false)
    /** Thời điểm token hết hạn, sau đó không được làm mới phiên. */
    private Instant expiresAt;

    @Column(name = "thoiDiemThuHoi")
    /** Thời điểm token bị thu hồi; null nghĩa là chưa thu hồi. */
    private Instant revokedAt;

    @Column(name = "maBamThayThe", length = 64)
    /** Băm token kế tiếp trong lần xoay vòng; giúp truy vết chuỗi thay thế. */
    private String replacedByHash;

    protected RefreshToken() {
    }

    /** Tạo token và bảo đảm chính xác một loại chủ thể sở hữu. */
    private RefreshToken(String employeeId, Long customerAccountId, String tokenHash, String familyId,
                         Instant issuedAt, Instant expiresAt) {
        if ((employeeId == null) == (customerAccountId == null)) {
            throw new IllegalArgumentException("A refresh token must have exactly one principal owner");
        }
        this.employeeId = employeeId;
        this.customerAccountId = customerAccountId;
        this.tokenHash = tokenHash;
        this.familyId = familyId;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
    }

    /** Phát hành refresh token cho nhân viên. */
    public static RefreshToken issue(String employeeId, String tokenHash, String familyId,
                                     Instant issuedAt, Instant expiresAt) {
        return new RefreshToken(employeeId, null, tokenHash, familyId, issuedAt, expiresAt);
    }

    /** Phát hành refresh token cho tài khoản khách. */
    public static RefreshToken issueCustomer(Long customerAccountId, String tokenHash, String familyId,
                                             Instant issuedAt, Instant expiresAt) {
        return new RefreshToken(null, customerAccountId, tokenHash, familyId, issuedAt, expiresAt);
    }

    public String getEmployeeId() { return employeeId; }
    public Long getId() { return id; }
    public Long getCustomerAccountId() { return customerAccountId; }
    public String getTokenHash() { return tokenHash; }
    public String getFamilyId() { return familyId; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public String getReplacedByHash() { return replacedByHash; }

    /** Trả về loại chủ thể theo owner đang có của token. */
    public String getPrincipalType() {
        return principalType().name();
    }

    /** Trả về ID chủ thể theo đúng loại owner đã được xác thực. */
    public String getPrincipalId() {
        return principalType() == JwtTokenService.PrincipalType.EMPLOYEE
                ? employeeId : String.valueOf(customerAccountId);
    }

    /** Xác định owner và fail-fast nếu token có 0 hoặc 2 owner. */
    public JwtTokenService.PrincipalType principalType() {
        if (employeeId != null && customerAccountId == null) return JwtTokenService.PrincipalType.EMPLOYEE;
        if (employeeId == null && customerAccountId != null) return JwtTokenService.PrincipalType.CUSTOMER;
        throw new IllegalStateException("Refresh token owner is invalid");
    }

    /** Tạo định danh actor ổn định để ghi audit cho cả hai loại chủ thể. */
    public String auditActor() {
        return principalType() == JwtTokenService.PrincipalType.EMPLOYEE
                ? employeeId : "customer:" + customerAccountId;
    }

    /** Thu hồi token một lần và ghi token thay thế nếu đây là lần xoay vòng hợp lệ. */
    public void revoke(Instant at, String replacementHash) {
        this.revokedAt = at;
        this.replacedByHash = replacementHash;
    }
}
