package com.hospitality.mis.controller.finance;

import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.finance.FinanceService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Điều phối các nghiệp vụ tài chính: bàn giao quỹ, chi phí và công nợ đối tác.
 */
@RestController
@RequestMapping("/api/finance")
public class FinanceController {
    /** Dịch vụ ghi nhận và tra cứu các sổ liệu tài chính; controller truyền tên người xác thực khi nghiệp vụ yêu cầu. */
    private final FinanceService service;
    public FinanceController(FinanceService service) { this.service = service; }
    /**
     * Ghi nhận bàn giao tiền mặt qua POST /api/finance/cash-handovers.
     * Body được {@code @Valid} kiểm tra, actor lấy từ security context và response là bản ghi bàn giao.
     * Chỉ CASH_HANDOVER_WRITE được phép; quyền này không mở rộng sang chi phí hay công nợ.
     * Idempotency-Key bắt buộc cho retry/double-click.
     */
    @PostMapping("/cash-handovers") @PreAuthorize("@departmentAccess.allows(authentication, 'CASH_HANDOVER_WRITE')") public FinanceDtos.CashHandoverResponse handover(@Valid @RequestBody FinanceDtos.CashHandoverRequest request, @RequestHeader("Idempotency-Key") String key) { return service.handover(request, SecurityActor.currentActor(), key); }
    /**
     * Lễ tân đọc lại các biên bản mà chính mình đã giao hoặc nhận, không mở quyền xem sổ tài chính chung.
     */
    @GetMapping("/cash-handovers/mine") @PreAuthorize("@departmentAccess.allows(authentication, 'CASH_HANDOVER_WRITE')")
    public FinanceDtos.PageResponse<FinanceDtos.CashHandoverResponse> myHandovers(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size) {
        return service.pageHandovers(null, SecurityActor.currentActor(), null, null, page, size);
    }
    /**
     * Ghi nhận chi phí qua POST /api/finance/expenses; body chi phí được {@code @Valid} kiểm tra và actor lấy từ security context.
     * Trả bản ghi chi phí, chỉ FINANCE_WRITE được gọi; Idempotency-Key bắt buộc.
     */
    @PostMapping("/expenses") @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')") public FinanceDtos.ExpenseResponse expense(@Valid @RequestBody FinanceDtos.ExpenseRequest request, @RequestHeader("Idempotency-Key") String key) { return service.recordExpense(request, SecurityActor.currentActor(), key); }
    /**
     * Ghi nhận công nợ đối tác qua POST /api/finance/partner-debts; body được {@code @Valid} kiểm tra và actor lấy từ security context.
     * Trả công nợ đã tạo, chỉ FINANCE_WRITE được phép; Idempotency-Key bắt buộc.
     */
    @PostMapping("/partner-debts") @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')") public FinanceDtos.PartnerDebtResponse debt(@Valid @RequestBody FinanceDtos.PartnerDebtRequest request, @RequestHeader("Idempotency-Key") String key) { return service.recordDebt(request, SecurityActor.currentActor(), key); }
    /**
     * Liệt kê bàn giao tiền mặt qua GET /api/finance/cash-handovers; không có tham số, trả danh sách để đối soát.
     * Chỉ FINANCE_READ được phép; lỗi truy vấn do dịch vụ xử lý và thao tác đọc không cần idempotency.
     */
    @GetMapping("/cash-handovers") @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')") public Object handovers(@RequestParam(name = "shiftCode", required = false) String shiftCode, @RequestParam(name = "actor", required = false) String actor, @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from, @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to, @RequestParam(name = "page", required = false) Integer page, @RequestParam(name = "size", required = false) Integer size) { return shiftCode == null && actor == null && from == null && to == null && page == null && size == null ? service.listHandovers() : service.pageHandovers(shiftCode, actor, from, to, page == null ? 0 : page, size == null ? 20 : size); }
    /**
     * Liệt kê chi phí qua GET /api/finance/expenses; không có tham số và trả danh sách chi phí.
     * Chỉ FINANCE_READ được phép; lỗi truy vấn do dịch vụ xử lý, không có idempotency concern.
     */
    @GetMapping("/expenses") @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')") public Object expenses(@RequestParam(name = "category", required = false) String category, @RequestParam(name = "status", required = false) com.hospitality.mis.entity.finance.Expense.ExpenseStatus status, @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from, @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to, @RequestParam(name = "page", required = false) Integer page, @RequestParam(name = "size", required = false) Integer size) { return category == null && status == null && from == null && to == null && page == null && size == null ? service.listExpenses() : service.pageExpenses(category, status, from, to, page == null ? 0 : page, size == null ? 20 : size); }
    /**
     * Liệt kê công nợ đối tác qua GET /api/finance/partner-debts; không có tham số và trả danh sách công nợ.
     * Chỉ FINANCE_READ được phép; lỗi truy vấn do dịch vụ xử lý, không có idempotency concern.
     */
    @GetMapping("/partner-debts") @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')") public Object debts(@RequestParam(name = "partner", required = false) String partner, @RequestParam(name = "status", required = false) com.hospitality.mis.entity.finance.PartnerDebt.DebtStatus status, @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from, @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to, @RequestParam(name = "page", required = false) Integer page, @RequestParam(name = "size", required = false) Integer size) { return partner == null && status == null && from == null && to == null && page == null && size == null ? service.listDebts() : service.pageDebts(partner, status, from, to, page == null ? 0 : page, size == null ? 20 : size); }

    @PostMapping("/partner-debts/{id}/settle")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')")
    public FinanceDtos.PartnerDebtResponse settle(@PathVariable Long id, @Valid @RequestBody FinanceDtos.DebtSettlementRequest request,
                                                  @RequestHeader("Idempotency-Key") String key) { return service.settleDebt(id, request, SecurityActor.currentActor(), key); }

    @GetMapping("/partner-debts/{id}/settlements")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public java.util.List<FinanceDtos.DebtSettlementResponse> settlements(@PathVariable Long id) { return service.debtSettlementHistory(id); }

    @GetMapping("/ledger")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public FinanceDtos.PageResponse<FinanceDtos.LedgerEntryResponse> ledger(@RequestParam(name = "entry_type", required = false) String entryType,
            @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return service.ledger(entryType, from, to, page, size);
    }

    @GetMapping("/reconciliation")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public FinanceDtos.ReconciliationResponse reconciliation(
            @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) { return service.reconcile(from, to); }
}
