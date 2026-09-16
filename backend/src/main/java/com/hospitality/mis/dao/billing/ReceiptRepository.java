package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.hospitality.mis.entity.billing.PaymentMethod;
import java.time.LocalDateTime;

/** Kho biên lai phát hành cho hóa đơn. */
public interface ReceiptRepository extends JpaRepository<Receipt, Long> {
    /** Tra cứu biên lai theo số hiển thị duy nhất. */
    Optional<Receipt> findByReceiptNumber(String receiptNumber);

    /** Lấy các biên lai của hóa đơn theo thứ tự phát hành tăng dần. */
    List<Receipt> findByInvoiceIdOrderByIssuedAtAsc(Long invoiceId);

    @Query("select r from Receipt r where (:invoiceId is null or r.invoice.id = :invoiceId) and (:method is null or r.method = :method) and (:issuedBy is null or r.issuedBy = :issuedBy) and (:fromAt is null or r.issuedAt >= :fromAt) and (:toAt is null or r.issuedAt < :toAt)")
    Page<Receipt> search(@Param("invoiceId") Long invoiceId, @Param("method") PaymentMethod method,
                         @Param("issuedBy") String issuedBy, @Param("fromAt") LocalDateTime fromAt,
                         @Param("toAt") LocalDateTime toAt, Pageable pageable);
}
