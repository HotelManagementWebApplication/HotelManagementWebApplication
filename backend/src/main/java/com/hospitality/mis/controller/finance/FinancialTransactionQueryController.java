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
    public PaymentTransactionDtos.PageResponse payments(
            @RequestParam(name = "invoice_id", required = false) Long invoiceId,
            @RequestParam(required = false) PaymentMethod method,
            @RequestParam(required = false) PaymentTransaction.TransactionType type,
            @RequestParam(required = false) PaymentTransaction.TransactionStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return payments.search(invoiceId, method, type, status, from, to, page, size);
    }

    @GetMapping("/receipts")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public ReceiptDtos.PageResponse receipts(
            @RequestParam(name = "invoice_id", required = false) Long invoiceId,
            @RequestParam(required = false) PaymentMethod method,
            @RequestParam(name = "issued_by", required = false) String issuedBy,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return receipts.search(invoiceId, method, issuedBy, from, to, page, size);
    }
}
