package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.InvoiceAdjustmentRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.billing.ReceiptRepository;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dto.billing.InvoiceDtos;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.billing.InvoiceAdjustment;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentStatus;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.billing.Receipt;
import com.hospitality.mis.entity.guest.MembershipPolicy;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import com.hospitality.mis.service.finance.FinancialLedgerService;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;

/**
 * Tính và đối soát hóa đơn từ lưu trú, dịch vụ, phụ phí và bồi thường.
 * Các use case thay đổi đều nằm trong giao dịch; refund/adjustment còn phải
 * qua ApprovalService và liên kết idempotency trước khi ghi sổ.
 */
@Service
public class BillingService {
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    /** Khóa đặt phòng để checkout không chạy đồng thời với thao tác khác. */
    private final ReservationRepository reservations;
    /** Lưu hóa đơn và trạng thái công nợ đã đối soát. */
    private final InvoiceRepository invoices;
    /** Chính sách tính giá, giảm giá và làm tròn tiền. */
    private final PricingPolicy pricing;
    /** Ghi audit cho các biến động hóa đơn và thanh toán. */
    private final AuditService audit;
    /** Nguồn các khoản bồi thường thiết bị đưa vào hóa đơn. */
    private final EquipmentIncidentRepository incidents;
    /** Kiểm tra và tiêu thụ phê duyệt cho refund/điều chỉnh. */
    private final ApprovalService approvals;
    /** Sổ giao dịch thu/hoàn tiền và khóa idempotency thanh toán. */
    private final PaymentTransactionRepository transactions;
    /** Phát hành biên lai cho các khoản thanh toán. */
    private final ReceiptRepository receipts;
    /** Lưu các điều chỉnh hóa đơn đã gắn actor và idempotency key. */
    private final InvoiceAdjustmentRepository adjustments;
    private FinancialLedgerService ledger;

    @org.springframework.beans.factory.annotation.Autowired
    public BillingService(ReservationRepository reservations, InvoiceRepository invoices, PricingPolicy pricing,
                          AuditService audit, EquipmentIncidentRepository incidents, ApprovalService approvals,
                          PaymentTransactionRepository transactions, ReceiptRepository receipts,
                          InvoiceAdjustmentRepository adjustments) {
        this.reservations = reservations; this.invoices = invoices; this.pricing = pricing; this.audit = audit;
        this.incidents = incidents; this.approvals = approvals; this.transactions = transactions; this.receipts = receipts;
        this.adjustments = adjustments;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }
    @org.springframework.beans.factory.annotation.Autowired
    void setFinancialLedger(FinancialLedgerService ledger) { this.ledger = ledger; }

    /** Hàm khởi tạo thuận tiện cho kiểm thử, dành cho các bên gọi không sử dụng chức năng điều chỉnh. */
    public BillingService(ReservationRepository reservations, InvoiceRepository invoices, PricingPolicy pricing,
                          AuditService audit, EquipmentIncidentRepository incidents, ApprovalService approvals,
                          PaymentTransactionRepository transactions, ReceiptRepository receipts) {
        this(reservations, invoices, pricing, audit, incidents, approvals, transactions, receipts, null);
    }

