package com.hospitality.mis.finance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.*;
import com.hospitality.mis.service.finance.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerFinanceCommandsTest {
    private static final String ACTOR="FIN-cash";
    @Autowired FinanceService service;
    @Autowired com.hospitality.mis.dao.finance.FinanceDatabase database;
    @Autowired FinancialLedgerService ledger;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired com.hospitality.mis.service.governance.ApprovalService approvals;
    @Autowired com.hospitality.mis.service.billing.PaymentTransactionService paymentService;
    long invoice;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'FIN-next',N'Next cashier',N'unused',N'Kế toán',N'0999000101'),(N'FIN-owner',N'Next owner',N'unused',N'Kế toán',N'0999000102'),(N'FIN-cash',N'Current cashier',N'unused',N'Kế toán',N'0999000103')");
        var start=LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).withNano(0);
        int slot=0;
        for(String code:List.of("Ca sáng","Ca chiều","SHIFT-0","SHIFT-1","SHIFT-2")){
            var at=start.plusMinutes(3L*slot++);
            roster(ACTOR,code,at,at.plusMinutes(1));
            roster("FIN-next",code,at.plusMinutes(1),at.plusMinutes(2));
            roster("FIN-owner",code,at.plusMinutes(2),at.plusMinutes(3));
        }
        long guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Finance cutover',N'0909090782',N'FIN-GUEST')",Long.class);
        long reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru) OUTPUT INSERTED.maPhieuDatPhong VALUES(?)",Long.class,guest);
        invoice=jdbc.queryForObject("INSERT HoaDon(maPhieuDatPhong) OUTPUT INSERTED.maHoaDon VALUES(?)",Long.class,reservation);
        payment(1000000,"Thanh toán");payment(50000,"Hoàn tiền");actor();
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE ButToanTaiChinh WHERE maNguoiThucHien LIKE N'FIN-%' OR maNguon=N'FIN-SYSTEM'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'FIN-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'FIN-%'");
        jdbc.update("DELETE YeuCauPheDuyet WHERE nguoiYeuCau LIKE N'FIN-%'");
        jdbc.update("DELETE KhoanChi WHERE nguoiChiTra LIKE N'FIN-%'");
        jdbc.update("DELETE BanGiaoTienCa WHERE nguoiBanGiao LIKE N'FIN-%'");
        jdbc.update("DELETE ThanhToanCongNoDoiTac WHERE maCongNoDoiTac IN(SELECT maCongNoDoiTac FROM CongNoDoiTac WHERE maThamChieu LIKE N'FIN-%')");
        jdbc.update("DELETE CongNoDoiTac WHERE maThamChieu LIKE N'FIN-%'");
        jdbc.update("DELETE GiaoDichThanhToan WHERE maNguoiThucHien LIKE N'FIN-%'");
        jdbc.update("DELETE HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0909090782'))");
        jdbc.update("DELETE PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0909090782')");
        jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0909090782'");SecurityContextHolder.clearContext();
        jdbc.update("DELETE CaLamViecNhanVien WHERE maNhanVien IN(N'FIN-next',N'FIN-owner',N'FIN-cash')");
        jdbc.update("DELETE NhanVien WHERE maNhanVien IN(N'FIN-next',N'FIN-owner',N'FIN-cash')");
    }
    @Test void recipientsComeFromTheNextRosterAndAreRevalidatedOnSubmit(){
        var recipients=service.cashRecipients("MORNING");
        assertThat(recipients).extracting(FinanceDtos.CashRecipient::employeeId).containsExactly("FIN-next");
        assertThat(recipients.getFirst().role()).isEqualTo("Kế toán");
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-owner",money("950000"),null),ACTOR,"FIN-wrong-shift"),"INVALID_HANDOVER_RECIPIENT");
        jdbc.update("UPDATE CaLamViecNhanVien SET trangThai=N'Đã hủy' WHERE maNhanVien=N'FIN-next'");
        jdbc.update("UPDATE NhanVien SET vaiTro=N'Giám đốc' WHERE maNhanVien=N'FIN-owner'");
        assertThat(service.cashRecipients("MORNING")).isEmpty();
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-next",money("950000"),null),ACTOR,"FIN-cancelled-shift"),"INVALID_HANDOVER_RECIPIENT");
        assertThat(service.listHandovers()).isEmpty();
    }
    @Test void overnightHandoverFindsTheMorningRosterOnTheFollowingDay(){
        var day=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(2);
        var end=day.plusDays(1).atTime(6,0);
        roster(ACTOR,"Ca đêm",day.atTime(22,0),end);
        roster("FIN-next","Ca sáng",end,end.plusHours(8));
        var recipients=database.cashRecipients(ACTOR,"NIGHT",day.plusDays(1).atTime(5,55));
        assertThat(recipients).extracting(FinanceDtos.CashRecipient::employeeId).containsExactly("FIN-next");
        assertThat(recipients.getFirst().startsAt()).isEqualTo(end);
        assertThat(recipients.getFirst().shiftCode()).isEqualTo("MORNING");
    }
    @Test void handoverUsesNetUnhandedCashAndPostsCreditVarianceAndOrderedDenominations(){
        var request=new FinanceDtos.CashHandoverRequest("SHIFT-2",ACTOR,"FIN-next",money("940000"),"counted",List.of(new FinanceDtos.DenominationLine(money("500000"),1),new FinanceDtos.DenominationLine(money("220000"),2)));
        var result=service.handover(request,ACTOR,"FIN-handover");
        assertThat(result.expectedAmount()).isEqualByComparingTo("950000");assertThat(result.variance()).isEqualByComparingTo("-10000");
        assertThat(result.denominations()).extracting(FinanceDtos.DenominationLine::quantity).containsExactly(1,2);
        var entries=service.ledger("CASH_VARIANCE",null,null,0,20).items();
        assertThat(entries).singleElement().satisfies(row->{assertThat(row.direction()).isEqualTo("CREDIT");assertThat(row.amount()).isEqualByComparingTo("10000");assertThat(row.sourceId()).isEqualTo(result.id().toString());assertThat(row.finalized()).isTrue();});
        assertThat(service.handover(request,ACTOR,"FIN-handover")).isEqualTo(result);
        assertThat(service.listHandovers()).containsExactly(result);
    }
    @Test void secondPeriodDoesNotCountPreviouslyHandedCash(){
        service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-next",money("950000"),null),ACTOR,"FIN-first");
        var next=service.handover(new FinanceDtos.CashHandoverRequest("AFTERNOON",ACTOR,"FIN-next",money("0"),null),ACTOR,"FIN-second");
        assertThat(next.expectedAmount()).isEqualByComparingTo("0");assertThat(next.shiftCode()).isEqualTo("AFTERNOON");
        assertThat(service.ledger("CASH_VARIANCE",null,null,0,20).items()).isEmpty();
    }
    @Test void cashCustodyFlowsThroughRecipientExpensesAndSupplierSettlement(){
        service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-next",money("940000"),"short by 10000"),ACTOR,"FIN-custody-1");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-next","n/a","ROLE_ACCOUNTING"));
        assertThat(service.cashBalance().expectedAmount()).isEqualByComparingTo("940000");
        service.recordExpense(new FinanceDtos.ExpenseRequest("cash supplies","supplies",money("40000"),com.hospitality.mis.entity.billing.PaymentMethod.CASH),"FIN-next","FIN-cash-expense");
        service.recordExpense(new FinanceDtos.ExpenseRequest("bank supplies","supplies",money("40000"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),"FIN-next","FIN-bank-expense");
        var supplier=service.recordDebt(new FinanceDtos.PartnerDebtRequest("Supplier","FIN-custody-debt",money("100000")),"FIN-next","FIN-custody-debt");
        service.settleDebt(supplier.id(),new FinanceDtos.DebtSettlementRequest(money("100000"),"paid",com.hospitality.mis.entity.billing.PaymentMethod.CASH),"FIN-next","FIN-cash-settle");
        assertThat(service.cashBalance().expectedAmount()).isEqualByComparingTo("800000");
        var handed=service.handover(new FinanceDtos.CashHandoverRequest("AFTERNOON","FIN-next","FIN-owner",money("800000"),null),"FIN-next","FIN-custody-2");
        assertThat(handed.expectedAmount()).isEqualByComparingTo("800000");assertThat(handed.variance()).isZero();
        assertThat(service.cashBalance().expectedAmount()).isZero();
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("AFTERNOON","FIN-next","FIN-owner",BigDecimal.ZERO,null),"FIN-next","FIN-custody-duplicate"),"HANDOVER_ALREADY_RECORDED");
    }
    @Test void recipientAndChangedCashCountCannotBypassGuards(){
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"unknown",money("950000"),null),ACTOR,"FIN-bad-recipient"),"INVALID_HANDOVER_RECIPIENT");
        var request=new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-next",money("950000"),null,List.of(new FinanceDtos.DenominationLine(money("950000"),1)));
        service.handover(request,ACTOR,"FIN-count-key");
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("MORNING",ACTOR,"FIN-next",money("950000"),null,List.of(new FinanceDtos.DenominationLine(money("475000"),2))),ACTOR,"FIN-count-key"),"IDEMPOTENCY_KEY_CONFLICT");
    }
    @Test void denominationFailureAndActorMismatchDoNotPersistHandoverOrClaim(){
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("SHIFT-2",ACTOR,"FIN-next",money("100"),null,List.of(new FinanceDtos.DenominationLine(money("50"),1))),ACTOR,"FIN-bad-total"),"DENOMINATION_TOTAL_MISMATCH");
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("SHIFT-2",ACTOR,"FIN-next",money("0"),null,Arrays.asList((FinanceDtos.DenominationLine)null)),ACTOR,"FIN-bad-line"),"INVALID_DENOMINATION");
        code(()->service.handover(new FinanceDtos.CashHandoverRequest("SHIFT-2","other","FIN-next",money("0"),null),ACTOR,"FIN-bad-actor"),"ACTOR_MISMATCH");
        assertThat(service.listHandovers()).isEmpty();assertThat(count("BanGhiChongTrung","nguoiThucHien")).isZero();
    }
    @Test void expenseAppendsOneLedgerAndAuditAndDurableReplay(){
        var request=new FinanceDtos.ExpenseRequest("FIN-category","description",money("125.50"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER);
        var first=service.recordExpense(request,ACTOR,"FIN-expense");
        assertThat(service.recordExpense(request,ACTOR,"FIN-expense")).isEqualTo(first);
        assertThat(service.listExpenses()).containsExactly(first);
        assertThat(service.ledger("EXPENSE",null,null,0,20).items()).singleElement().satisfies(row->{assertThat(row.sourceId()).isEqualTo(first.id().toString());assertThat(row.direction()).isEqualTo("DEBIT");assertThat(row.amount()).isEqualByComparingTo("125.50");});
        code(()->service.recordExpense(new FinanceDtos.ExpenseRequest("FIN-category","description",money("126"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-expense"),"IDEMPOTENCY_KEY_CONFLICT");
        assertThat(count("NhatKyKiemSoat","nguoiThucHien")).isEqualTo(1);
    }
    @Test void expenseStorageFailureRollsBackAllWritesIncludingDurableClaim(){
        assertThatThrownBy(()->service.recordExpense(new FinanceDtos.ExpenseRequest("FIN-category","x".repeat(256),money("10"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-long")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(service.listExpenses()).isEmpty();assertThat(count("ButToanTaiChinh","maNguoiThucHien")).isZero();assertThat(count("BanGhiChongTrung","nguoiThucHien")).isZero();
    }
    @Test void debtSettlementPostsHistoryAndLedgerWithOneAtomicBalance(){
        var debt=debt();
        assertThat(service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("250"),"bank",com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-settle1").status()).isEqualTo(PartnerDebt.DebtStatus.PARTIALLY_SETTLED);
        var paid=service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("750"),"bank",com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-settle2");
        assertThat(paid.settledAmount()).isEqualByComparingTo("1000");assertThat(paid.status()).isEqualTo(PartnerDebt.DebtStatus.SETTLED);
        assertThat(service.debtSettlementHistory(debt.id())).extracting(FinanceDtos.DebtSettlementResponse::amount).usingComparatorForType(BigDecimal::compareTo,BigDecimal.class).containsExactly(money("250"),money("750"));
        assertThat(service.ledger("PARTNER_DEBT_SETTLEMENT",null,null,0,20).items()).hasSize(2).allMatch(row->row.finalized()&&row.direction().equals("DEBIT"));
        code(()->service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("1"),"bank",com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-again"),"INVALID_DEBT_STATE");
        code(()->service.recordDebt(new FinanceDtos.PartnerDebtRequest("supplier","FIN-ref",money("50")),ACTOR,"FIN-duplicate"),"PARTNER_DEBT_EXISTS");
    }
    @Test void oversizedMissingAndVoidedSettlementFailWithoutPartialHistory(){
        var debt=debt();code(()->service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("1001"),null,com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-over"),"INVALID_DEBT_SETTLEMENT");
        code(()->service.settleDebt(Long.MAX_VALUE,new FinanceDtos.DebtSettlementRequest(money("1"),null,com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-missing"),"PARTNER_DEBT_NOT_FOUND");
        jdbc.update("UPDATE CongNoDoiTac SET trangThai=N'Đã hủy' WHERE maCongNoDoiTac=?",debt.id());
        code(()->service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("1"),null,com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-void"),"INVALID_DEBT_STATE");
        assertThat(service.debtSettlementHistory(debt.id())).isEmpty();
    }
    @Test void outerRollbackRemovesDebtExpenseHistoryLedgerAuditAndClaims(){
        var debt=debt();int ledgerBefore=count("ButToanTaiChinh","maNguoiThucHien");
        new TransactionTemplate(manager).executeWithoutResult(tx->{service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("100"),"bank",com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-rollback");service.recordExpense(new FinanceDtos.ExpenseRequest("category","expense",money("10"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-rollback-expense");tx.setRollbackOnly();});
        assertThat(service.debtSettlementHistory(debt.id())).isEmpty();assertThat(service.listDebts()).singleElement().satisfies(row->assertThat(row.settledAmount()).isEqualByComparingTo("0"));
        assertThat(service.listExpenses()).isEmpty();assertThat(count("ButToanTaiChinh","maNguoiThucHien")).isEqualTo(ledgerBefore);
    }
    @Test void databaseFiltersPagingAndReconciliationKeepFinancialSigns(){
        service.recordExpense(new FinanceDtos.ExpenseRequest("FIN-category","expense",money("10"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-page-expense");debt();
        var day=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        new TransactionTemplate(manager).executeWithoutResult(tx->ledger.record("REVENUE_RECOGNIZED","TEST","FIN-revenue",FinancialLedgerEntry.Direction.CREDIT,money("500"),ACTOR,null,null));
        assertThat(service.pageExpenses("FIN-category",Expense.ExpenseStatus.RECORDED,day,day,0,1).totalElements()).isEqualTo(1);
        assertThat(service.pageDebts("SUPP",PartnerDebt.DebtStatus.OPEN,day,day,0,1).totalElements()).isEqualTo(1);
        var reconciliation=service.reconcile(day.minusDays(1),day);
        assertThat(reconciliation.netTotal()).isEqualByComparingTo("950000");assertThat(reconciliation.outstandingPartnerDebt()).isEqualByComparingTo("1000");assertThat(reconciliation.recognizedRevenue()).isEqualByComparingTo("500");
        code(()->service.reconcile(day.plusDays(1),day),"INVALID_DATE_RANGE");
    }
    @Test void ledgerAppendRequiresTransactionSupportsSystemActorAndSkipsNonpositiveAmounts(){
        assertThatThrownBy(()->ledger.record("TEST","TEST","FIN-SYSTEM",FinancialLedgerEntry.Direction.DEBIT,money("1"),null,null,null)).isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
        new TransactionTemplate(manager).executeWithoutResult(tx->{ledger.record("TEST","TEST","FIN-SYSTEM",FinancialLedgerEntry.Direction.DEBIT,money("5"),null,null,null);ledger.record("TEST","TEST","FIN-SYSTEM",FinancialLedgerEntry.Direction.DEBIT,BigDecimal.ZERO,null,null,null);});
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ButToanTaiChinh WHERE maNguon=N'FIN-SYSTEM'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT maNguoiThucHien FROM ButToanTaiChinh WHERE maNguon=N'FIN-SYSTEM'",String.class)).isEqualTo("SYSTEM");
    }
    @Test void concurrentSettlementCannotExceedTheOutstandingBalance()throws Exception{
        var debt=debt();var results=concurrent(index->{try{service.settleDebt(debt.id(),new FinanceDtos.DebtSettlementRequest(money("700"),null,com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-race-"+index);return "SUCCESS";}catch(DomainException error){return error.getCode();}});
        assertThat(results).containsExactlyInAnyOrder("SUCCESS","INVALID_DEBT_SETTLEMENT");assertThat(service.debtSettlementHistory(debt.id())).hasSize(1);
    }
    @Test void concurrentHandoversDoNotCountTheSameCashTwice()throws Exception{
        concurrent(index->service.handover(new FinanceDtos.CashHandoverRequest("SHIFT-"+index,ACTOR,"FIN-next",BigDecimal.ZERO,"race reconciliation"),ACTOR,"FIN-hand-race-"+index).id().toString());
        assertThat(service.listHandovers()).hasSize(2);
        assertThat(service.listHandovers().stream().map(FinanceDtos.CashHandoverResponse::expectedAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("950000");
    }
    @Test void largeExpenseWaitsForDirectorAndConsumesTheExactApprovalOnce(){
        var request=new FinanceDtos.ExpenseRequest("Maintenance","FIN-large expense",money("11000000"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER);
        code(()->service.recordExpense(request,ACTOR,"FIN-large"),"APPROVAL_REQUIRED");
        var approval=approvals.request(ACTOR,"BILLING_ADJUSTMENT",com.hospitality.mis.service.governance.ApprovalService.financialTarget("expense","FIN-large"),FinanceService.expenseApprovalPayload(request,"FIN-large"),request.amount(),"Chi bảo trì","FIN-approval");
        assertThat(service.listExpenses().stream().filter(row->ACTOR.equals(row.paidBy()))).isEmpty();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-next","n/a","ROLE_MANAGER"));
        code(()->approvals.approve(approval.id(),"FIN-next"),"DIRECTOR_APPROVAL_REQUIRED");
        code(()->approvals.reject(approval.id(),"FIN-next"),"DIRECTOR_APPROVAL_REQUIRED");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-owner","n/a","ROLE_DIRECTOR"));
        approvals.approve(approval.id(),"FIN-owner");actor();
        var changed=new FinanceDtos.ExpenseRequest("Maintenance","Changed description",request.amount(),request.method());
        code(()->service.recordExpense(changed,ACTOR,"FIN-large"),"APPROVAL_REQUIRED");
        var saved=service.recordExpense(request,ACTOR,"FIN-large");
        assertThat(service.recordExpense(request,ACTOR,"FIN-large").id()).isEqualTo(saved.id());
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauPheDuyet WHERE maYeuCauPheDuyet=?",String.class,approval.id())).isEqualTo("Đã sử dụng");
        assertThat(service.listExpenses().stream().filter(row->ACTOR.equals(row.paidBy()))).hasSize(1);
    }
    @Test void tenMillionIsAllowedAndFailedCashExpenseDoesNotConsumeApproval(){
        service.recordExpense(new FinanceDtos.ExpenseRequest("Supplies","Boundary",money("10000000"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER),ACTOR,"FIN-boundary");
        var request=new FinanceDtos.ExpenseRequest("Supplies","Cash exceeds balance",money("11000000"),com.hospitality.mis.entity.billing.PaymentMethod.CASH);
        var approval=approvals.request(ACTOR,"BILLING_ADJUSTMENT",com.hospitality.mis.service.governance.ApprovalService.financialTarget("expense","FIN-large-cash"),FinanceService.expenseApprovalPayload(request,"FIN-large-cash"),request.amount(),"Chi tiền mặt","FIN-cash-approval");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-owner","n/a","ROLE_DIRECTOR"));
        approvals.approve(approval.id(),"FIN-owner");actor();
        code(()->service.recordExpense(request,ACTOR,"FIN-large-cash"),"INSUFFICIENT_CASH_BALANCE");
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauPheDuyet WHERE maYeuCauPheDuyet=?",String.class,approval.id())).isEqualTo("Đã phê duyệt");
    }
    @Test void largePaymentRequiresDirectorApprovalAndDoesNotCollectTwice(){
        jdbc.update("UPDATE HoaDon SET tongTienPhong=30000000 WHERE maHoaDon=?",invoice);
        var request=new com.hospitality.mis.dto.billing.PaymentTransactionDtos.CreateRequest(money("11000000"),com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER,com.hospitality.mis.entity.billing.PaymentTransaction.TransactionType.PAYMENT,"FIN-collection");
        code(()->paymentService.record(invoice,request,ACTOR,"FIN-payment"),"APPROVAL_REQUIRED");
        var approval=approvals.request(ACTOR,"BILLING_ADJUSTMENT",com.hospitality.mis.service.governance.ApprovalService.financialTarget("payment","FIN-payment"),request.approvalPayload(invoice,"FIN-payment"),request.amount(),"Thu tiền phòng","FIN-payment-approval");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-owner","n/a","ROLE_DIRECTOR"));approvals.approve(approval.id(),"FIN-owner");actor();
        var saved=paymentService.record(invoice,request,ACTOR,"FIN-payment");
        assertThat(paymentService.record(invoice,request,ACTOR,"FIN-payment").id()).isEqualTo(saved.id());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan WHERE maHoaDon=? AND soTien=11000000",Integer.class,invoice)).isEqualTo(1);
    }
    @Test void largeDebtSettlementWaitsForApprovalAndKeepsDebtUnchangedWhenRejected(){
        var debt=service.recordDebt(new FinanceDtos.PartnerDebtRequest("Supplier","FIN-large-debt",money("20000000")),ACTOR,"FIN-debt-create");
        var request=new FinanceDtos.DebtSettlementRequest(money("11000000"),"Pay supplier",com.hospitality.mis.entity.billing.PaymentMethod.BANK_TRANSFER);
        code(()->service.settleDebt(debt.id(),request,ACTOR,"FIN-settlement"),"APPROVAL_REQUIRED");
        String payload=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode().put("debt_id",debt.id()).put("note","Pay supplier").put("method","BANK_TRANSFER").put("idempotency_key","FIN-settlement").toString();
        var approval=approvals.request(ACTOR,"BILLING_ADJUSTMENT",com.hospitality.mis.service.governance.ApprovalService.financialTarget("settlement","FIN-settlement"),payload,request.amount(),"Chi thanh toán nhà cung cấp","FIN-settle-approval");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("FIN-owner","n/a","ROLE_DIRECTOR"));approvals.reject(approval.id(),"FIN-owner");actor();
        code(()->service.settleDebt(debt.id(),request,ACTOR,"FIN-settlement"),"APPROVAL_REQUIRED");
        assertThat(service.debtSettlementHistory(debt.id())).isEmpty();
    }
    FinanceDtos.PartnerDebtResponse debt(){return service.recordDebt(new FinanceDtos.PartnerDebtRequest("Supplier","FIN-ref",money("1000")),ACTOR,"FIN-debt");}
    void roster(String employee,String code,LocalDateTime start,LocalDateTime end){
        jdbc.update("INSERT CaLamViecNhanVien(maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao) VALUES(?,?,?,?,?,N'Đã phân công',N'FIN-cash')",employee,start.toLocalDate(),code,start,end);
    }
    List<String> concurrent(java.util.function.IntFunction<String> command)throws Exception{
        CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            var a=pool.submit(()->call(0,command,ready,start));var b=pool.submit(()->call(1,command,ready,start));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));
        }
    }
    String call(int index,java.util.function.IntFunction<String> command,CountDownLatch ready,CountDownLatch start)throws Exception{actor();ready.countDown();assertThat(start.await(5,TimeUnit.SECONDS)).isTrue();try{return command.apply(index);}finally{SecurityContextHolder.clearContext();}}
    int count(String table,String column){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE "+column+" LIKE N'FIN-%'",Integer.class);}
    void payment(int amount,String type){jdbc.update("INSERT GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maNguoiThucHien,thoiDiemPhatSinh) VALUES(?,?,N'Tiền mặt',?,N'Đã hoàn tất',?,?)",invoice,amount,type,ACTOR,LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(10));}
    static BigDecimal money(String value){return new BigDecimal(value);}
    static void actor(){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR,"n/a","ROLE_ACCOUNTING"));}
    static void code(Runnable call,String code){assertThatThrownBy(call::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}
