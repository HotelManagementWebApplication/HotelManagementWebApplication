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
    List<PaymentTransaction> findByInvoiceIdOrderByOccurredAtAsc(Long invoiceId);

    /** Lọc các giao dịch của hóa đơn theo trạng thái xử lý hiện tại. */
    List<PaymentTransaction> findByInvoiceIdAndStatus(Long invoiceId, TransactionStatus status);

    /** Tìm giao dịch theo tiền tố khóa chống lặp, bản ghi mới hơn đứng trước. */
    @org.springframework.data.jpa.repository.Query("select p from PaymentTransaction p where p.idempotencyKey like concat(:prefix, '%') order by p.id desc")
    List<PaymentTransaction> findByIdempotencyKeyPrefix(@org.springframework.data.repository.query.Param("prefix") String prefix);

    /** Tính tiền mặt thuần của nhân viên trong khoảng nửa kín (fromAt, toAt]. */
    @org.springframework.data.jpa.repository.Query(value = """
            select coalesce(sum(case when type = 'PAYMENT' then amount else -amount end), 0)
            from payment_transactions
            where actor_id = :actor and method = 'CASH' and status = 'COMPLETED'
              and occurred_at > :fromAt and occurred_at <= :toAt
            """, nativeQuery = true)
    BigDecimal netCashByActorBetween(@org.springframework.data.repository.query.Param("actor") String actor,
                                     @org.springframework.data.repository.query.Param("fromAt") LocalDateTime fromAt,
                                     @org.springframework.data.repository.query.Param("toAt") LocalDateTime toAt);

    @org.springframework.data.jpa.repository.Query("select p from PaymentTransaction p where (:invoiceId is null or p.invoice.id = :invoiceId) and (:method is null or p.method = :method) and (:type is null or p.type = :type) and (:status is null or p.status = :status) and (:fromAt is null or p.occurredAt >= :fromAt) and (:toAt is null or p.occurredAt < :toAt)")
    Page<PaymentTransaction> search(@org.springframework.data.repository.query.Param("invoiceId") Long invoiceId,
                                    @org.springframework.data.repository.query.Param("method") PaymentMethod method,
                                    @org.springframework.data.repository.query.Param("type") TransactionType type,
                                    @org.springframework.data.repository.query.Param("status") TransactionStatus status,
                                    @org.springframework.data.repository.query.Param("fromAt") LocalDateTime fromAt,
                                    @org.springframework.data.repository.query.Param("toAt") LocalDateTime toAt,
                                    Pageable pageable);
}