    /** Checkout đặt phòng, tính toàn bộ khoản phải trả, đối soát và chuyển phòng sang trạng thái sau lưu trú. */
    @Transactional
    public InvoiceDtos.Response checkOut(Long reservationId, LocalDateTime checkoutAt, PaymentMethod method, String actor) {
        String boundActor = requireActor(actor);
        com.hospitality.mis.middleware.security.ReservationAccess.requireOperator(boundActor);
        Reservation reservation = reservations.findForUpdate(reservationId)
                .orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng"));
        Invoice invoice = invoices.findByReservationId(reservationId).orElseGet(Invoice::new);
        requireScope(reservation, boundActor);
        if (reservation.getStatus() != ReservationStatus.CHECKED_IN)
            throw error("INVALID_STATE", "Chỉ được check-out đặt phòng đang ở");
        if (checkoutAt == null || reservation.getActualCheckIn() == null)
            throw error("INVALID_CHECKOUT_TIME", "Thời điểm trả phòng thực tế là bắt buộc");
        if (!checkoutAt.isAfter(reservation.getActualCheckIn()))
            throw error("INVALID_CHECKOUT_TIME", "Thời điểm trả phòng phải sau thời điểm nhận phòng thực tế");

        BigDecimal room = BigDecimal.ZERO;
        BigDecimal extension = BigDecimal.ZERO;
        BigDecimal late = BigDecimal.ZERO;
        for (ReservationRoom line : reservation.getRooms()) {
            BigDecimal dailyPrice = line.getRoom().getRoomType().getDailyPrice();
            BigDecimal hourlyPrice = line.getRoom().getRoomType().getHourlyPrice();
            LocalDateTime baseCheckout = line.getOriginalCheckOut();
            int extensionMinutes = (int) Math.max(0,
                    java.time.Duration.between(baseCheckout, line.getCheckOut()).toMinutes());
            if (baseCheckout.isAfter(line.getCheckIn())) {
                room = room.add(pricing.roomCharge(dailyPrice, hourlyPrice, line.getCheckIn(), baseCheckout,
                        "HOURLY".equals(reservation.getRentalType())));
            }
            extension = extension.add(pricing.extensionCharge(dailyPrice, extensionMinutes));
            late = late.add(pricing.lateSurcharge(dailyPrice, line.getCheckOut(), checkoutAt));
        }
        BigDecimal services = reservation.getServiceUsages() == null ? BigDecimal.ZERO : reservation.getServiceUsages().stream()
                .map(x -> x.getUnitPrice().multiply(BigDecimal.valueOf(x.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal compensation = incidents.findByReservationId(reservationId).stream().map(x -> x.getCompensation())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (late.signum() > 0) reservation.getGuest().recordLateCheckout();
        BigDecimal subtotal = room.add(services).add(late).add(extension).add(compensation);
        BigDecimal discount = pricing.vipDiscount(room, reservation.getGuest().getMembershipTier());

        invoice.setReservation(reservation); invoice.setIssuedAt(checkoutAt); invoice.setRoomTotal(room);
        invoice.setServiceTotal(services); invoice.setSurcharge(late); invoice.setExtensionFee(extension);
        invoice.setCompensation(compensation); invoice.setDiscount(discount); invoice.setDepositPaid(BigDecimal.ZERO);
        if (method != null) invoice.setPaymentMethod(method);
        invoice = invoices.saveAndFlush(invoice);
        invoice.setDepositPaid(depositBalance(invoice));
        reconcile(invoice);

        reservation.setActualCheckOut(checkoutAt); reservation.transitionTo(ReservationStatus.CHECKED_OUT);
        // ReservationRoom.checkOut là thời điểm trả phòng theo lịch và phải được giữ nguyên.
        reservation.getRooms().forEach(x -> { x.setStatus(RoomStatus.RETURNED); x.getRoom().setStatus(RoomStatus.CLEANING); });
        reservation.getGuest().addSpend(subtotal.subtract(discount).max(BigDecimal.ZERO));
        if (qualifiesForCompletedStay(reservation)) {
            reservation.getGuest().recordCompletedStay(MembershipPolicy.defaults());
        }
        audit.record(boundActor, "INVOICE_RECONCILED", "INVOICE", String.valueOf(invoice.getId()), null,
                payable(invoice, subtotal.subtract(discount)).toPlainString(), null);
        if (ledger != null) ledger.record("REVENUE_RECOGNIZED", "INVOICE", String.valueOf(invoice.getId()),
                FinancialLedgerEntry.Direction.CREDIT, invoiceChargeTotal(invoice), boundActor,
                checkoutAt, "CHECKOUT");
        return toResponse(invoice);
    }

    /**
     * Lượt VIP lấy theo khoảng thời gian đã đặt, không lấy theo thời gian thực tế.
     * Một reservation nhiều phòng vẫn chỉ tạo tối đa một lượt lưu trú hoàn tất.
     */
    private boolean qualifiesForCompletedStay(Reservation reservation) {
        if (reservation.getRooms() == null || reservation.getRooms().isEmpty()) return false;
        LocalDateTime expectedCheckIn = reservation.getRooms().stream()
                .map(ReservationRoom::getCheckIn)
                .filter(java.util.Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .orElse(null);
        LocalDateTime expectedCheckOut = reservation.getRooms().stream()
                .map(ReservationRoom::getOriginalCheckOut)
                .filter(java.util.Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
        return expectedCheckIn != null && expectedCheckOut != null
                && !java.time.Duration.between(expectedCheckIn, expectedCheckOut)
                .minusHours(24).isNegative();
    }

    /** Tạo khoản thanh toán trước và biên lai tương ứng trong cùng giao dịch với việc tạo đặt phòng. */
    /** Ghi tiền cọc, giao dịch thanh toán và biên lai một cách nguyên tử khi tạo đặt phòng. */
    @Transactional
    public void registerDeposit(Reservation reservation) {
        BigDecimal deposit = reservation.getDepositAmount() == null ? BigDecimal.ZERO : reservation.getDepositAmount();
        if (deposit.signum() == 0) return;
        String actor = SecurityActor.currentActor();
        requireScope(reservation, actor);
        if (invoices.findByReservationId(reservation.getId()).isPresent()) return;
        Invoice invoice = new Invoice(); invoice.setReservation(reservation); invoice.setIssuedAt(LocalDateTime.now(clock)); invoice.setDepositPaid(deposit);
        invoice.setAmountDue(BigDecimal.ZERO); invoice.setStatus(PaymentStatus.DU_KIEN); invoice = invoices.saveAndFlush(invoice);

        PaymentTransaction payment = new PaymentTransaction(); payment.setInvoice(invoice); payment.setAmount(deposit);
        payment.setMethod(PaymentMethod.CASH); payment.setType(PaymentTransaction.TransactionType.PAYMENT);
        payment.setStatus(PaymentTransaction.TransactionStatus.COMPLETED); payment.setReference("DEPOSIT:" + reservation.getId());
        payment.setOccurredAt(LocalDateTime.now(clock)); payment.setActorId(actor);
        payment.setIdempotencyKey(PaymentTransaction.storageIdempotencyKey("DEPOSIT:" + reservation.getId(), actor, deposit,
                PaymentMethod.CASH, PaymentTransaction.TransactionType.PAYMENT, payment.getReference()));
        payment = transactions.saveAndFlush(payment);
        if (ledger != null) ledger.record("PAYMENT_RECEIVED", "PAYMENT_TRANSACTION", String.valueOf(payment.getId()),
                FinancialLedgerEntry.Direction.DEBIT, payment.getAmount(), actor, payment.getOccurredAt(), "DEPOSIT");

        com.hospitality.mis.entity.billing.Receipt receipt = new com.hospitality.mis.entity.billing.Receipt();
        receipt.setReceiptNumber("DEP-" + reservation.getId()); receipt.setInvoice(invoice); receipt.setAmount(deposit);
        receipt.setMethod(payment.getMethod()); receipt.setIssuedAt(payment.getOccurredAt()); receipt.setIssuedBy(actor);
        Receipt persistedReceipt = receipts.save(receipt);
        if (persistedReceipt == null) persistedReceipt = receipt;
        if (ledger != null) ledger.record("RECEIPT_ISSUED", "RECEIPT", String.valueOf(persistedReceipt.getId()),
                FinancialLedgerEntry.Direction.DEBIT, persistedReceipt.getAmount(), actor, persistedReceipt.getIssuedAt(), persistedReceipt.getMethod().name());
        audit.record(actor, "DEPOSIT_PAYMENT_RECORDED", "PAYMENT_TRANSACTION", String.valueOf(payment.getId()), null,
                deposit.toPlainString(), "DEPOSIT_RECEIPT:" + receipt.getReceiptNumber());
    }

    /** Hoàn tiền cọc khi hủy đúng hạn; yêu cầu phê duyệt và không lặp lại theo reservation. */
    @Transactional
    public void settleCancellationDeposit(Reservation reservation, String actor, boolean late) {
        if (late || reservation.getDepositAmount() == null || reservation.getDepositAmount().signum() == 0) return;
        String boundActor = requireActor(actor); Invoice invoice = invoices.findByReservationId(reservation.getId()).orElse(null);
        if (invoice == null) return; requireScope(reservation, boundActor);
        String key = "CANCELLATION_DEPOSIT:" + reservation.getId();
        if (!transactions.findByIdempotencyKeyPrefix(key + ".").isEmpty()) return;
        PaymentTransaction source = depositPayments(invoice).stream().findFirst()
                .orElseThrow(() -> error("DEPOSIT_PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch tiền cọc"));
        String approvalPayload = "CANCELLATION_DEPOSIT:" + invoice.getId() + ":" + source.getId();
        approvals.requireApproved("DEPOSIT_REFUND", String.valueOf(invoice.getId()), approvalPayload,
                source.getAmount(), boundActor);
        PaymentTransaction refund = refundFor(invoice, source, source.getAmount(),
                "CANCELLATION_DEPOSIT:" + reservation.getId(), key, boundActor);
        approvals.consumeApproved("DEPOSIT_REFUND", String.valueOf(invoice.getId()), approvalPayload,
                source.getAmount(), boundActor);
        reconcile(invoice);
        audit.record(boundActor, "DEPOSIT_REFUNDED_ON_CANCELLATION", "PAYMENT_TRANSACTION", String.valueOf(refund.getId()),
                source.getAmount().toPlainString(), "0", sourceReference(source));
    }

    /** Lấy hóa đơn theo đặt phòng sau khi kiểm tra phạm vi actor. */
    @Transactional(readOnly = true)
    public InvoiceDtos.Response getByReservation(Long id) {
        Invoice invoice = invoices.findByReservationId(id)
                .orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice.getReservation(), SecurityActor.currentActor());
        return toResponse(invoice);
    }

    /** Hoàn toàn bộ tiền cọc với phê duyệt bắt buộc và khóa lặp lại theo hóa đơn. */
    @Transactional
    public InvoiceDtos.Response refundDeposit(Long reservationId, String actor) {
        String boundActor = requireActor(actor);
        Invoice invoice = invoices.findByReservationId(reservationId)
                .orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice.getReservation(), boundActor);
        String key = "DEPOSIT_REFUND:" + invoice.getId();
        var existing = transactions.findByIdempotencyKeyPrefix(key + ".");
        if (!existing.isEmpty()) return toResponse(existing.get(0).getInvoice());
        PaymentTransaction source = depositPayments(invoice).stream().findFirst()
                .orElseThrow(() -> error("DEPOSIT_ALREADY_REFUNDED", "Tiền cọc đã được hoàn hoặc chưa được ghi nhận"));
        String approvalPayload = "DEPOSIT_REFUND:" + invoice.getId() + ":" + source.getId();
        approvals.requireApproved("DEPOSIT_REFUND", String.valueOf(invoice.getId()),
                approvalPayload, source.getAmount(), boundActor);
        PaymentTransaction refund = refundFor(invoice, source, source.getAmount(), "DEPOSIT_REFUND", key, boundActor);
        approvals.consumeApproved("DEPOSIT_REFUND", String.valueOf(invoice.getId()),
                approvalPayload, source.getAmount(), boundActor);
        reconcile(invoice);
        audit.record(boundActor, "DEPOSIT_REFUNDED", "PAYMENT_TRANSACTION", String.valueOf(refund.getId()),
                source.getAmount().toPlainString(), "0", sourceReference(source));
        return toResponse(invoice);
    }

    /** Ghi điều chỉnh tăng/giảm hóa đơn, yêu cầu phê duyệt và lưu dấu idempotency. */
    @Transactional
    public InvoiceDtos.Response adjust(Long id, BigDecimal delta, String reason, String actor, String idempotencyKey) {
        String boundActor = requireActor(actor);
        if (delta == null || delta.signum() == 0 || reason == null || reason.isBlank())
            throw error("INVALID_ADJUSTMENT", "Điều chỉnh phải có số tiền khác 0 và lý do");
        String key = com.hospitality.mis.service.reservation.IdempotencySupport.requireKey(idempotencyKey);
        if (key.length() > 35) throw error("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key không được vượt quá 35 ký tự");
        Invoice invoice = invoices.findForUpdate(id).orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice.getReservation(), boundActor);
        String payload = "delta=" + delta.stripTrailingZeros().toPlainString() + "|reason=" + reason.trim();
        String storedKey = key + "." + ApprovalService.fingerprintFor(id + "|" + boundActor + "|" + payload);
        var prior = adjustments.findByIdempotencyKeyStartingWith(key + ".");
        if (!prior.isEmpty()) {
            if (!prior.get(0).getIdempotencyKey().equals(storedKey))
                throw error("IDEMPOTENCY_MISMATCH", "Idempotency-Key đã được dùng cho điều chỉnh khác");
            return toResponse(invoice);
        }
        BigDecimal before = invoiceChargeTotal(invoice);
        if (before.add(delta).signum() < 0)
            throw error("ADJUSTMENT_EXCEEDS_TOTAL", "Điều chỉnh giảm không được làm tổng hóa đơn âm");
        approvals.requireApproved("BILLING_ADJUSTMENT", String.valueOf(id), payload, delta.abs(), boundActor);
        InvoiceAdjustment adjustment = new InvoiceAdjustment(); adjustment.setInvoice(invoice); adjustment.setDelta(delta);
        adjustment.setReason(reason.trim()); adjustment.setActorId(boundActor); adjustment.setOccurredAt(LocalDateTime.now(clock));
        adjustment.setIdempotencyKey(storedKey); adjustments.saveAndFlush(adjustment);
        invoice.setAdjustmentTotal(invoice.getAdjustmentTotal().add(delta));
        reconcile(invoice);
        approvals.consumeApproved("BILLING_ADJUSTMENT", String.valueOf(id), payload, delta.abs(), boundActor);
        if (ledger != null) ledger.record("INVOICE_ADJUSTMENT", "INVOICE_ADJUSTMENT", String.valueOf(adjustment.getId()),
                delta.signum() > 0 ? FinancialLedgerEntry.Direction.CREDIT : FinancialLedgerEntry.Direction.DEBIT,
                delta.abs(), boundActor, adjustment.getOccurredAt(), reason.trim());
        audit.record(boundActor, "INVOICE_ADJUSTED", "INVOICE", String.valueOf(id), before.toPlainString(),
                invoiceChargeTotal(invoice).toPlainString(), reason.trim(), key);
        return toResponse(invoice);
    }

    /** Tạo giao dịch hoàn tiền liên kết với giao dịch thanh toán gốc. */
    private PaymentTransaction refundFor(Invoice invoice, PaymentTransaction source, BigDecimal amount,
                                         String reference, String idempotencyKey, String actor) {
        PaymentTransaction refund = new PaymentTransaction(); refund.setInvoice(invoice); refund.setAmount(amount);
        refund.setMethod(source.getMethod()); refund.setType(PaymentTransaction.TransactionType.REFUND);
        refund.setStatus(PaymentTransaction.TransactionStatus.COMPLETED);
        refund.setReference("REFUND_OF:" + source.getId() + ":" + reference); refund.setOccurredAt(LocalDateTime.now(clock));
        refund.setActorId(actor); refund.setIdempotencyKey(PaymentTransaction.storageIdempotencyKey(idempotencyKey, actor,
                amount, source.getMethod(), PaymentTransaction.TransactionType.REFUND, refund.getReference()));
        PaymentTransaction saved = transactions.saveAndFlush(refund);
        if (ledger != null) ledger.record("REFUND_ISSUED", "PAYMENT_TRANSACTION", String.valueOf(saved.getId()),
                FinancialLedgerEntry.Direction.CREDIT, saved.getAmount(), actor, saved.getOccurredAt(), reference);
        return saved;
    }

    /** Tìm các khoản cọc còn số dư hoàn được theo thứ tự thời gian. */
    private List<PaymentTransaction> depositPayments(Invoice invoice) {
        return transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED).stream()
                .filter(x -> x.getType() == PaymentTransaction.TransactionType.PAYMENT && x.getReference() != null
                        && x.getReference().startsWith("DEPOSIT:"))
                .filter(x -> remainingFor(x, invoice).signum() > 0)
                .sorted(Comparator.comparing(PaymentTransaction::getOccurredAt)).toList();
    }

    /** Tính phần còn lại của một khoản thanh toán sau các refund liên quan. */
    private BigDecimal remainingFor(PaymentTransaction source, Invoice invoice) {
        BigDecimal refunded = transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED).stream()
                .filter(x -> x.getType() == PaymentTransaction.TransactionType.REFUND && x.getReference() != null
                        && x.getReference().startsWith("REFUND_OF:" + source.getId() + ":"))
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return source.getAmount().subtract(refunded);
    }

