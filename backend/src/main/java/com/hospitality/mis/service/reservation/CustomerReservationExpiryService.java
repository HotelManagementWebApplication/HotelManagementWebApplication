package com.hospitality.mis.service.reservation;

import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.billing.VnpayPaymentAttemptRepository;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Clock;

/** Worker giải phóng hold cọc hết hạn và ghi audit cho từng booking bị hủy tự động. */
@Service
public class CustomerReservationExpiryService {
    private final ReservationRepository reservations;
    private final AuditService audit;
    private final VnpayPaymentAttemptRepository vnpayAttempts;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public CustomerReservationExpiryService(ReservationRepository reservations, AuditService audit,
                                            VnpayPaymentAttemptRepository vnpayAttempts) {
        this.reservations = reservations;
        this.audit = audit;
        this.vnpayAttempts = vnpayAttempts;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }

    @Scheduled(fixedDelayString = "${hotel.booking.hold-expiry-scan-ms:60000}")
    @Transactional
    public void expireHolds() {
        for (var reservation : reservations.findExpiredCustomerHoldsForUpdate(LocalDateTime.now(clock))) {
            if (reservation.getStatus() != ReservationStatus.DRAFT
                    || reservation.getDepositPaymentStatus() != DepositPaymentStatus.PENDING) continue;
            reservation.transitionTo(ReservationStatus.CANCELLED);
            reservation.setDepositPaymentStatus(DepositPaymentStatus.EXPIRED);
            for (var attempt : vnpayAttempts.findByReservationIdAndStatus(
                    reservation.getId(), VnpayPaymentStatus.PENDING)) {
                attempt.setStatus(VnpayPaymentStatus.EXPIRED);
                attempt.setCompletedAt(LocalDateTime.now(clock));
            }
            audit.record("SYSTEM", "CUSTOMER_RESERVATION_HOLD_EXPIRED", "RESERVATION",
                    reservation.getId().toString(), "PENDING", "EXPIRED", "DEPOSIT_HOLD_TIMEOUT");
        }
    }
}
