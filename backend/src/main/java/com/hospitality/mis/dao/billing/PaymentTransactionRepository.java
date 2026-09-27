package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import com.hospitality.mis.entity.billing.PaymentTransaction.TransactionStatus;
import com.hospitality.mis.entity.billing.PaymentTransaction.TransactionType;
import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.hospitality.mis.entity.billing.PaymentMethod;

/** Kho sổ giao dịch thanh toán và các phép tổng hợp tiền mặt theo actor. */
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    java.util.Optional<PaymentTransaction> findByExternalEventId(String externalEventId);
    /** Lấy sổ giao dịch của hóa đơn theo thứ tự thời gian phát sinh để dựng lịch sử thanh toán. */
    List<PaymentTransaction> findByInvoiceIdOrderByOccurredAtAscIdAsc(Long invoiceId);

    /** Phân trang payment trong phạm vi một invoice tại DB. */
    Page<PaymentTransaction> findByInvoiceIdOrderByOccurredAtAscIdAsc(Long invoiceId, Pageable pageable);

    /** Lọc các giao dịch của hóa đơn theo trạng thái xử lý hiện tại. */
    List<PaymentTransaction> findByInvoiceIdAndStatus(Long invoiceId, TransactionStatus status);

    /** Tổng payment trừ refund của một invoice/tender, không tải toàn bộ ledger. */
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(case when p.type = :paymentType then p.amount else -p.amount end), 0) from PaymentTransaction p where p.invoice.id = :invoiceId and p.method = :method and p.status = :status")
    BigDecimal netAmountByInvoiceAndMethod(@org.springframework.data.repository.query.Param("invoiceId") Long invoiceId,
                                           @org.springframework.data.repository.query.Param("method") PaymentMethod method,
                                           @org.springframework.data.repository.query.Param("paymentType") TransactionType paymentType,
                                           @org.springframework.data.repository.query.Param("status") TransactionStatus status);

    interface ReconciliationTotal {
        PaymentMethod getMethod();
        TransactionType getType();
        BigDecimal getAmount();
    }

    /** Tổng hợp payment/refund theo tender trong DB cho báo cáo đối soát. */
    @org.springframework.data.jpa.repository.Query("select p.method as method, p.type as type, coalesce(sum(p.amount), 0) as amount from PaymentTransaction p where p.status = :status and p.occurredAt >= :fromAt and p.occurredAt < :toAt group by p.method, p.type")
    List<ReconciliationTotal> summarize(@org.springframework.data.repository.query.Param("status") TransactionStatus status,
                                        @org.springframework.data.repository.query.Param("fromAt") LocalDateTime fromAt,
                                        @org.springframework.data.repository.query.Param("toAt") LocalDateTime toAt);

    /** Tìm giao dịch theo tiền tố khóa chống lặp, bản ghi mới hơn đứng trước. */
    @org.springframework.data.jpa.repository.Query("select p from PaymentTransaction p where p.idempotencyKey like concat(:prefix, '%') order by p.id desc")
    List<PaymentTransaction> findByIdempotencyKeyPrefix(@org.springframework.data.repository.query.Param("prefix") String prefix);

    /** Tính tiền mặt thuần của nhân viên trong khoảng nửa kín (fromAt, toAt]. */
    @org.springframework.data.jpa.repository.Query(value = """
            select coalesce(sum(case when loai = N'Thanh toán' then soTien else -soTien end), 0)
            from GiaoDichThanhToan
            where maNguoiThucHien = :actor and phuongThuc = N'Tiền mặt' and trangThai = N'Đã hoàn tất'
              and thoiDiemPhatSinh > :fromAt and thoiDiemPhatSinh <= :toAt
            """, nativeQuery = true)
    BigDecimal netCashByActorBetween(@org.springframework.data.repository.query.Param("actor") String actor,
                                     @org.springframework.data.repository.query.Param("fromAt") LocalDateTime fromAt,
                                     @org.springframework.data.repository.query.Param("toAt") LocalDateTime toAt);

    @org.springframework.data.jpa.repository.Query("select p from PaymentTransaction p where (:invoiceId is null or p.invoice.id = :invoiceId) and (:method is null or p.method = :method) and (:type is null or p.type = :type) and (:status is null or p.status = :status) and (:fromAt is null or p.occurredAt >= :fromAt) and (:toAt is null or p.occurredAt < :toAt) order by p.occurredAt asc, p.id asc")
    Page<PaymentTransaction> search(@org.springframework.data.repository.query.Param("invoiceId") Long invoiceId,
                                    @org.springframework.data.repository.query.Param("method") PaymentMethod method,
                                    @org.springframework.data.repository.query.Param("type") TransactionType type,
                                    @org.springframework.data.repository.query.Param("status") TransactionStatus status,
                                    @org.springframework.data.repository.query.Param("fromAt") LocalDateTime fromAt,
                                    @org.springframework.data.repository.query.Param("toAt") LocalDateTime toAt,
                                    Pageable pageable);
}