    /** Đồng bộ tổng tiền, số dư, tiền cọc và trạng thái hóa đơn từ sổ giao dịch. */
    private void reconcile(Invoice invoice) {
        BigDecimal total = invoiceChargeTotal(invoice); BigDecimal balance = payable(invoice, total);
        invoice.setDepositPaid(depositBalance(invoice)); invoice.setAmountDue(balance);
        if (total.signum() == 0 && invoice.getStatus() == PaymentStatus.DU_KIEN) invoice.setStatus(PaymentStatus.DU_KIEN);
        else invoice.setStatus(balance.signum() == 0 ? PaymentStatus.DA_THANH_TOAN : PaymentStatus.CHUA_THANH_TOAN);
        latestPayment(invoice).ifPresent(x -> invoice.setPaymentMethod(x.getMethod())); invoices.save(invoice);
    }

    /** Tính số dư phải thu sau thanh toán ròng, không cho kết quả âm. */
    private BigDecimal payable(Invoice invoice, BigDecimal total) {
        return total.subtract(netPaid(invoice)).max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /** Cộng payment và trừ refund đã completed của hóa đơn. */
    private BigDecimal netPaid(Invoice invoice) {
        var completed = transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED);
        BigDecimal payments = completed.stream().filter(x -> x.getType() == PaymentTransaction.TransactionType.PAYMENT)
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunds = completed.stream().filter(x -> x.getType() == PaymentTransaction.TransactionType.REFUND)
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return payments.subtract(refunds);
    }

