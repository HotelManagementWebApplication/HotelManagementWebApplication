package com.hospitality.mis.entity.auth;

import com.hospitality.mis.entity.guest.Guest;
import jakarta.persistence.*;

@Entity
@Table(name = "TaiKhoanKhachHang")
/** Tài khoản đăng nhập của khách, liên kết một-một với hồ sơ {@link Guest}. */
public class CustomerAccount {
    /** Khóa kỹ thuật do cơ sở dữ liệu sinh; không dùng làm số điện thoại đăng nhập. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maTaiKhoanKhachHang")
    private Long id;
    /** Hồ sơ khách sở hữu duy nhất tài khoản này. */
    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "maKhachLuuTru", nullable = false, unique = true)
    private Guest guest;
    /** Số điện thoại duy nhất dùng làm tên đăng nhập của khách. */
    @Column(name = "soDienThoai", nullable = false, unique = true, length = 15) private String phone;
    /** Mật khẩu đã được băm; entity không lưu mật khẩu dạng rõ. */
    @Column(name = "matKhau", nullable = false, length = 255) private String password;
    /** Cờ cho phép xác thực; false thì tài khoản bị vô hiệu hóa. */
    @Column(name = "duocKichHoat", nullable = false) private boolean enabled = true;
    /** Cờ khóa đăng nhập do chính sách bảo mật; false thì không được đăng nhập. */
    @Column(name = "taiKhoanKhongBiKhoa", nullable = false) private boolean accountNonLocked = true;

    public Long getId() { return id; }
    public Guest getGuest() { return guest; }
    public void setGuest(Guest guest) { this.guest = guest; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public boolean isAccountNonLocked() { return accountNonLocked; }
    public void setAccountNonLocked(boolean value) { this.accountNonLocked = value; }
}
