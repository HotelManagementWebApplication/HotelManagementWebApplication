package com.hospitality.mis.service.finance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.finance.CashShiftHandoverRepository;
import com.hospitality.mis.dao.finance.ExpenseRepository;
import com.hospitality.mis.dao.finance.PartnerDebtRepository;
import com.hospitality.mis.dao.finance.PartnerDebtSettlementRepository;
import com.hospitality.mis.dao.finance.FinancialLedgerEntryRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.CashShiftHandover;
import com.hospitality.mis.entity.finance.CashHandoverDenomination;
import com.hospitality.mis.entity.finance.Expense;
import com.hospitality.mis.entity.finance.PartnerDebt;
import com.hospitality.mis.entity.finance.PartnerDebtSettlement;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import org.springframework.stereotype.Service;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import com.hospitality.mis.entity.billing.PaymentTransaction;

/** Ghi nhận bàn giao ca, chi phí và công nợ đối tác, kèm audit tài chính. */
@Service
public class FinanceService {
    /** Các kho sổ ca, chi phí và công nợ; giao dịch ghi được bao bọc bởi @Transactional. */
    private final CashShiftHandoverRepository handovers; private final ExpenseRepository expenses; private final PartnerDebtRepository debts;
    /** Audit người thực hiện và giá trị tài chính thay đổi. */
    private final AuditService audit;
    /** Tính tiền mặt ròng của actor giữa hai thời điểm bàn giao. */
    private final PaymentTransactionRepository transactions;
    private PartnerDebtSettlementRepository debtSettlements;
    private FinancialLedgerEntryRepository ledger;
    private DurableIdempotencyService durableIdempotency;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    @org.springframework.beans.factory.annotation.Autowired
    public FinanceService(CashShiftHandoverRepository handovers, ExpenseRepository expenses, PartnerDebtRepository debts,
                          AuditService audit, PaymentTransactionRepository transactions) {
        this.handovers = handovers; this.expenses = expenses; this.debts = debts; this.audit = audit; this.transactions = transactions;
    }
    public FinanceService(CashShiftHandoverRepository handovers, ExpenseRepository expenses, PartnerDebtRepository debts, AuditService audit) {
        this(handovers, expenses, debts, audit, null);
    }
    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }
    @org.springframework.beans.factory.annotation.Autowired
    void setP1FinanceRepositories(PartnerDebtSettlementRepository debtSettlements,
                                  FinancialLedgerEntryRepository ledger) {
        this.debtSettlements = debtSettlements; this.ledger = ledger;
    }
    @org.springframework.beans.factory.annotation.Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) {
        this.durableIdempotency = durableIdempotency;
    }

    /** Tính tiền mặt kỳ ca trước, kiểm tra actor và lưu chênh lệch bàn giao. */
    @Transactional
    public FinanceDtos.CashHandoverResponse handover(FinanceDtos.CashHandoverRequest request, String actor,
                                                      String idempotencyKey) {
        validateHandover(request);
        String boundActor = SecurityActor.requireBoundActor(actor);
        String key = IdempotencySupport.requireKey(idempotencyKey);
        String fingerprint = IdempotencySupport.fingerprint("CASH_HANDOVER|" + request.shiftCode().trim()
                + "|" + request.fromActor().trim() + "|" + request.toActor().trim()
                + "|" + money(request.actualAmount()) + "|" + text(request.note()));
        if (durableIdempotency != null) {
            return durableIdempotency.execute("finance-cash-handover", key, boundActor, fingerprint,
                    FinanceDtos.CashHandoverResponse.class, () -> handoverOnce(request, boundActor, key));
        }
        return handoverOnce(request, boundActor, key);
    }

    private FinanceDtos.CashHandoverResponse handoverOnce(FinanceDtos.CashHandoverRequest request,
                                                          String actor, String idempotencyKey) {
        if (!actor.equals(request.fromActor().trim()))
            throw new DomainException("ACTOR_MISMATCH", "from_actor phải là actor đã xác thực");
        LocalDateTime handedOverAt = LocalDateTime.now(clock);
        LocalDateTime fromAt = handovers.findFirstByFromActorOrderByHandedOverAtDesc(actor)
                .map(CashShiftHandover::getHandedOverAt).orElse(LocalDateTime.of(1970, 1, 1, 0, 0));
        BigDecimal expected = transactions.netCashByActorBetween(actor, fromAt, handedOverAt);
        if (expected == null) expected = BigDecimal.ZERO;
        CashShiftHandover h = new CashShiftHandover(); h.setShiftCode(request.shiftCode().trim());
        h.setFromActor(request.fromActor().trim()); h.setToActor(request.toActor().trim());
        h.setExpectedAmount(expected); h.setActualAmount(request.actualAmount()); h.setVariance(request.actualAmount().subtract(expected));
        h.setHandedOverAt(handedOverAt); h.setNote(request.note());
        if (request.denominations() != null) {
            for (var line : request.denominations()) {
                if (line == null || line.denomination() == null || line.denomination().signum() <= 0 || line.quantity() <= 0)
                    throw new DomainException("INVALID_DENOMINATION", "Mệnh giá và số lượng tiền phải lớn hơn 0");
                var denomination = new CashHandoverDenomination();
                denomination.setDenomination(line.denomination()); denomination.setQuantity(line.quantity());
                denomination.setAmount(line.denomination().multiply(BigDecimal.valueOf(line.quantity())));
                h.addDenomination(denomination);
            }
        }
        h = handovers.save(h);
        if (h.getVariance().signum() != 0) appendLedger("CASH_VARIANCE", "CASH_HANDOVER", String.valueOf(h.getId()),
                h.getVariance().signum() > 0 ? FinancialLedgerEntry.Direction.DEBIT : FinancialLedgerEntry.Direction.CREDIT,
                h.getVariance().abs(), actor, handedOverAt, request.note());
        audit.record(actor, "CASH_HANDOVER_RECORDED", "CASH_HANDOVER", String.valueOf(h.getId()), null,
                h.getActualAmount().toPlainString(), request.note(), idempotencyKey);
        return toResponse(h);
    }

    /** Ghi một khoản chi với actor đã thực hiện và thời điểm phát sinh. */
    @Transactional
    public FinanceDtos.ExpenseResponse recordExpense(FinanceDtos.ExpenseRequest request, String actor,
                                                      String idempotencyKey) {
        validateExpense(request);
        String boundActor = SecurityActor.requireBoundActor(actor);
        String key = IdempotencySupport.requireKey(idempotencyKey);
        String fingerprint = IdempotencySupport.fingerprint("EXPENSE|" + request.category().trim()
                + "|" + request.description().trim() + "|" + money(request.amount()));
        if (durableIdempotency != null) {
            return durableIdempotency.execute("finance-expense", key, boundActor, fingerprint,
                    FinanceDtos.ExpenseResponse.class, () -> recordExpenseOnce(request, boundActor, key));
        }
        return recordExpenseOnce(request, boundActor, key);
    }

    private FinanceDtos.ExpenseResponse recordExpenseOnce(FinanceDtos.ExpenseRequest request, String actor,
                                                            String idempotencyKey) {
        Expense e = new Expense(); e.setCategory(request.category().trim()); e.setDescription(request.description().trim());
        e.setAmount(request.amount()); e.setPaidBy(actor); e.setPaidAt(LocalDateTime.now(clock));
        e = expenses.save(e);
        appendLedger("EXPENSE", "EXPENSE", String.valueOf(e.getId()), FinancialLedgerEntry.Direction.DEBIT,
                e.getAmount(), actor, e.getPaidAt(), e.getDescription());
        audit.record(actor, "EXPENSE_RECORDED", "EXPENSE", String.valueOf(e.getId()), null,
                e.getAmount().toPlainString(), null, idempotencyKey);
        return toResponse(e);
    }

    /** Ghi công nợ đối tác với mã tham chiếu duy nhất và số đã thanh toán bằng không. */
    @Transactional
    public FinanceDtos.PartnerDebtResponse recordDebt(FinanceDtos.PartnerDebtRequest request, String actor,
                                                       String idempotencyKey) {
        validateDebt(request);
        String boundActor = SecurityActor.requireBoundActor(actor);
        String key = IdempotencySupport.requireKey(idempotencyKey);
        String fingerprint = IdempotencySupport.fingerprint("PARTNER_DEBT|" + request.partnerName().trim()
                + "|" + request.referenceCode().trim() + "|" + money(request.amount()));
        if (durableIdempotency != null) {
            return durableIdempotency.execute("finance-partner-debt", key, boundActor, fingerprint,
                    FinanceDtos.PartnerDebtResponse.class, () -> recordDebtOnce(request, boundActor, key));
        }
        return recordDebtOnce(request, boundActor, key);
    }

    private FinanceDtos.PartnerDebtResponse recordDebtOnce(FinanceDtos.PartnerDebtRequest request, String actor,
                                                            String idempotencyKey) {
        if (debts.findByReferenceCode(request.referenceCode().trim()).isPresent()) throw new DomainException("PARTNER_DEBT_EXISTS", "Mã công nợ đã tồn tại");
        PartnerDebt d = new PartnerDebt(); d.setPartnerName(request.partnerName().trim()); d.setReferenceCode(request.referenceCode().trim());
        d.setAmount(request.amount()); d.setSettledAmount(BigDecimal.ZERO); d.setStatus(PartnerDebt.DebtStatus.OPEN);
        d.setRecordedAt(LocalDateTime.now(clock));
        d = debts.save(d);
        appendLedger("PARTNER_DEBT_RECORDED", "PARTNER_DEBT", String.valueOf(d.getId()),
                FinancialLedgerEntry.Direction.CREDIT, d.getAmount(), actor, d.getRecordedAt(), d.getReferenceCode());
        audit.record(actor, "PARTNER_DEBT_RECORDED", "PARTNER_DEBT", String.valueOf(d.getId()), null,
                d.getAmount().toPlainString(), null, idempotencyKey);
        return toResponse(d);
    }

    @Transactional(readOnly = true)
    /** Liệt kê bàn giao ca mới nhất trước. */
    public java.util.List<FinanceDtos.CashHandoverResponse> listHandovers() { return handovers.findAllByOrderByHandedOverAtDesc().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true)
    /** Liệt kê chi phí theo thời điểm thanh toán giảm dần. */
    public java.util.List<FinanceDtos.ExpenseResponse> listExpenses() { return expenses.findAllByOrderByPaidAtDesc().stream().map(this::toResponse).toList(); }
    @Transactional(readOnly = true)
    /** Liệt kê công nợ đối tác theo thời điểm ghi nhận giảm dần. */
    public java.util.List<FinanceDtos.PartnerDebtResponse> listDebts() { return debts.findAllByOrderByRecordedAtDesc().stream().map(this::toResponse).toList(); }

    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.CashHandoverResponse> pageHandovers(int page, int size) {
        var result = handovers.findAll(org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("handedOverAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.CashHandoverResponse> pageHandovers(String shiftCode, String actor,
                                                                                    LocalDate from, LocalDate to,
                                                                                    int page, int size) {
        validateDateRange(from, to);
        var result = handovers.search(blankToNull(shiftCode), blankToNull(actor), startOfDay(from), afterEndOfDay(to),
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("handedOverAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.ExpenseResponse> pageExpenses(int page, int size) {
        var result = expenses.findAll(org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("paidAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.ExpenseResponse> pageExpenses(String category, Expense.ExpenseStatus status,
                                                                               LocalDate from, LocalDate to, int page, int size) {
        validateDateRange(from, to);
        var result = expenses.search(blankToNull(category), status, startOfDay(from), afterEndOfDay(to),
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("paidAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.PartnerDebtResponse> pageDebts(int page, int size) {
        var result = debts.findAll(org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("recordedAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.PartnerDebtResponse> pageDebts(String partner, PartnerDebt.DebtStatus status,
                                                                               LocalDate from, LocalDate to, int page, int size) {
        validateDateRange(from, to);
        var result = debts.search(blankToNull(partner), status, startOfDay(from), afterEndOfDay(to),
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("recordedAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }
    private int safeSize(int size) { return Math.max(1, Math.min(100, size)); }

    @Transactional
    public FinanceDtos.PartnerDebtResponse settleDebt(Long id, FinanceDtos.DebtSettlementRequest request, String actor,
                                                       String idempotencyKey) {
        validateSettlement(id, request);
        String boundActor = SecurityActor.requireBoundActor(actor);
        String key = IdempotencySupport.requireKey(idempotencyKey);
        String fingerprint = IdempotencySupport.fingerprint("PARTNER_DEBT_SETTLEMENT|" + id
                + "|" + money(request.amount()) + "|" + text(request.note()));
        if (durableIdempotency != null) {
            return durableIdempotency.execute("finance-partner-debt-settlement", key, boundActor,
                    fingerprint, FinanceDtos.PartnerDebtResponse.class,
                    () -> settleDebtOnce(id, request, boundActor, key));
        }
        return settleDebtOnce(id, request, boundActor, key);
    }

    private FinanceDtos.PartnerDebtResponse settleDebtOnce(Long id, FinanceDtos.DebtSettlementRequest request,
                                                            String actor, String idempotencyKey) {
        var debt = debts.findForUpdate(id).orElseThrow(() -> new DomainException("PARTNER_DEBT_NOT_FOUND", "Không tìm thấy công nợ đối tác"));
        if (debt.getStatus() == PartnerDebt.DebtStatus.VOIDED || debt.getStatus() == PartnerDebt.DebtStatus.SETTLED)
            throw new DomainException("INVALID_DEBT_STATE", "Công nợ không còn số dư để tất toán");
        BigDecimal settledAmount = debt.getSettledAmount() == null ? BigDecimal.ZERO : debt.getSettledAmount();
        if (settledAmount.add(request.amount()).compareTo(debt.getAmount()) > 0)
            throw new DomainException("INVALID_DEBT_SETTLEMENT", "Số tiền tất toán vượt số dư công nợ");
        debt.setSettledAmount(settledAmount.add(request.amount()));
        debt.setStatus(debt.getSettledAmount().compareTo(debt.getAmount()) == 0
                ? PartnerDebt.DebtStatus.SETTLED : PartnerDebt.DebtStatus.PARTIALLY_SETTLED);
        LocalDateTime settledAt = LocalDateTime.now(clock);
        PartnerDebtSettlement settlement = new PartnerDebtSettlement(); settlement.setPartnerDebt(debt);
        settlement.setAmount(request.amount()); settlement.setSettledBy(actor); settlement.setSettledAt(settledAt);
        settlement.setNote(request.note()); debtSettlements.save(settlement);
        appendLedger("PARTNER_DEBT_SETTLEMENT", "PARTNER_DEBT", String.valueOf(id),
                FinancialLedgerEntry.Direction.DEBIT, request.amount(), actor, settledAt, request.note());
        audit.record(actor, "PARTNER_DEBT_SETTLED", "PARTNER_DEBT", String.valueOf(id), null,
                request.amount().toPlainString(), request.note(), idempotencyKey);
        return toResponse(debt);
    }

    @Transactional(readOnly = true)
    public java.util.List<FinanceDtos.DebtSettlementResponse> debtSettlementHistory(Long debtId) {
        if (!debts.existsById(debtId)) throw new DomainException("PARTNER_DEBT_NOT_FOUND", "Không tìm thấy công nợ đối tác");
        return debtSettlements.findByPartnerDebtIdOrderBySettledAtAscIdAsc(debtId).stream().map(x ->
                new FinanceDtos.DebtSettlementResponse(x.getId(), debtId, x.getAmount(), x.getSettledBy(), x.getSettledAt(), x.getNote())).toList();
    }

    @Transactional(readOnly = true)
    public FinanceDtos.PageResponse<FinanceDtos.LedgerEntryResponse> ledger(String entryType, LocalDate from, LocalDate to,
                                                                            int page, int size) {
        validateDateRange(from, to);
        var result = ledger.search(blankToNull(entryType), startOfDay(from), afterEndOfDay(to),
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), safeSize(size), org.springframework.data.domain.Sort.by("occurredAt").descending()));
        return new FinanceDtos.PageResponse<>(result.getContent().stream().map(this::toResponse).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public FinanceDtos.ReconciliationResponse reconcile(LocalDate from, LocalDate to) {
        LocalDate start = from == null ? LocalDate.now(clock).minusDays(1) : from;
        LocalDate end = to == null ? LocalDate.now(clock) : to;
        validateDateRange(start, end);
        LocalDateTime fromAt = start.atStartOfDay();
        LocalDateTime toAt = end.plusDays(1).atStartOfDay();
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        BigDecimal payments = BigDecimal.ZERO;
        BigDecimal refunds = BigDecimal.ZERO;
        for (PaymentTransactionRepository.ReconciliationTotal row : transactions.summarize(
                PaymentTransaction.TransactionStatus.COMPLETED, fromAt, toAt)) {
            BigDecimal amount = row.getAmount() == null ? BigDecimal.ZERO : row.getAmount();
            BigDecimal signed = row.getType() == PaymentTransaction.TransactionType.REFUND ? amount.negate() : amount;
            totals.merge(row.getMethod().name(), signed, BigDecimal::add);
            if (row.getType() == PaymentTransaction.TransactionType.REFUND) refunds = refunds.add(amount);
            else payments = payments.add(amount);
        }
        BigDecimal revenue = signedLedgerTotal("REVENUE_RECOGNIZED", fromAt, toAt, true);
        BigDecimal variance = signedLedgerTotal("CASH_VARIANCE", fromAt, toAt, false);
        BigDecimal outstandingDebt = debts.outstandingAmount();
        if (outstandingDebt == null) outstandingDebt = BigDecimal.ZERO;
        return new FinanceDtos.ReconciliationResponse(start, end, totals, payments, refunds,
                payments.subtract(refunds), revenue, outstandingDebt, variance);
    }

    /** Đọc tổng ledger theo chiều tại DB, không tải finalized entries vào bộ nhớ. */
    private BigDecimal signedLedgerTotal(String entryType, LocalDateTime fromAt, LocalDateTime toAt, boolean creditPositive) {
        if (ledger == null) return BigDecimal.ZERO;
        return ledger.summarize(entryType, fromAt, toAt).stream().map(row ->
                (creditPositive == (row.getDirection() == FinancialLedgerEntry.Direction.CREDIT))
                        ? row.getAmount() : row.getAmount().negate())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Chuyển bản ghi bàn giao ca thành DTO. */
    private FinanceDtos.CashHandoverResponse toResponse(CashShiftHandover h) { return new FinanceDtos.CashHandoverResponse(h.getId(), h.getShiftCode(), h.getFromActor(), h.getToActor(), h.getExpectedAmount(), h.getActualAmount(), h.getVariance(), h.getHandedOverAt(), h.getNote(), h.getDenominations().stream().map(d -> new FinanceDtos.DenominationLine(d.getDenomination(), d.getQuantity())).toList()); }
    /** Chuyển bản ghi chi phí thành DTO. */
    private FinanceDtos.ExpenseResponse toResponse(Expense e) { return new FinanceDtos.ExpenseResponse(e.getId(), e.getCategory(), e.getDescription(), e.getAmount(), e.getPaidBy(), e.getPaidAt(), e.getStatus()); }
    /** Chuyển bản ghi công nợ thành DTO. */
    private FinanceDtos.PartnerDebtResponse toResponse(PartnerDebt d) { return new FinanceDtos.PartnerDebtResponse(d.getId(), d.getPartnerName(), d.getReferenceCode(), d.getAmount(), d.getSettledAmount(), d.getStatus(), d.getRecordedAt()); }
    private FinanceDtos.LedgerEntryResponse toResponse(FinancialLedgerEntry e) { return new FinanceDtos.LedgerEntryResponse(e.getId(), e.getEntryType(), e.getSourceType(), e.getSourceId(), e.getDirection().name(), e.getAmount(), e.getActorId(), e.getOccurredAt(), e.getNote(), e.isFinalized()); }
    private void appendLedger(String entryType, String sourceType, String sourceId, FinancialLedgerEntry.Direction direction,
                              BigDecimal amount, String actor, LocalDateTime occurredAt, String note) {
        if (ledger == null) return;
        FinancialLedgerEntry e = new FinancialLedgerEntry(); e.setEntryType(entryType); e.setSourceType(sourceType);
        e.setSourceId(sourceId); e.setDirection(direction); e.setAmount(amount); e.setActorId(actor);
        e.setOccurredAt(occurredAt); e.setNote(note); ledger.save(e);
    }
    private static void validateHandover(FinanceDtos.CashHandoverRequest request) {
        if (request == null || blank(request.shiftCode()) || blank(request.fromActor()) || blank(request.toActor())
                || request.actualAmount() == null)
            throw new DomainException("INVALID_HANDOVER", "Bàn giao phải có ca, actor và số tiền");
        if (request.actualAmount().signum() < 0)
            throw new DomainException("INVALID_HANDOVER_AMOUNT", "Số tiền bàn giao không thể âm");
        if (request.fromActor().trim().equals(request.toActor().trim()))
            throw new DomainException("INVALID_HANDOVER_ACTORS", "Người giao và người nhận ca phải khác nhau");
        if (request.denominations() != null && !request.denominations().isEmpty()) {
            BigDecimal denominationTotal = request.denominations().stream()
                    .filter(line -> line != null && line.denomination() != null && line.quantity() > 0)
                    .map(line -> line.denomination().multiply(BigDecimal.valueOf(line.quantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (denominationTotal.compareTo(request.actualAmount()) != 0)
                throw new DomainException("DENOMINATION_TOTAL_MISMATCH", "Tổng chi tiết mệnh giá phải bằng số tiền thực tế");
        }
    }
    private static void validateExpense(FinanceDtos.ExpenseRequest request) {
        if (request == null || blank(request.category()) || blank(request.description()) || request.amount() == null)
            throw new DomainException("INVALID_EXPENSE", "Chi phí phải có nhóm, mô tả và số tiền");
        if (request.amount().signum() <= 0)
            throw new DomainException("INVALID_EXPENSE_AMOUNT", "Số tiền chi phí phải lớn hơn không");
    }
    private static void validateDebt(FinanceDtos.PartnerDebtRequest request) {
        if (request == null || blank(request.partnerName()) || blank(request.referenceCode()) || request.amount() == null)
            throw new DomainException("INVALID_PARTNER_DEBT", "Công nợ phải có đối tác, mã tham chiếu và số tiền");
        if (request.amount().signum() <= 0)
            throw new DomainException("INVALID_PARTNER_DEBT_AMOUNT", "Số tiền công nợ phải lớn hơn không");
    }
    private static void validateSettlement(Long id, FinanceDtos.DebtSettlementRequest request) {
        if (id == null || request == null || request.amount() == null || request.amount().signum() <= 0)
            throw new DomainException("INVALID_DEBT_SETTLEMENT", "Số tiền tất toán phải lớn hơn không");
    }
    private static void validateDateRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to))
            throw new DomainException("INVALID_DATE_RANGE", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String text(String value) { return value == null ? "" : value.trim(); }
    private static String money(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static LocalDateTime startOfDay(LocalDate date) { return date == null ? null : date.atStartOfDay(); }
    private static LocalDateTime afterEndOfDay(LocalDate date) { return date == null ? null : date.plusDays(1).atStartOfDay(); }
}
