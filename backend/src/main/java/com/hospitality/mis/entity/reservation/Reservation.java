package com.hospitality.mis.entity.reservation;

import com.hospitality.mis.entity.billing.ServiceUsage;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.auth.CustomerAccount;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Chủ thể chuẩn của aggregate đặt phòng và bảng {@code reservations}. */
@Entity
@Table(name = "PhieuDatPhong")
@Access(AccessType.FIELD)
public class Reservation {
    /** ID đặt phòng dùng làm khóa của các quan hệ chi tiết. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maPhieuDatPhong", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maKhachLuuTru", nullable = false)
    /** Khách đứng tên đặt phòng. */
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "maNhanVien", nullable = true)
    /** Nhân viên tạo/quản lý đặt phòng. */
    private Employee employee;

    /** Tài khoản customer tạo booking; null với booking do nhân viên tạo tại quầy. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "maTaiKhoanKhachHang", nullable = true)
    private CustomerAccount customerAccount;

    @Column(name = "thoiDiemDat", nullable = false) private LocalDateTime bookedAt = LocalDateTime.now();
    @Column(name = "tienDatCoc", nullable = false, precision = 12, scale = 2) private BigDecimal depositAmount = BigDecimal.ZERO;
    /** Trạng thái vòng đời; chỉ transitionTo được phép áp dụng chuyển trạng thái hợp lệ. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.ReservationStatusConverter.class) @Column(name = "trangThai", nullable = false, length = 30) private ReservationStatus status = ReservationStatus.DRAFT;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.RentalTypeConverter.class)
    @Column(name = "hinhThucThue", nullable = false, length = 20) private String rentalType = "PACKAGE";
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.BookingSourceConverter.class)
    @Column(name = "nguonDatPhong", nullable = false, length = 30) private String bookingSource = "DIRECT";
    @Column(name = "doanhThuGopOta", nullable = false, precision = 14, scale = 2) private BigDecimal otaGrossRevenue = BigDecimal.ZERO;
    @Column(name = "hoaHongOta", nullable = false, precision = 14, scale = 2) private BigDecimal otaCommission = BigDecimal.ZERO;
    @Transient private BigDecimal otaNetRevenue = BigDecimal.ZERO;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.OtaReconciliationStatusConverter.class)
    @Column(name = "trangThaiDoiSoatOta", nullable = false, length = 20) private String otaReconciliationStatus = "NOT_APPLICABLE";
    /** Thời điểm nhận phòng thực tế, null trước khi check-in. */
    @Column(name = "thoiDiemNhanPhongThucTe") private LocalDateTime actualCheckIn;
    /** Thời điểm trả phòng thực tế, null trước khi check-out. */
    @Column(name = "thoiDiemTraPhongThucTe") private LocalDateTime actualCheckOut;
    /** Số phút gia hạn đã được chấp nhận cho đặt phòng. */
    @Column(name = "soPhutGiaHan", nullable = false) private int extensionMinutes;
    /** Khóa yêu cầu tạo/cập nhật duy nhất để chống xử lý lặp. */
    @Column(name = "khoaChongTrung", length = 100) private String idempotencyKey;
    /** Mã/hướng dẫn cọc phát hành cho booking online, không phải bằng chứng đã thanh toán. */
    @Column(name = "maThanhToanDatCoc", length = 40) private String depositPaymentCode;
    @Column(name = "thoiDiemHetHanThanhToanCoc") private LocalDateTime depositPaymentExpiresAt;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.DepositPaymentStatusConverter.class) @Column(name = "trangThaiThanhToanCoc", nullable = false, length = 20)
    private DepositPaymentStatus depositPaymentStatus = DepositPaymentStatus.NOT_REQUIRED;
    /** Kênh bảo đảm do khách online lựa chọn; null với booking do nhân viên tạo. */
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.CustomerPaymentMethodConverter.class)
    @Column(name = "phuongThucBaoDam", length = 20)
    private CustomerPaymentMethod customerPaymentMethod;
    /** Snapshot dùng để rollback an toàn phần gia hạn nếu cọc bổ sung hết hạn. */
    @Column(name = "loaiThayDoiDangCho", length = 20) private String pendingChangeType;
    @Column(name = "thoiDiemNhanPhongTruocThayDoi") private LocalDateTime pendingPreviousCheckIn;
    @Column(name = "thoiDiemTraPhongTruocThayDoi") private LocalDateTime pendingPreviousCheckOut;
    @Column(name = "tienDatCocTruocThayDoi", precision = 12, scale = 2) private BigDecimal pendingPreviousDepositAmount;
    @Column(name = "tienDatCocBoSung", nullable = false, precision = 12, scale = 2)
    private BigDecimal pendingAdditionalDeposit = BigDecimal.ZERO;
    /** Email nhận xác nhận riêng cho booking, có thể khác email hồ sơ. */
    @Column(name = "emailXacNhan", length = 150)
    private String confirmationEmail;
    /** Phiên bản lạc quan, bảo vệ đặt phòng trước cập nhật đồng thời. */
    @Version @Column(name = "phienBan", nullable = false) private long version;

    /** Lý do và kết quả quyết toán hủy phải tồn tại sau khi tải lại booking. */
    @Column(name = "lyDoHuy", length = 500) private String cancellationReason;
    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.CancellationOutcomeConverter.class)
    @Column(name = "ketQuaHuy", length = 30) private CancellationOutcome cancellationOutcome;
    @Transient private String canonicalRequestFingerprint;

    @OneToMany(mappedBy = "reservation", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReservationRoom> rooms = new ArrayList<>();
    @OneToMany(mappedBy = "reservation", fetch = FetchType.LAZY) private Set<ServiceUsage> serviceUsages;
    @OneToOne(mappedBy = "reservation", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true) private Invoice invoice;

    /** Constructor rỗng dành cho JPA. */
    public Reservation() {}
    public Long getId() { return id; }
    public Guest getGuest() { return guest; }
    public Employee getEmployee() { return employee; }
    public CustomerAccount getCustomerAccount() { return customerAccount; }
    public LocalDateTime getBookedAt() { return bookedAt; }
    public void setBookedAt(LocalDateTime bookedAt) { this.bookedAt = bookedAt; }
    public BigDecimal getDepositAmount() { return depositAmount; }
    public ReservationStatus getStatus() { return status; }
    public String getRentalType() { return rentalType; }
    public String getBookingSource() { return bookingSource; }
    public BigDecimal getOtaGrossRevenue() { return otaGrossRevenue; }
    public BigDecimal getOtaCommission() { return otaCommission; }
    public BigDecimal getOtaNetRevenue() {
        if (otaGrossRevenue == null || otaCommission == null) return BigDecimal.ZERO;
        return otaGrossRevenue.subtract(otaCommission).max(BigDecimal.ZERO);
    }
    public String getOtaReconciliationStatus() { return otaReconciliationStatus; }
    public LocalDateTime getActualCheckIn() { return actualCheckIn; }
    public LocalDateTime getActualCheckOut() { return actualCheckOut; }
    public int getExtensionMinutes() { return extensionMinutes; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getDepositPaymentCode() { return depositPaymentCode; }
    public LocalDateTime getDepositPaymentExpiresAt() { return depositPaymentExpiresAt; }
    public DepositPaymentStatus getDepositPaymentStatus() { return depositPaymentStatus; }
    public CustomerPaymentMethod getCustomerPaymentMethod() { return customerPaymentMethod; }
    public String getPendingChangeType() { return pendingChangeType; }
    public LocalDateTime getPendingPreviousCheckIn() { return pendingPreviousCheckIn; }
    public LocalDateTime getPendingPreviousCheckOut() { return pendingPreviousCheckOut; }
    public BigDecimal getPendingPreviousDepositAmount() { return pendingPreviousDepositAmount; }
    public BigDecimal getPendingAdditionalDeposit() { return pendingAdditionalDeposit; }
    public String getConfirmationEmail() { return confirmationEmail; }
    public long getVersion() { return version; }
    public String getCancellationReason() { return cancellationReason; }
    public CancellationOutcome getCancellationOutcome() { return cancellationOutcome; }
    public String getCanonicalRequestFingerprint() { return canonicalRequestFingerprint; }
    public List<ReservationRoom> getRooms() { return rooms; }
    public Set<ServiceUsage> getServiceUsages() { return serviceUsages; }
    public Invoice getInvoice() { return invoice; }
    public void setGuest(Guest value) { guest = value; }
    public void setEmployee(Employee value) { employee = value; }
    public void setCustomerAccount(CustomerAccount value) { customerAccount = value; }
    public void setDepositAmount(BigDecimal value) { depositAmount = value; }
    public void setRentalType(String value) { rentalType = value; }
    public void setBookingSource(String value) { bookingSource = value == null || value.isBlank() ? "DIRECT" : value.trim().toUpperCase(); }
    public void setOtaGrossRevenue(BigDecimal value) { otaGrossRevenue = value == null ? BigDecimal.ZERO : value; }
    public void setOtaCommission(BigDecimal value) { otaCommission = value == null ? BigDecimal.ZERO : value; }
    public void setOtaNetRevenue(BigDecimal value) { otaNetRevenue = getOtaNetRevenue(); }
    public void setOtaReconciliationStatus(String value) { otaReconciliationStatus = value == null || value.isBlank() ? "NOT_APPLICABLE" : value.trim().toUpperCase(); }
    public void setIdempotencyKey(String value) { idempotencyKey = value; }
    public void setDepositPaymentCode(String value) { depositPaymentCode = value; }
    public void setDepositPaymentExpiresAt(LocalDateTime value) { depositPaymentExpiresAt = value; }
    public void setDepositPaymentStatus(DepositPaymentStatus value) {
        depositPaymentStatus = value == null ? DepositPaymentStatus.NOT_REQUIRED : value;
    }
    public void setCustomerPaymentMethod(CustomerPaymentMethod value) { customerPaymentMethod = value; }
    public void setPendingChangeType(String value) { pendingChangeType = value; }
    public void setPendingPreviousCheckIn(LocalDateTime value) { pendingPreviousCheckIn = value; }
    public void setPendingPreviousCheckOut(LocalDateTime value) { pendingPreviousCheckOut = value; }
    public void setPendingPreviousDepositAmount(BigDecimal value) { pendingPreviousDepositAmount = value; }
    public void setPendingAdditionalDeposit(BigDecimal value) {
        pendingAdditionalDeposit = value == null ? BigDecimal.ZERO : value;
    }
    /** Xóa snapshot sau khi cọc bổ sung hoàn tất hoặc gia hạn bị rollback. */
    public void clearPendingChange() {
        pendingChangeType = null;
        pendingPreviousCheckIn = null;
        pendingPreviousCheckOut = null;
        pendingPreviousDepositAmount = null;
        pendingAdditionalDeposit = BigDecimal.ZERO;
    }
    public void setConfirmationEmail(String value) {
        confirmationEmail = value == null || value.isBlank() ? null : value.trim();
    }
    public void setCancellationReason(String value) { cancellationReason = value; }
    public void setCancellationOutcome(CancellationOutcome value) { cancellationOutcome = value; }
    public void setCanonicalRequestFingerprint(String value) { canonicalRequestFingerprint = value; }
    public void setActualCheckIn(LocalDateTime value) { actualCheckIn = value; }
    public void setActualCheckOut(LocalDateTime value) { actualCheckOut = value; }
    public void setExtensionMinutes(int value) { extensionMinutes = value; }
    /** Thêm phòng vào aggregate và đồng bộ phía sở hữu của quan hệ hai chiều. */
    public void addRoom(ReservationRoom room) { room.setReservation(this); rooms.add(room); }
    /** Chuyển trạng thái sau khi ReservationStatus xác nhận cạnh chuyển hợp lệ. */
    public void transitionTo(ReservationStatus next) {
        if (!status.canTransitionTo(next)) throw new IllegalStateException("Invalid reservation transition: " + status + " -> " + next);
        status = next;
    }
}
