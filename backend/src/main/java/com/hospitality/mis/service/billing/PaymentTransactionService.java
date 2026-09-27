package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.billing.PaymentStatus;
import com.hospitality.mis.entity.billing.PaymentTransaction;
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

/** Ghi nhận và truy vấn giao dịch thu/hoàn tiền của một hóa đơn. */
@Service
public class PaymentTransactionService {
    /** Sổ giao dịch; request có idempotency key được kiểm tra ngay trên repository. */
    private final PaymentTransactionRepository transactions;
    /** Khóa hóa đơn để tính số dư nhất quán khi thu hoặc hoàn tiền. */
    private final InvoiceRepository invoices;
    /** Phê duyệt bắt buộc đối với giao dịch refund. */
    private final ApprovalService approvals;
    /** Audit actor, loại giao dịch, số tiền và mã tham chiếu. */
    private final AuditService audit;
    /** Làm tròn tổng hóa đơn theo chính sách tiền tệ của hệ thống. */
    private final PricingPolicy pricing;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    private FinancialLedgerService ledger;

    public PaymentTransactionService(PaymentTransactionRepository transactions, InvoiceRepository invoices,
                                     ApprovalService approvals, AuditService audit, PricingPolicy pricing) {
        this.transactions = transactions; this.invoices = invoices; this.approvals = approvals; this.audit = audit;
        this.pricing = pricing;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }
    @org.springframework.beans.factory.annotation.Autowired
    void setFinancialLedger(FinancialLedgerService ledger) { this.ledger = ledger; }

