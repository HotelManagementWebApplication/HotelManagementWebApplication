package com.hospitality.mis.entity.identity;



import com.hospitality.mis.entity.reservation.Reservation;
import jakarta.persistence.Column;

import jakarta.persistence.EnumType;

import jakarta.persistence.Enumerated;

import jakarta.persistence.FetchType;

import jakarta.persistence.Id;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.OneToMany;

import jakarta.persistence.Transient;



import java.util.ArrayList;

import java.util.List;

import java.util.Set;
import java.time.LocalDate;



/**

 * Mô hình nhân viên/tài khoản do ngữ cảnh định danh sở hữu và ánh xạ JPA.

 *

 * <p>Đây là chủ thể JPA cụ thể duy nhất cho aggregate tài khoản {@code employees}
 * chuẩn. Trạng thái xác thực và trạng thái khóa tài khoản được lưu trữ trên
 * cùng aggregate.</p>
 */

@Entity
@Table(name = "employees")
public class Employee {
    public enum EmploymentStatus { WORKING, ON_LEAVE, TERMINATED }
    @Id

    @Column(name = "id", length = 10, nullable = false)
    /** Mã nhân viên định danh tài khoản và khóa ngoại của các đặt phòng. */
    private String employeeId;



    @Column(name = "full_name", nullable = false, length = 100, columnDefinition = "NVARCHAR(100)")
    private String fullName;



    @Column(name = "password", length = 255, nullable = false)
    /** Mật khẩu đã băm, không chứa bí mật dạng rõ. */
    private String password;



    @Enumerated(EnumType.STRING)
    @Column(name = "position", nullable = false, length = 30)
    /** Vai trò quyết định tập quyền được suy ra cho nhân viên. */
    private EmployeeRole role;


    @Column(name = "address", length = 255, columnDefinition = "NVARCHAR(255)")
    private String address;



    @Column(name = "phone", length = 15, unique = true, nullable = false)
    private String phone;



    /** Khớp với Reservation.employee; lược đồ có khóa ngoại hạn chế, nên không lan truyền. */
    @OneToMany(mappedBy = "employee", fetch = FetchType.LAZY)
    private List<Reservation> reservations = new ArrayList<>();

    @OneToMany(mappedBy = "employee", fetch = FetchType.LAZY)
    private List<EmployeeLoginEvent> loginEvents = new ArrayList<>();


    public Employee() {
    }



    /** Constructor dùng bởi factory/nội bộ để tạo nhân viên đầy đủ thông tin. */
    protected Employee(String employeeId, String fullName, String password,

                       EmployeeRole role, String address, String phone) {
        this.employeeId = employeeId;

        this.fullName = fullName;

        this.password = password;

        this.role = role;
        this.address = address;

        this.phone = phone;

    }



    public String getEmployeeId() {

        return employeeId;

    }



    public void setEmployeeId(String employeeId) {

        this.employeeId = employeeId;

    }



    public String getFullName() {

        return fullName;

    }



    public void setFullName(String fullName) {

        this.fullName = fullName;

    }



    public String getPassword() {

        return password;

    }



    public void setPassword(String password) {

        this.password = password;

    }



    public EmployeeRole getRole() {
        return role;
    }

    public void setRole(EmployeeRole role) {
        this.role = role;
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



    public List<Reservation> getReservations() {
        return reservations;

    }



    public void setReservations(List<Reservation> reservations) {
        this.reservations = reservations;

    }



    public void changePassword(String encodedPassword) {

        // Chỉ nhận mật khẩu đã mã hóa; việc băm thuộc service xác thực.
        this.password = encodedPassword;

    }



    @Column(name = "enabled", nullable = false)
    /** Cờ tài khoản được phép xác thực. */
    private boolean enabled = true;

    @Column(name = "account_non_locked", nullable = false)
    /** Cờ khóa do thất bại đăng nhập; false thì cần mở khóa theo quy trình. */
    private boolean accountNonLocked = true;

    @Column(name = "failed_login_attempts", nullable = false)
    /** Số lần đăng nhập thất bại liên tiếp hiện tại. */
    private int failedLoginAttempts;

    @Column(name = "last_failed_login_at")
    /** Lần gần nhất xác thực thất bại, dùng cho theo dõi bảo mật. */
    private java.time.Instant lastFailedLoginAt;

    @Column(name = "last_login_at")
    /** Lần gần nhất đăng nhập thành công. */
    private java.time.Instant lastLoginAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_status", nullable = false, length = 20)
    private EmploymentStatus employmentStatus = EmploymentStatus.WORKING;

    @Column(name = "leave_start") private LocalDate leaveStart;
    @Column(name = "leave_end") private LocalDate leaveEnd;

    @Transient
    /** Quyền suy ra từ role, không nhận trực tiếp từ dữ liệu máy khách. */
    public Set<Permission> getPermissions() {
        return role.permissions();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isAccountNonLocked() {
        return accountNonLocked;
    }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public void setAccountNonLocked(boolean value) { this.accountNonLocked = value; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public java.time.Instant getLastFailedLoginAt() { return lastFailedLoginAt; }
    public java.time.Instant getLastLoginAt() { return lastLoginAt; }
    public EmploymentStatus getEmploymentStatus() { return employmentStatus; }
    public void setEmploymentStatus(EmploymentStatus value) { employmentStatus = value; }
    public LocalDate getLeaveStart() { return leaveStart; }
    public void setLeaveStart(LocalDate value) { leaveStart = value; }
    public LocalDate getLeaveEnd() { return leaveEnd; }
    public void setLeaveEnd(LocalDate value) { leaveEnd = value; }

    /** Ghi nhận thất bại và khóa tài khoản khi chạm ngưỡng cấu hình. */
    public void recordLoginFailure(java.time.Instant at, int maxAttempts) {
        failedLoginAttempts++;
        lastFailedLoginAt = at;
        if (failedLoginAttempts >= maxAttempts) accountNonLocked = false;
    }

    /** Xóa chuỗi thất bại và ghi thời điểm đăng nhập thành công. */
    public void recordLoginSuccess(java.time.Instant at) {
        failedLoginAttempts = 0;
        lastLoginAt = at;
    }

    /** Mở khóa và xóa bộ đếm thất bại sau khi đặt lại mật khẩu hợp lệ. */
    public void unlockAfterPasswordReset() {
        failedLoginAttempts = 0;
        accountNonLocked = true;
    }
}
