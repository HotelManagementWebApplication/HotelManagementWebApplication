package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.billing.ReceiptRepository;
import com.hospitality.mis.dto.billing.ReceiptDtos;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.billing.Receipt;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.List;
import com.hospitality.mis.service.finance.FinancialLedgerService;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;

/** Phát hành và tra cứu biên lai dựa trên số tiền thanh toán chưa lập biên lai. */
@Service
public class ReceiptService {
    /** Lưu số biên lai và số tiền đã phát hành. */
    private final ReceiptRepository receipts;
    /** Khóa hóa đơn trong lúc phát hành để tránh vượt số tiền thu. */
    private final InvoiceRepository invoices;
    /** Đối chiếu số tiền thu/hoàn làm cơ sở giới hạn biên lai. */
    private final PaymentTransactionRepository transactions;
    /** Ghi audit người phát hành và tender tương ứng. */
    private final AuditService audit;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    private DurableIdempotencyService durableIdempotency;
    private FinancialLedgerService ledger;

    public ReceiptService(ReceiptRepository receipts, InvoiceRepository invoices,
                          PaymentTransactionRepository transactions, AuditService audit) {
        this.receipts = receipts; this.invoices = invoices; this.transactions = transactions; this.audit = audit;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }
    @org.springframework.beans.factory.annotation.Autowired
    void setFinancialLedger(FinancialLedgerService ledger) { this.ledger = ledger; }

    @org.springframework.beans.factory.annotation.Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) { this.durableIdempotency = durableIdempotency; }

    /** Phát hành biên lai nếu số tiền chưa vượt phần thanh toán còn lại theo phương thức. */
    @Transactional
    public ReceiptDtos.Response issue(Long invoiceId, ReceiptDtos.CreateRequest request, String actor) {
        return issue(invoiceId, request, actor, null);
    }

    @Transactional
    public ReceiptDtos.Response issue(Long invoiceId, ReceiptDtos.CreateRequest request, String actor, String key) {
        if (request == null || request.receiptNumber() == null || request.receiptNumber().isBlank()
                || request.amount() == null || request.amount().signum() <= 0 || request.method() == null)
            throw new DomainException("INVALID_RECEIPT", "Biên lai phải có số, số tiền và phương thức");
        String boundActor = SecurityActor.requireBoundActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("RECEIPT|" + invoiceId + "|" + request.receiptNumber().trim()
                + "|" + request.amount() + "|" + request.method());
        if (durableIdempotency != null) {
            return durableIdempotency.execute("receipt-issue", key, boundActor, fingerprint,
                    ReceiptDtos.Response.class, () -> issueOnce(invoiceId, request, boundActor));
        }
        IdempotencySupport.requireKey(key);
        return issueOnce(invoiceId, request, boundActor);
    }

    private ReceiptDtos.Response issueOnce(Long invoiceId, ReceiptDtos.CreateRequest request, String boundActor) {
        if (receipts.findByReceiptNumber(request.receiptNumber()).isPresent())
            throw new DomainException("RECEIPT_EXISTS", "Số biên lai đã tồn tại");
        var invoice = invoices.findForUpdate(invoiceId)
                .orElseThrow(() -> new DomainException("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, boundActor);
        BigDecimal paid = transactions.netAmountByInvoiceAndMethod(invoiceId, request.method(),
                PaymentTransaction.TransactionType.PAYMENT, PaymentTransaction.TransactionStatus.COMPLETED);
        BigDecimal issued = receipts.sumAmountByInvoiceAndMethod(invoiceId, request.method());
        if (paid == null) paid = BigDecimal.ZERO;
        if (issued == null) issued = BigDecimal.ZERO;
        if (request.amount().compareTo(paid.subtract(issued)) > 0)
            throw new DomainException("RECEIPT_EXCEEDS_PAYMENT", "Biên lai vượt số tiền đã thu chưa lập biên lai");
        Receipt receipt = new Receipt(); receipt.setReceiptNumber(request.receiptNumber()); receipt.setInvoice(invoice);
        receipt.setAmount(request.amount()); receipt.setMethod(request.method()); receipt.setIssuedAt(LocalDateTime.now(clock));
        receipt.setIssuedBy(boundActor);
        Receipt saved = receipts.save(receipt);
        audit.record(boundActor, "RECEIPT_ISSUED", "RECEIPT", String.valueOf(saved.getId()), null,
                request.amount().toPlainString(), "TENDER:" + request.method().name());
        if (ledger != null) ledger.record("RECEIPT_ISSUED", "RECEIPT", String.valueOf(saved.getId()),
                FinancialLedgerEntry.Direction.DEBIT, saved.getAmount(), boundActor, saved.getIssuedAt(), saved.getMethod().name());
        return toResponse(saved);
    }

    /** Liệt kê biên lai theo hóa đơn sau khi kiểm tra phạm vi actor. */
    @Transactional(readOnly = true)
    public List<ReceiptDtos.Response> listByInvoice(Long invoiceId) {
        var invoice = invoices.findById(invoiceId)
                .orElseThrow(() -> new DomainException("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, SecurityActor.currentActor());
        return receipts.findByInvoiceIdOrderByIssuedAtAsc(invoiceId).stream().map(this::toResponse).toList();
    }
    @Transactional(readOnly = true)
    public ReceiptDtos.PageResponse pageByInvoice(Long invoiceId, int page, int size) {
        var invoice = invoices.findById(invoiceId)
                .orElseThrow(() -> new DomainException("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        requireScope(invoice, SecurityActor.currentActor());
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(100, size));
        var result = receipts.findByInvoiceIdOrderByIssuedAtAsc(invoiceId,
                org.springframework.data.domain.PageRequest.of(safePage, safeSize));
        return new ReceiptDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ReceiptDtos.PageResponse search(Long invoiceId, com.hospitality.mis.entity.billing.PaymentMethod method,
                                           String issuedBy, java.time.LocalDate from, java.time.LocalDate to,
                                           int page, int size) {
        int safePage = Math.max(0, page), safeSize = Math.max(1, Math.min(100, size));
        String actor = issuedBy == null || issuedBy.isBlank() ? null : issuedBy.trim();
        var result = receipts.search(invoiceId, method, actor, from == null ? null : from.atStartOfDay(),
                to == null ? null : to.plusDays(1).atStartOfDay(),
                org.springframework.data.domain.PageRequest.of(safePage, safeSize,
                        org.springframework.data.domain.Sort.by("issuedAt").descending()));
        return new ReceiptDtos.PageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    /** Kiểm tra actor có phạm vi trên booking của hóa đơn hoặc role toàn cục. */
    private void requireScope(com.hospitality.mis.entity.billing.Invoice invoice, String actor) {
        var reservation = invoice.getReservation();
        if (reservation == null || reservation.getEmployee() == null) throw new AccessDeniedException("Thiếu phạm vi đặt phòng");
        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean global = auth != null && auth.getAuthorities().stream().map(x -> x.getAuthority())
                .anyMatch(x -> x.equals("ROLE_ADMIN") || x.equals("ROLE_DIRECTOR") || x.equals("ROLE_MANAGER") || x.equals("ROLE_ACCOUNTING") || x.equals("ROLE_FRONT_DESK"));
        if (!global && !actor.equals(reservation.getEmployee().getEmployeeId()))
            throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }

    /** Chuyển biên lai persistence thành DTO. */
    private ReceiptDtos.Response toResponse(Receipt r) {
        return new ReceiptDtos.Response(r.getId(), r.getReceiptNumber(), r.getInvoice().getId(), r.getAmount(),
                r.getMethod(), r.getIssuedAt(), r.getIssuedBy());
    }
}
