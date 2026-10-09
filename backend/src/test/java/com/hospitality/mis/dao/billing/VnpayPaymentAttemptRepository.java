package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.VnpayPaymentAttempt;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Kho lưu lịch sử các lần chuyển khách sang VNPay. */
public interface VnpayPaymentAttemptRepository extends JpaRepository<VnpayPaymentAttempt, Long> {
    Optional<VnpayPaymentAttempt> findByMerchantReference(String reference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from VnpayPaymentAttempt a join fetch a.reservation r where a.merchantReference = :reference")
    Optional<VnpayPaymentAttempt> findByMerchantReferenceForUpdate(@Param("reference") String reference);

    Optional<VnpayPaymentAttempt> findFirstByReservationIdOrderByCreatedAtDescIdDesc(Long reservationId);

    List<VnpayPaymentAttempt> findByReservationIdAndStatus(Long reservationId, VnpayPaymentStatus status);
}
