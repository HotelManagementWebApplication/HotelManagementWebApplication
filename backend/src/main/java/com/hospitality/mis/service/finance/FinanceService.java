package com.hospitality.mis.service.finance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.finance.FinanceDatabase;
import com.hospitality.mis.dao.billing.PaymentReportingDatabase;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.*;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class FinanceService {
    private final FinanceDatabase database;
    private final DurableIdempotencyService idempotency;
    private final PaymentReportingDatabase transactions;
    private final Clock clock;
    public FinanceService(FinanceDatabase database,DurableIdempotencyService idempotency,PaymentReportingDatabase transactions,Clock clock){this.database=database;this.idempotency=idempotency;this.transactions=transactions;this.clock=clock;}
    @Transactional
    public FinanceDtos.CashHandoverResponse handover(FinanceDtos.CashHandoverRequest request,String actor,String idempotencyKey){
        validateHandover(request);String principal=SecurityActor.requireBoundActor(actor);String key=IdempotencySupport.requireKey(idempotencyKey);
        String hash=IdempotencySupport.fingerprint("CASH_HANDOVER|"+request.shiftCode().trim()+"|"+request.fromActor().trim()+"|"+request.toActor().trim()+"|"+money(request.actualAmount())+"|"+text(request.note()));
        return idempotency.execute("finance-cash-handover",key,principal,hash,FinanceDtos.CashHandoverResponse.class,()->{
            if(!principal.equals(request.fromActor().trim()))throw new DomainException("ACTOR_MISMATCH","from_actor phải là actor đã xác thực");
            if(request.denominations()!=null)for(var line:request.denominations())if(line==null||line.denomination()==null||line.denomination().signum()<=0||line.quantity()<=0)throw new DomainException("INVALID_DENOMINATION","Mệnh giá và số lượng tiền phải lớn hơn 0");
            return database.handover(request,principal,key,LocalDateTime.now(clock));
        });
    }
    @Transactional
    public FinanceDtos.ExpenseResponse recordExpense(FinanceDtos.ExpenseRequest request,String actor,String idempotencyKey){
        validateExpense(request);String principal=SecurityActor.requireBoundActor(actor);String key=IdempotencySupport.requireKey(idempotencyKey);
        String hash=IdempotencySupport.fingerprint("EXPENSE|"+request.category().trim()+"|"+request.description().trim()+"|"+money(request.amount()));
        return idempotency.execute("finance-expense",key,principal,hash,FinanceDtos.ExpenseResponse.class,()->database.expense(request,principal,key,LocalDateTime.now(clock)));
    }
    @Transactional
    public FinanceDtos.PartnerDebtResponse recordDebt(FinanceDtos.PartnerDebtRequest request,String actor,String idempotencyKey){
        validateDebt(request);String principal=SecurityActor.requireBoundActor(actor);String key=IdempotencySupport.requireKey(idempotencyKey);
        String hash=IdempotencySupport.fingerprint("PARTNER_DEBT|"+request.partnerName().trim()+"|"+request.referenceCode().trim()+"|"+money(request.amount()));
        return idempotency.execute("finance-partner-debt",key,principal,hash,FinanceDtos.PartnerDebtResponse.class,()->database.debt(request,principal,key,LocalDateTime.now(clock)));
    }
    @Transactional
    public FinanceDtos.PartnerDebtResponse settleDebt(Long id,FinanceDtos.DebtSettlementRequest request,String actor,String idempotencyKey){
        validateSettlement(id,request);String principal=SecurityActor.requireBoundActor(actor);String key=IdempotencySupport.requireKey(idempotencyKey);
        String hash=IdempotencySupport.fingerprint("PARTNER_DEBT_SETTLEMENT|"+id+"|"+money(request.amount())+"|"+text(request.note()));
        return idempotency.execute("finance-partner-debt-settlement",key,principal,hash,FinanceDtos.PartnerDebtResponse.class,()->database.settle(id,request,principal,key,LocalDateTime.now(clock)));
    }
    @Transactional(readOnly=true) public List<FinanceDtos.CashHandoverResponse> listHandovers(){return database.handovers();}
    @Transactional(readOnly=true) public List<FinanceDtos.ExpenseResponse> listExpenses(){return database.expenses();}
    @Transactional(readOnly=true) public List<FinanceDtos.PartnerDebtResponse> listDebts(){return database.debts();}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.CashHandoverResponse> pageHandovers(int page,int size){return pageHandovers(null,null,null,null,page,size);}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.CashHandoverResponse> pageHandovers(String shift,String actor,LocalDate from,LocalDate to,int page,int size){validateDateRange(from,to);return response(database.handovers(blankToNull(shift),blankToNull(actor),startOfDay(from),afterEndOfDay(to),Math.max(0,page),safeSize(size)));}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.ExpenseResponse> pageExpenses(int page,int size){return pageExpenses(null,null,null,null,page,size);}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.ExpenseResponse> pageExpenses(String category,Expense.ExpenseStatus status,LocalDate from,LocalDate to,int page,int size){validateDateRange(from,to);return response(database.expenses(blankToNull(category),status,startOfDay(from),afterEndOfDay(to),Math.max(0,page),safeSize(size)));}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.PartnerDebtResponse> pageDebts(int page,int size){return pageDebts(null,null,null,null,page,size);}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.PartnerDebtResponse> pageDebts(String partner,PartnerDebt.DebtStatus status,LocalDate from,LocalDate to,int page,int size){validateDateRange(from,to);return response(database.debts(blankToNull(partner),status,startOfDay(from),afterEndOfDay(to),Math.max(0,page),safeSize(size)));}
    @Transactional(readOnly=true) public List<FinanceDtos.DebtSettlementResponse> debtSettlementHistory(Long id){return database.settlements(id);}
    @Transactional(readOnly=true) public FinanceDtos.PageResponse<FinanceDtos.LedgerEntryResponse> ledger(String type,LocalDate from,LocalDate to,int page,int size){validateDateRange(from,to);return response(database.ledger(blankToNull(type),startOfDay(from),afterEndOfDay(to),Math.max(0,page),safeSize(size)));}
    private static <T> FinanceDtos.PageResponse<T> response(Page<T> page){return new FinanceDtos.PageResponse<>(page.getContent(),page.getNumber(),page.getSize(),page.getTotalElements(),page.getTotalPages());}
    private static int safeSize(int size){return Math.max(1,Math.min(100,size));}
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
        for (PaymentReportingDatabase.Total row : transactions.summarize(fromAt, toAt)) {
            BigDecimal amount = row.amount() == null ? BigDecimal.ZERO : row.amount();
            BigDecimal signed = row.type() == PaymentTransaction.TransactionType.REFUND ? amount.negate() : amount;
            totals.merge(row.method().name(), signed, BigDecimal::add);
            if (row.type() == PaymentTransaction.TransactionType.REFUND) refunds = refunds.add(amount);
            else payments = payments.add(amount);
        }
        BigDecimal revenue = signedLedgerTotal("REVENUE_RECOGNIZED", fromAt, toAt, true);
        BigDecimal variance = signedLedgerTotal("CASH_VARIANCE", fromAt, toAt, false);
        BigDecimal outstandingDebt = database.outstandingDebt();
        if (outstandingDebt == null) outstandingDebt = BigDecimal.ZERO;
        return new FinanceDtos.ReconciliationResponse(start, end, totals, payments, refunds,
                payments.subtract(refunds), revenue, outstandingDebt, variance,transactions.completedCount(fromAt,toAt),transactions.pendingBankTransfers());
    }


    private BigDecimal signedLedgerTotal(String type,LocalDateTime from,LocalDateTime to,boolean creditPositive){
        return database.ledgerTotals(type,from,to).stream().map(row->creditPositive==(row.direction()==FinancialLedgerEntry.Direction.CREDIT)?row.amount():row.amount().negate()).reduce(BigDecimal.ZERO,BigDecimal::add);
    }
    private static void validateHandover(FinanceDtos.CashHandoverRequest request) {
        if (request == null || blank(request.shiftCode()) || blank(request.fromActor()) || blank(request.toActor())
                || request.actualAmount() == null)
            throw new DomainException("INVALID_HANDOVER", "Bàn giao phải có ca, actor và số tiền");
        try {
            new com.hospitality.mis.persistence.VietnameseCodeConverters.ShiftCodeConverter()
                    .convertToDatabaseColumn(request.shiftCode().trim());
        } catch (IllegalArgumentException ex) {
            throw new DomainException("INVALID_HANDOVER_SHIFT", "Mã ca bàn giao không hợp lệ");
        }
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
