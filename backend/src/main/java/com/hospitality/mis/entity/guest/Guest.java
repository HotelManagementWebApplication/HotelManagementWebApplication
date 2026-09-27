package com.hospitality.mis.entity.guest;



import jakarta.persistence.Access;

import jakarta.persistence.AccessType;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;

import jakarta.persistence.Enumerated;

import jakarta.persistence.GeneratedValue;

import jakarta.persistence.GenerationType;

import jakarta.persistence.Id;

import jakarta.persistence.Version;
import jakarta.persistence.Table;


import java.math.BigDecimal;

import java.util.Objects;



/**

 * Trạng thái chuẩn của khách và ánh xạ lưu trữ.

 *

 * Chủ thể JPA cụ thể duy nhất của bảng {@code guests}.
 */
@Entity
@Table(name = "KhachLuuTru")
@Access(AccessType.FIELD)
public class Guest {
    @Id

    @GeneratedValue(strategy = GenerationType.IDENTITY)

    @Column(name = "maKhachLuuTru", nullable = false)
    /** ID khách dùng làm khóa quan hệ với đặt phòng và tài khoản. */
    private Long id;



    @Column(name = "hoVaTen", nullable = false, length = 100)
    private String fullName;



    @Column(name = "diaChi", length = 255)
    private String address;



    @Column(name = "soDienThoai", nullable = false, unique = true, length = 15)
    private String phone;



    @Column(name = "email", length = 100)
    private String email;



    @Column(name = "soGiayToTuyThan", nullable = false, unique = true, length = 12)
    private String identityNumber;



