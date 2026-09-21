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
@Table(name = "reservations")
@Access(AccessType.FIELD)
public class Reservation {
    /** ID đặt phòng dùng làm khóa của các quan hệ chi tiết. */
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guest_id", nullable = false)
    /** Khách đứng tên đặt phòng. */
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "employee_id", nullable = true)
    /** Nhân viên tạo/quản lý đặt phòng. */
    private Employee employee;

    /** Tài khoản customer tạo booking; null với booking do nhân viên tạo tại quầy. */
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "customer_account_id", nullable = true)
    private CustomerAccount customerAccount;

    @Column(name = "booked_at", nullable = false) private LocalDateTime bookedAt = LocalDateTime.now();
    @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2) private BigDecimal depositAmount = BigDecimal.ZERO;
    /** Trạng thái vòng đời; chỉ transitionTo được phép áp dụng chuyển trạng thái hợp lệ. */
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 30) private ReservationStatus status = ReservationStatus.DRAFT;
    @Column(name = "rental_type", nullable = false, length = 20) private String rentalType = "PACKAGE";
    @Column(name = "booking_source", nullable = false, length = 30) private String bookingSource = "DIRECT";
    @Column(name = "ota_gross_revenue", nullable = false, precision = 14, scale = 2) private BigDecimal otaGrossRevenue = BigDecimal.ZERO;
    @Column(name = "ota_commission", nullable = false, precision = 14, scale = 2) private BigDecimal otaCommission = BigDecimal.ZERO;
    @Column(name = "ota_net_revenue", nullable = false, precision = 14, scale = 2) private BigDecimal otaNetRevenue = BigDecimal.ZERO;
    @Column(name = "ota_reconciliation_status", nullable = false, length = 20) private String otaReconciliationStatus = "NOT_APPLICABLE";
    /** Thời điểm nhận phòng thực tế, null trước khi check-in. */
    @Column(name = "actual_check_in") private LocalDateTime actualCheckIn;
    /** Thời điểm trả phòng thực tế, null trước khi check-out. */
    @Column(name = "actual_check_out") private LocalDateTime actualCheckOut;
    /** Số phút gia hạn đã được chấp nhận cho đặt phòng. */
    @Column(name = "extension_minutes", nullable = false) private int extensionMinutes;
    /** Khóa yêu cầu tạo/cập nhật duy nhất để chống xử lý lặp. */
    @Column(name = "idempotency_key", length = 100, unique = true) private String idempotencyKey;
    /** Mã/hướng dẫn cọc phát hành cho booking online, không phải bằng chứng đã thanh toán. */
    @Column(name = "deposit_payment_code", length = 40, unique = true) private String depositPaymentCode;
    @Column(name = "deposit_payment_expires_at") private LocalDateTime depositPaymentExpiresAt;
    @Enumerated(EnumType.STRING) @Column(name = "deposit_payment_status", nullable = false, length = 20)
    private DepositPaymentStatus depositPaymentStatus = DepositPaymentStatus.NOT_REQUIRED;
    /** Phiên bản lạc quan, bảo vệ đặt phòng trước cập nhật đồng thời. */
    @Version @Column(name = "version", nullable = false) private long version;

    /** Thông tin hủy được ghi nhận trong nhật ký kiểm toán của lệnh khi lược đồ hiện tại
     * không thể được di trú trong phạm vi thay đổi này. */
    @Transient private String cancellationReason;
    @Transient private CancellationOutcome cancellationOutcome;
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
    public BigDecimal getOtaNetRevenue() { return otaNetRevenue; }
    public String getOtaReconciliationStatus() { return otaReconciliationStatus; }
    public LocalDateTime getActualCheckIn() { return actualCheckIn; }
    public LocalDateTime getActualCheckOut() { return actualCheckOut; }
    public int getExtensionMinutes() { return extensionMinutes; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getDepositPaymentCode() { return depositPaymentCode; }
    public LocalDateTime getDepositPaymentExpiresAt() { return depositPaymentExpiresAt; }
    public DepositPaymentStatus getDepositPaymentStatus() { return depositPaymentStatus; }
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
    public void setOtaNetRevenue(BigDecimal value) { otaNetRevenue = value == null ? BigDecimal.ZERO : value; }
    public void setOtaReconciliationStatus(String value) { otaReconciliationStatus = value == null || value.isBlank() ? "NOT_APPLICABLE" : value.trim().toUpperCase(); }
    public void setIdempotencyKey(String value) { idempotencyKey = value; }
    public void setDepositPaymentCode(String value) { depositPaymentCode = value; }
    public void setDepositPaymentExpiresAt(LocalDateTime value) { depositPaymentExpiresAt = value; }
    public void setDepositPaymentStatus(DepositPaymentStatus value) {
        depositPaymentStatus = value == null ? DepositPaymentStatus.NOT_REQUIRED : value;
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
