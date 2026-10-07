package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.billing.ReceiptRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.finance.FinancialLedgerService;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;

/** Ghi cọc, hóa đơn, giao dịch, biên lai và ledger trong cùng transaction. */
@Service
public class DepositPaymentFinalizer {
    private final ReservationRepository reservations;
    private final InvoiceRepository invoices;
    private final PaymentTransactionRepository transactions;
    private final ReceiptRepository receipts;
    private final FinancialLedgerService ledger;
    private final AuditService audit;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public DepositPaymentFinalizer(ReservationRepository reservations, InvoiceRepository invoices,
                                   PaymentTransactionRepository transactions, ReceiptRepository receipts,
                                   FinancialLedgerService ledger, AuditService audit) {
        this.reservations = reservations;
        this.invoices = invoices;
        this.transactions = transactions;
        this.receipts = receipts;
        this.ledger = ledger;
        this.audit = audit;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock value) { clock = value; }

    @Transactional(propagation = Propagation.MANDATORY)
    public PaymentTransaction complete(Reservation reservation, BigDecimal amount, PaymentMethod method,
                                       String reference, String externalEventId, String actor) {
        var prior = transactions.findByExternalEventId(externalEventId);
        if (prior.isPresent()) return prior.get();
        if (reservation.getDepositPaymentStatus() == DepositPaymentStatus.PAID)
            throw new DomainException("DEPOSIT_ALREADY_PAID", "Tiền cọc đã được xác nhận");
        boolean extensionDeposit = reservation.getPendingChangeType() != null;
        BigDecimal expectedAmount = extensionDeposit
                ? reservation.getPendingAdditionalDeposit() : reservation.getDepositAmount();
        if (amount == null || expectedAmount == null || amount.compareTo(expectedAmount) != 0)
            throw new DomainException("PAYMENT_AMOUNT_MISMATCH", "Số tiền cọc không khớp booking");

        LocalDateTime now = LocalDateTime.now(clock);
        Invoice invoice = invoices.findByReservationId(reservation.getId()).orElseGet(() -> {
            Invoice created = new Invoice();
            created.setReservation(reservation);
            created.setIssuedAt(now);
            return created;
        });
        BigDecimal depositPaidBefore = invoice.getDepositPaid() == null ? BigDecimal.ZERO : invoice.getDepositPaid();
        invoice.setDepositPaid(extensionDeposit ? depositPaidBefore.add(amount) : amount);
        invoice.setAmountDue(BigDecimal.ZERO);
        invoice.setStatus(PaymentStatus.DU_KIEN);
        invoice.setPaymentMethod(method);
        invoice = invoices.saveAndFlush(invoice);

        PaymentTransaction payment = new PaymentTransaction();
        payment.setInvoice(invoice);
        payment.setAmount(amount);
        payment.setMethod(method);
        payment.setType(PaymentTransaction.TransactionType.PAYMENT);
        payment.setStatus(PaymentTransaction.TransactionStatus.COMPLETED);
        payment.setReference(reference);
        payment.setOccurredAt(now);
        payment.setActorId(actor);
        payment.setExternalEventId(externalEventId);
        payment.setIdempotencyKey(PaymentTransaction.storageIdempotencyKey(gatewayKey(externalEventId),
                actor, amount, method, payment.getType(), reference));
        payment = transactions.saveAndFlush(payment);

        String receiptNumber = extensionDeposit
                ? "DEP-VNPAY-" + reservation.getId() + "-" + payment.getId()
                : "DEP-VNPAY-" + reservation.getId();
        if (receipts.findByReceiptNumber(receiptNumber).isEmpty()) {
            Receipt receipt = new Receipt();
            receipt.setReceiptNumber(receiptNumber);
            receipt.setInvoice(invoice);
            receipt.setAmount(amount);
            receipt.setMethod(method);
            receipt.setIssuedAt(now);
            receipt.setIssuedBy(actor);
            Receipt savedReceipt = receipts.saveAndFlush(receipt);
            ledger.record("RECEIPT_ISSUED", "RECEIPT", String.valueOf(savedReceipt.getId()),
                    FinancialLedgerEntry.Direction.DEBIT, amount, actor, now, method.name());
        }
        ledger.record("PAYMENT_RECEIVED", "PAYMENT_TRANSACTION", String.valueOf(payment.getId()),
                FinancialLedgerEntry.Direction.DEBIT, amount, actor, now, "DEPOSIT");

        reservation.setDepositPaymentStatus(DepositPaymentStatus.PAID);
        if (reservation.getStatus() == ReservationStatus.DRAFT)
            reservation.transitionTo(ReservationStatus.DEPOSIT_PAID);
        if (extensionDeposit) {
            long addedMinutes = java.time.Duration.between(
                    reservation.getPendingPreviousCheckOut(), reservation.getRooms().get(0).getCheckOut()).toMinutes();
            reservation.setExtensionMinutes(Math.addExact(reservation.getExtensionMinutes(), Math.toIntExact(addedMinutes)));
            reservation.clearPendingChange();
            reservation.setDepositPaymentCode(null);
            reservation.setDepositPaymentExpiresAt(null);
        }
        reservations.saveAndFlush(reservation);
        audit.record(actor, extensionDeposit ? "EXTENSION_DEPOSIT_PAYMENT_CONFIRMED" : "DEPOSIT_PAYMENT_CONFIRMED", "RESERVATION",
                reservation.getId().toString(), "PENDING", "PAID", externalEventId);
        return payment;
    }

    private String gatewayKey(String externalEventId) {
        String fingerprint = com.hospitality.mis.service.reservation.IdempotencySupport.fingerprint(externalEventId);
        return "GW-" + fingerprint.substring(0, 28);
    }
}
