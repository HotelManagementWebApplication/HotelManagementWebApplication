package com.hospitality.mis.controller.finance;

import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.dto.billing.ReceiptDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import com.hospitality.mis.service.billing.ReceiptService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

/** Global paged finance queries; invoice-scoped mutation APIs remain unchanged. */
@RestController
@RequestMapping("/api/finance")
public class FinancialTransactionQueryController {
    private final PaymentTransactionService payments;
    private final ReceiptService receipts;
    public FinancialTransactionQueryController(PaymentTransactionService payments, ReceiptService receipts) {
        this.payments = payments; this.receipts = receipts;
    }

    @GetMapping("/payments")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public PaymentTransactionDtos.LedgerPageResponse payments(
            @RequestParam(name = "invoice_id", required = false) Long invoiceId,
            @RequestParam(name = "method", required = false) PaymentMethod method,
            @RequestParam(name = "type", required = false) PaymentTransaction.TransactionType type,
            @RequestParam(name = "status", required = false) PaymentTransaction.TransactionStatus status,
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return payments.search(invoiceId, method, type, status, from, to, search, page, size);
    }

    @GetMapping("/receipts")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public ReceiptDtos.PageResponse receipts(
            @RequestParam(name = "invoice_id", required = false) Long invoiceId,
            @RequestParam(name = "method", required = false) PaymentMethod method,
            @RequestParam(name = "issued_by", required = false) String issuedBy,
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return receipts.search(invoiceId, method, issuedBy, from, to, page, size);
    }
}