    @Column(name = "namSinh")
    private Integer birthYear;



    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.MembershipTierConverter.class)

    @Column(name = "hangThanhVien", nullable = false, length = 20)
    /** Hạng thành viên hiện tại, được cập nhật bởi chính sách lưu trú. */
    private MembershipTier membershipTier = MembershipTier.STANDARD;



    @Column(name = "tongChiTieu", nullable = false, precision = 14, scale = 2)
    /** Tổng chi tiêu đã quyết toán suốt đời của khách. */
    private BigDecimal totalSpend = BigDecimal.ZERO;



    @Column(name = "soLanHuyMuon", nullable = false)
    /** Số lần hủy muộn dùng để giảm hạng và chặn đặt phòng. */
    private int lateCancellationCount;

    @Column(name = "soLanLuuTruHoanThanh", nullable = false)
    /** Số lần lưu trú hoàn tất dùng để xét hạng. */
    private int completedStays;

    @Column(name = "soLanTraPhongMuon", nullable = false)
    /** Số lần trả phòng muộn dùng cho quy tắc giảm hạng. */
    private int lateCheckoutCount;



    @Column(name = "biChanDatPhong", nullable = false)
    /** Cờ chặn đặt phòng; chỉ được mở lại bởi quy trình nghiệp vụ phù hợp. */
    private boolean bookingBlocked;



    @Version

    @Column(name = "phienBan", nullable = false)
    /** Phiên bản lạc quan, ngăn cập nhật đồng thời làm mất số liệu khách. */
    private long version;



    public Guest() {
        // Constructor rỗng bắt buộc để JPA khôi phục aggregate từ cơ sở dữ liệu.
    }



    public Long getId() {

        return id;

    }



    public void setId(Long id) {

        this.id = id;

    }



    public String getFullName() {

        return fullName;

    }



    public void setFullName(String fullName) {

        this.fullName = fullName;

    }



    public String getAddress() {

        return address;

    }



    public void setAddress(String address) {

        this.address = address;

    }



    public String getPhone() {

        return phone;

    }



    public void setPhone(String phone) {

        this.phone = phone;

    }



    public String getEmail() {

        return email;

    }



    public void setEmail(String email) {

        this.email = email;

    }



    public String getIdentityNumber() {

        return identityNumber;

    }



    public void setIdentityNumber(String identityNumber) {

        this.identityNumber = identityNumber;

    }



    public Integer getBirthYear() {

        return birthYear;

    }



    public void setBirthYear(Integer birthYear) {

        this.birthYear = birthYear;

    }



    public MembershipTier getMembershipTier() {

        return membershipTier;

    }



    public void setMembershipTier(MembershipTier membershipTier) {

        this.membershipTier = Objects.requireNonNull(membershipTier, "membershipTier");

    }



    public BigDecimal getTotalSpend() {

        return totalSpend;

    }



    public void setTotalSpend(BigDecimal totalSpend) {

        this.totalSpend = totalSpend == null ? BigDecimal.ZERO : totalSpend;

    }



    public int getLateCancellationCount() {

        return lateCancellationCount;

    }



    public void setLateCancellationCount(int lateCancellationCount) {

        if (lateCancellationCount < 0) {

            throw new IllegalArgumentException("lateCancellationCount must not be negative");

        }

        this.lateCancellationCount = lateCancellationCount;

    }



    public boolean isBookingBlocked() {

        return bookingBlocked;

    }



    public void setBookingBlocked(boolean bookingBlocked) {

        this.bookingBlocked = bookingBlocked;

    }



    public long getVersion() {

        return version;

    }



    /** Trả về việc khách này có thể được sử dụng cho một đặt phòng mới hay không. */

    public boolean canPlaceBooking() {

        return !bookingBlocked;

    }



    /**

     * Ghi nhận một lần hủy muộn và áp dụng ngưỡng chặn đặt phòng.

     * Ngữ cảnh đặt phòng hiện sở hữu ca sử dụng hủy của mình; phương thức này

     * duy trì quy tắc trong mô hình khách chuẩn mà không thay đổi hành vi của

     * ngữ cảnh đó trong quá trình di trú.

     */

    public void recordLateCancellation(int blockAtCount) {

        if (blockAtCount <= 0) {

            throw new IllegalArgumentException("blockAtCount must be positive");

        }

        lateCancellationCount++;

        if (lateCancellationCount > 2) downgradeMembershipOneTier();

        if (lateCancellationCount >= blockAtCount) {

            bookingBlocked = true;

        }

    }



    /** Cộng một khoản đã quyết toán vào tổng chi tiêu suốt đời của khách. */

    public void addSpend(BigDecimal amount) {

        if (amount == null || amount.signum() < 0) {

            throw new IllegalArgumentException("amount must not be negative");

        }

        totalSpend = totalSpend.add(amount);

    }



    /** Áp dụng chính sách hạng thành viên đã cấu hình cho trạng thái hiện tại của khách. */

    public void refreshMembership(MembershipPolicy policy, long completedStays) {

        membershipTier = Objects.requireNonNull(policy, "policy")

                .tierFor(completedStays);

    }

    public int getCompletedStays() { return completedStays; }

    public void setCompletedStays(int completedStays) {
        if (completedStays < 0) throw new IllegalArgumentException("completedStays must not be negative");
        this.completedStays = completedStays;
    }

    /** Tăng số lượt lưu trú hoàn tất rồi tính lại hạng theo policy. */
    public void recordCompletedStay(MembershipPolicy policy) {
        completedStays++;
        refreshMembership(policy, completedStays);
    }

    public int getLateCheckoutCount() { return lateCheckoutCount; }

    public void setLateCheckoutCount(int lateCheckoutCount) {
        if (lateCheckoutCount < 0) throw new IllegalArgumentException("lateCheckoutCount must not be negative");
        this.lateCheckoutCount = lateCheckoutCount;
    }

    /** Ghi nhận trả phòng muộn và giảm tối đa một bậc khi vượt ngưỡng. */
    public void recordLateCheckout() {
        lateCheckoutCount++;
        if (lateCheckoutCount > 3) downgradeMembershipOneTier();
    }

    /** Giảm hạng đúng một bậc; hạng STANDARD không thể giảm thêm. */
    private void downgradeMembershipOneTier() {
        membershipTier = switch (membershipTier) {
            case PLATINUM -> MembershipTier.GOLD;
            case GOLD -> MembershipTier.SILVER;
            case SILVER -> MembershipTier.STANDARD;
            case STANDARD -> MembershipTier.STANDARD;
        };
    }

}
