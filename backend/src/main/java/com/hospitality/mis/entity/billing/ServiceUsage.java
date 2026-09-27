/* Entity này ghi lại dịch vụ đã sử dụng, cùng đơn giá tại thời điểm phát sinh. */
package com.hospitality.mis.entity.billing;

import com.hospitality.mis.entity.reservation.Reservation;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Một dòng ghi nhận dịch vụ đã sử dụng thuộc một đặt phòng.
 *
 * <p>Khóa ghép gồm đặt phòng, dịch vụ và ngày sử dụng.
 * Đơn giá được ghi nhận tại thời điểm sử dụng để lịch sử hóa đơn không thay đổi
 * khi danh mục dịch vụ được cập nhật sau đó.</p>
 */
@Entity
@Table(name = "SuDungDichVu")
@IdClass(ServiceUsageId.class)
@Access(AccessType.FIELD)
public class ServiceUsage {
    /** Đặt phòng phát sinh dịch vụ; cùng với service và usedOn tạo khóa ghép. */
    @Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maPhieuDatPhong")
    private Reservation reservation;
    /** Dịch vụ được sử dụng trong ngày; cùng một dịch vụ/ngày không lặp trong đặt phòng. */
    @Id @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "maDichVu")
    private Service service;
    /** Ngày nghiệp vụ dùng để phân biệt các lần dùng dịch vụ. */
    @Id @Column(name = "ngaySuDung") private LocalDate usedOn;
    /** Số lượng dùng, được tính với đơn giá chụp tại thời điểm tạo dòng. */
    @Column(name = "soLuong", nullable = false) private Integer quantity = 0;
    /** Đơn giá bất biến theo lịch sử hóa đơn, không tự đổi theo Service.price. */
    @Column(name = "donGia", nullable = false, precision = 12, scale = 2) private BigDecimal unitPrice;

    /** Constructor rỗng dành cho JPA. */
    public ServiceUsage() {}
    /** Tạo dòng sử dụng và chụp đơn giá hiện thời của dịch vụ. */
    public ServiceUsage(Reservation reservation, Service service, LocalDate usedOn, Integer quantity) {
        this.reservation = reservation; this.service = service; this.usedOn = usedOn;
        this.quantity = quantity; this.unitPrice = service.getPrice();
    }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation value) { reservation = value; }
    public Service getService() { return service; }
    public void setService(Service value) { service = value; }
    public LocalDate getUsedOn() { return usedOn; }
    public void setUsedOn(LocalDate value) { usedOn = value; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer value) { quantity = value; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal value) { unitPrice = value; }
}
