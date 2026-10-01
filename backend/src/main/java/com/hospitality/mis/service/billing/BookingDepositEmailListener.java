package com.hospitality.mis.service.billing;

import com.hospitality.mis.service.auth.EmailDeliveryException;
import com.hospitality.mis.service.auth.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Gửi thư sau commit để lỗi SMTP không đảo ngược khoản tiền đã ghi nhận. */
@Component
public class BookingDepositEmailListener {
    private static final Logger log = LoggerFactory.getLogger(BookingDepositEmailListener.class);
    private final EmailService emails;

    public BookingDepositEmailListener(EmailService emails) { this.emails = emails; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDepositPaid(BookingDepositPaidEvent event) {
        if (event.email() == null || event.email().isBlank()) return;
        try {
            emails.sendBookingDepositConfirmation(event.email(), event.reservationId(), event.amount(),
                    event.roomSummary(), event.paymentReference());
        } catch (EmailDeliveryException exception) {
            log.warn("Không thể gửi email xác nhận cọc cho booking {}: {}",
                    event.reservationId(), exception.getMessage());
        }
    }
}
