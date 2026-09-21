package com.hospitality.mis.dao.billing;



import com.hospitality.mis.entity.billing.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.hospitality.mis.entity.billing.PaymentStatus;
import java.time.LocalDateTime;



/** Kho hóa đơn, hỗ trợ đọc theo đặt phòng và khóa ghi khi thu tiền.
 * Lưu thông thường vẫn để JPA kiểm tra optimistic version; findForUpdate dùng khóa pessimistic khi cần.
 */
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    /** Tìm hóa đơn gắn với một đặt phòng; mỗi đặt phòng chỉ có một hóa đơn hiện hành. */
    Optional<Invoice> findByReservationId(Long reservationId);

    /** Phân trang invoice gắn trực tiếp với reservation query, không dựng page trong heap. */
    Page<Invoice> findAllByReservationId(Long reservationId, Pageable pageable);

    /** Tải hóa đơn dưới khóa ghi để cập nhật số dư hoặc trạng thái mà không tranh chấp đồng thời. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = :id")
    Optional<Invoice> findForUpdate(@Param("id") Long id);

    @Query("select i from Invoice i where (:status is null or i.status = :status) and (:reservationId is null or i.reservation.id = :reservationId) and (:fromAt is null or i.issuedAt >= :fromAt) and (:toAt is null or i.issuedAt < :toAt)")
    Page<Invoice> search(@Param("status") PaymentStatus status, @Param("reservationId") Long reservationId,
                         @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt,
                         Pageable pageable);
}