    /** Cộng phần còn lại của các giao dịch tiền cọc chưa hoàn. */
    private BigDecimal depositBalance(Invoice invoice) {
        return depositPayments(invoice).stream().map(x -> remainingFor(x, invoice)).reduce(BigDecimal.ZERO, BigDecimal::add).max(BigDecimal.ZERO);
    }

    /** Tính tổng charge sau giảm giá và điều chỉnh của hóa đơn. */
    private BigDecimal invoiceChargeTotal(Invoice invoice) {
        return pricing.roundFinalTotal(invoice.getRoomTotal().add(invoice.getServiceTotal()).add(invoice.getSurcharge())
                .add(invoice.getCompensation()).add(invoice.getExtensionFee()).add(invoice.getAdjustmentTotal())
                .subtract(invoice.getDiscount()).max(BigDecimal.ZERO));
    }

    /** Lấy giao dịch completed mới nhất để đồng bộ phương thức thanh toán. */
    private java.util.Optional<PaymentTransaction> latestPayment(Invoice invoice) {
        return transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED).stream()
                .filter(x -> x.getType() == PaymentTransaction.TransactionType.PAYMENT)
                .max(Comparator.comparing(PaymentTransaction::getOccurredAt));
    }

    /** Chuyển hóa đơn và các thành phần charge thành DTO công khai. */
    private InvoiceDtos.Response toResponse(Invoice invoice) {
        BigDecimal total = invoiceChargeTotal(invoice); BigDecimal balance = payable(invoice, total);
        PaymentStatus status = total.signum() == 0 && invoice.getStatus() == PaymentStatus.DU_KIEN ? PaymentStatus.DU_KIEN
                : balance.signum() == 0 ? PaymentStatus.DA_THANH_TOAN : PaymentStatus.CHUA_THANH_TOAN;
        return new InvoiceDtos.Response(invoice.getId(), invoice.getReservation().getId(), invoice.getIssuedAt(),
                invoice.getRoomTotal(), invoice.getServiceTotal(), invoice.getSurcharge(), invoice.getCompensation(),
                invoice.getExtensionFee(), invoice.getAdjustmentTotal(), invoice.getDiscount(), depositBalance(invoice), balance,
                latestPayment(invoice).map(PaymentTransaction::getMethod).orElse(invoice.getPaymentMethod()), status);
    }

    /** Bắt buộc actor truyền vào khớp principal trước mutation tài chính. */
    private String requireActor(String actor) { return SecurityActor.requireBoundActor(actor); }

    /** Kiểm tra actor là nhân viên sở hữu booking hoặc role toàn cục được phép. */
    private void requireScope(Reservation reservation, String actor) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean global = auth != null && auth.getAuthorities().stream().map(x -> x.getAuthority())
                .anyMatch(x -> x.equals("ROLE_ADMIN") || x.equals("ROLE_DIRECTOR") || x.equals("ROLE_MANAGER") || x.equals("ROLE_ACCOUNTING") || x.equals("ROLE_FRONT_DESK"));
        if (reservation == null) throw new AccessDeniedException("Thiếu phạm vi đặt phòng");
        // Booking online chưa có employee owner; chỉ staff có quyền toàn cục được xử lý tiếp.
        if (reservation.getEmployee() == null) {
            if (!global) throw new AccessDeniedException("Thiếu phạm vi đặt phòng");
            return;
        }
        if (!global && !actor.equals(reservation.getEmployee().getEmployeeId()))
            throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }

    @Transactional(readOnly = true)
    public InvoiceDtos.PageResponse list(int page, int size) {
        var result = invoices.findAll(org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)), org.springframework.data.domain.Sort.by("issuedAt").descending()));
        return new InvoiceDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public InvoiceDtos.PageResponse list(PaymentStatus status, Long reservationId, java.time.LocalDate from,
                                         java.time.LocalDate to, int page, int size) {
        int safeSize = Math.max(1, Math.min(100, size));
        var result = invoices.search(status, reservationId, from == null ? null : from.atStartOfDay(),
                to == null ? null : to.plusDays(1).atStartOfDay(),
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize,
                        org.springframework.data.domain.Sort.by("issuedAt").descending()));
        return new InvoiceDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    /** Tạo mã tham chiếu mô tả refund bắt nguồn từ payment nào. */
    private String sourceReference(PaymentTransaction source) { return "REFUND_OF:" + source.getId(); }
    /** Tạo DomainException thống nhất cho các lỗi billing. */
    private DomainException error(String code, String message) { return new DomainException(code, message); }
}