    /** Ghi một khoản thu hoặc hoàn tiền, kiểm tra phạm vi, số dư, phê duyệt và idempotency. */
    @Transactional
    public PaymentTransactionDtos.Response record(Long invoiceId, PaymentTransactionDtos.CreateRequest request,
                                                  String actor, String idempotencyKey) {
        if (request == null || request.amount() == null || request.amount().signum() <= 0 || request.method() == null
                || request.type() == null) throw error("INVALID_TRANSACTION", "Giao dịch phải có số tiền, phương thức và loại");
        String boundActor = SecurityActor.requireBoundActor(actor);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.trim().length() > 35)
            throw error("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key phải có từ 1 đến 35 ký tự");
        Invoice invoice = invoices.findForUpdate(invoiceId)
                .orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, boundActor);

        String key = idempotencyKey.trim();
        if (!key.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,34}"))
            throw error("IDEMPOTENCY_KEY_INVALID", "Idempotency-Key chứa ký tự không hợp lệ");
        String canonicalReference = "invoice:" + invoiceId + "|reference:"
                + (request.reference() == null ? "" : request.reference());
        String storedKey = PaymentTransaction.storageIdempotencyKey(key, boundActor, request.amount(), request.method(),
                request.type(), canonicalReference);
        if (key != null) {
            List<PaymentTransaction> prior = transactions.findByIdempotencyKeyPrefix(key + ".");
            if (!prior.isEmpty()) {
                PaymentTransaction found = prior.get(0);
                if (!invoiceId.equals(found.getInvoice().getId()) || !storedKey.equals(found.getStoredIdempotencyKey()))
                    throw error("IDEMPOTENCY_MISMATCH", "Idempotency key đã được dùng cho payload khác");
                return toResponse(found);
            }
        }

        boolean needsApproval = request.type() == PaymentTransaction.TransactionType.REFUND;
        if (needsApproval && (request.reference() == null || request.reference().isBlank()))
            throw error("REFUND_REASON_REQUIRED", "Refund phải có lý do");
        // Liên kết việc phê duyệt với đúng yêu cầu, bao gồm khóa retry, số tiền và mã tham chiếu.
        String approvalPayload = request.approvalPayload(invoiceId, key);
        if (needsApproval)
            approvals.requireApproved("PAYMENT_REFUND", String.valueOf(invoiceId), approvalPayload, request.amount(), boundActor);
        BigDecimal total = pricing.roundFinalTotal(invoice.getRoomTotal().add(invoice.getServiceTotal()).add(invoice.getSurcharge())
                .add(invoice.getCompensation()).add(invoice.getExtensionFee()).add(invoice.getAdjustmentTotal())
                .subtract(invoice.getDiscount()).max(BigDecimal.ZERO));
        BigDecimal netPaid = netPaid(invoice);
        PaymentTransaction source = null;
        if (request.type() == PaymentTransaction.TransactionType.PAYMENT) {
            if (request.amount().compareTo(total.subtract(netPaid).max(BigDecimal.ZERO)) > 0)
                throw error("PAYMENT_EXCEEDS_BALANCE", "Số tiền thu vượt số dư hóa đơn");
        } else {
            if (request.amount().compareTo(netPaid) > 0)
                throw error("REFUND_EXCEEDS_PAID", "Số tiền hoàn vượt số tiền đã thu");
            source = sourceForRefund(invoice, request.amount());
        }

        PaymentTransaction tx = new PaymentTransaction(); tx.setInvoice(invoice); tx.setAmount(request.amount());
        tx.setMethod(source == null ? request.method() : source.getMethod()); tx.setType(request.type());
        tx.setStatus(PaymentTransaction.TransactionStatus.COMPLETED); tx.setOccurredAt(LocalDateTime.now(clock));
        tx.setActorId(boundActor); tx.setIdempotencyKey(storedKey);
        tx.setReference(source == null ? request.reference() : "REFUND_OF:" + source.getId() + ":"
                + (request.reference() == null || request.reference().isBlank() ? "PAYMENT_REFUND" : request.reference()));
        PaymentTransaction saved = transactions.saveAndFlush(tx);
        reconcile(invoice);
        if (needsApproval)
            approvals.consumeApproved("PAYMENT_REFUND", String.valueOf(invoiceId), approvalPayload, request.amount(), boundActor);
        audit.record(boundActor, request.type() == PaymentTransaction.TransactionType.PAYMENT
                        ? "PAYMENT_RECORDED" : "PAYMENT_REFUNDED", "PAYMENT_TRANSACTION", String.valueOf(saved.getId()),
                null, request.amount().toPlainString(), saved.getReference());
        if (ledger != null) ledger.record(request.type() == PaymentTransaction.TransactionType.PAYMENT ? "PAYMENT_RECEIVED" : "REFUND_ISSUED",
                "PAYMENT_TRANSACTION", String.valueOf(saved.getId()),
                request.type() == PaymentTransaction.TransactionType.PAYMENT ? FinancialLedgerEntry.Direction.DEBIT : FinancialLedgerEntry.Direction.CREDIT,
                saved.getAmount(), boundActor, saved.getOccurredAt(), saved.getMethod().name());
        return toResponse(saved);
    }

    /** Liệt kê giao dịch theo thứ tự phát sinh sau khi kiểm tra quyền trên hóa đơn. */
    @Transactional(readOnly = true)
    public List<PaymentTransactionDtos.Response> listByInvoice(Long invoiceId) {
        Invoice invoice = invoices.findById(invoiceId).orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, SecurityActor.currentActor());
        return transactions.findByInvoiceIdOrderByOccurredAtAscIdAsc(invoiceId).stream().map(this::toResponse).toList();
    }
    @Transactional(readOnly = true)
    public PaymentTransactionDtos.PageResponse pageByInvoice(Long invoiceId, int page, int size) {
        Invoice invoice = invoices.findById(invoiceId).orElseThrow(() -> error("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, SecurityActor.currentActor());
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(100, size));
        var result = transactions.findByInvoiceIdOrderByOccurredAtAscIdAsc(invoiceId,
                org.springframework.data.domain.PageRequest.of(safePage, safeSize));
        return new PaymentTransactionDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public PaymentTransactionDtos.PageResponse search(Long invoiceId,
                                                       com.hospitality.mis.entity.billing.PaymentMethod method,
                                                       PaymentTransaction.TransactionType type,
                                                       PaymentTransaction.TransactionStatus status,
                                                       java.time.LocalDate from, java.time.LocalDate to,
                                                       int page, int size) {
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(100, size));
        var result = transactions.search(invoiceId, method, type, status,
                from == null ? null : from.atStartOfDay(), to == null ? null : to.plusDays(1).atStartOfDay(),
                org.springframework.data.domain.PageRequest.of(safePage, safeSize,
                        org.springframework.data.domain.Sort.by("occurredAt").descending()));
        return new PaymentTransactionDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    /** Chọn khoản thanh toán gốc còn đủ số dư để làm nguồn refund. */
    private PaymentTransaction sourceForRefund(Invoice invoice, BigDecimal amount) {
        return transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED).stream()
                .filter(x -> x.getType() == PaymentTransaction.TransactionType.PAYMENT)
                .sorted(Comparator.comparing(PaymentTransaction::getOccurredAt))
                .filter(x -> remaining(x, invoice).compareTo(amount) >= 0)
                .findFirst().orElseThrow(() -> error("REFUND_SOURCE_NOT_FOUND", "Không tìm thấy giao dịch gốc để hoàn tiền"));
    }

    /** Tính số dư chưa hoàn của giao dịch thanh toán gốc. */
    private BigDecimal remaining(PaymentTransaction source, Invoice invoice) {
        BigDecimal refunded = transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED).stream()
                .filter(x -> x.getType() == PaymentTransaction.TransactionType.REFUND && x.getReference() != null
                        && x.getReference().startsWith("REFUND_OF:" + source.getId() + ":"))
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return source.getAmount().subtract(refunded);
    }

    /** Tính thanh toán ròng bằng payment trừ refund đã hoàn tất. */
    private BigDecimal netPaid(Invoice invoice) {
        var completed = transactions.findByInvoiceIdAndStatus(invoice.getId(), PaymentTransaction.TransactionStatus.COMPLETED);
        BigDecimal paid = completed.stream().filter(x -> x.getType() == PaymentTransaction.TransactionType.PAYMENT)
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = completed.stream().filter(x -> x.getType() == PaymentTransaction.TransactionType.REFUND)
                .map(PaymentTransaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return paid.subtract(refunded);
    }

    /** Tính lại amountDue và trạng thái hóa đơn sau mỗi giao dịch. */
    private void reconcile(Invoice invoice) {
        BigDecimal total = pricing.roundFinalTotal(invoice.getRoomTotal().add(invoice.getServiceTotal()).add(invoice.getSurcharge())
                .add(invoice.getCompensation()).add(invoice.getExtensionFee()).add(invoice.getAdjustmentTotal())
                .subtract(invoice.getDiscount()).max(BigDecimal.ZERO));
        BigDecimal balance = total.subtract(netPaid(invoice)).max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
        invoice.setAmountDue(balance);
        invoice.setStatus(total.signum() == 0 && invoice.getStatus() == PaymentStatus.DU_KIEN ? PaymentStatus.DU_KIEN
                : balance.signum() == 0 ? PaymentStatus.DA_THANH_TOAN : PaymentStatus.CHUA_THANH_TOAN);
        invoices.save(invoice);
    }

    /** Chỉ cho owner booking hoặc role tài chính/toàn cục thao tác hóa đơn. */
    private void requireScope(Invoice invoice, String actor) {
        var reservation = invoice.getReservation();
        if (reservation == null || reservation.getEmployee() == null) throw new AccessDeniedException("Thiếu phạm vi đặt phòng");
        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean global = auth != null && auth.getAuthorities().stream().map(x -> x.getAuthority())
                .anyMatch(x -> x.equals("ROLE_ADMIN") || x.equals("ROLE_DIRECTOR") || x.equals("ROLE_MANAGER") || x.equals("ROLE_ACCOUNTING") || x.equals("ROLE_FRONT_DESK"));
        if (!global && !actor.equals(reservation.getEmployee().getEmployeeId()))
            throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }

    /** Chuyển giao dịch persistence thành DTO không lộ dữ liệu nội bộ khác. */
    private PaymentTransactionDtos.Response toResponse(PaymentTransaction tx) {
        return new PaymentTransactionDtos.Response(tx.getId(), tx.getInvoice().getId(), tx.getAmount(), tx.getMethod(),
                tx.getType(), tx.getStatus(), tx.getReference(), tx.getOccurredAt(), tx.getActorId());
    }

    /** Tạo lỗi miền nhất quán cho validation giao dịch. */
    private DomainException error(String code, String message) { return new DomainException(code, message); }
}
