package com.hospitality.mis.finance;

import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentStatus;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.billing.Receipt;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.entity.finance.PartnerDebt;
import com.hospitality.mis.dao.finance.ExpenseRepository;
import com.hospitality.mis.dao.finance.PartnerDebtSettlementRepository;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.finance.FinancialLedgerEntryRepository;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.reservation.Reservation;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;
import com.jayway.jsonpath.JsonPath;

/** HTTP -> finance services -> DB aggregates for reconciliation and invoice-scoped pages. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}", "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}", "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
@Transactional
class FinanceHttpReconciliationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ExpenseRepository expenses;
    @Autowired PartnerDebtSettlementRepository settlements;
    @Autowired AuditLogRepository audits;
    @Autowired FinancialLedgerEntryRepository ledgerEntries;

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void reconciliationAndInvoiceScopedPagesUseDatabaseTotalsAndAuthorization() throws Exception {
        LocalDateTime occurredAt = LocalDateTime.now().minusMinutes(10).withNano(0);
        LocalDate reportDate = occurredAt.toLocalDate();
        Guest guest = new Guest();
        guest.setFullName("Finance Guest"); guest.setPhone("0900000201"); guest.setIdentityNumber("012345678901");
        em.persist(guest);
        Reservation reservation = new Reservation(); reservation.setGuest(guest); em.persist(reservation);
        Invoice invoice = new Invoice(); invoice.setReservation(reservation); invoice.setIssuedAt(occurredAt);
        invoice.setRoomTotal(new BigDecimal("500")); invoice.setStatus(PaymentStatus.CHUA_THANH_TOAN); em.persist(invoice);
        em.flush();

        payment(invoice, new BigDecimal("100"), PaymentMethod.CASH, PaymentTransaction.TransactionType.PAYMENT, occurredAt, "p1");
        payment(invoice, new BigDecimal("200"), PaymentMethod.CARD, PaymentTransaction.TransactionType.PAYMENT, occurredAt.plusMinutes(1), "p2");
        payment(invoice, new BigDecimal("20"), PaymentMethod.CASH, PaymentTransaction.TransactionType.REFUND, occurredAt.plusMinutes(2), "r1");
        receipt(invoice, new BigDecimal("80"), PaymentMethod.CASH, occurredAt, "rc1");
        receipt(invoice, new BigDecimal("200"), PaymentMethod.CARD, occurredAt.plusMinutes(1), "rc2");
        ledger("REVENUE_RECOGNIZED", FinancialLedgerEntry.Direction.CREDIT, new BigDecimal("500"), occurredAt);
        ledger("CASH_VARIANCE", FinancialLedgerEntry.Direction.CREDIT, new BigDecimal("10"), occurredAt);
        PartnerDebt debt = new PartnerDebt(); debt.setPartnerName("Supplier"); debt.setReferenceCode("DEBT-1");
        debt.setAmount(new BigDecimal("100")); debt.setSettledAmount(new BigDecimal("25")); debt.setRecordedAt(occurredAt); em.persist(debt);
        em.flush();

        mvc.perform(get("/api/finance/reconciliation").param("from", reportDate.toString()).param("to", reportDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals_by_method.CASH").value(80))
                .andExpect(jsonPath("$.totals_by_method.CARD").value(200))
                .andExpect(jsonPath("$.total_payments").value(300))
                .andExpect(jsonPath("$.total_refunds").value(20))
                .andExpect(jsonPath("$.net_total").value(280))
                .andExpect(jsonPath("$.recognized_revenue").value(500))
                .andExpect(jsonPath("$.outstanding_partner_debt").value(75))
                .andExpect(jsonPath("$.cash_variance").value(-10));

        mvc.perform(get("/api/finance/payments").param("invoice_id", invoice.getId().toString()).param("page", "0").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total_elements").value(3));
        mvc.perform(get("/api/finance/receipts").param("invoice_id", invoice.getId().toString()).param("page", "0").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total_elements").value(2));

        mvc.perform(post("/api/finance/partner-debts/{id}/settle", debt.getId()).contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "finance-settle-1")
                        .content("{\"amount\":25,\"note\":\"bank settlement\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.settled_amount").value(50));
        mvc.perform(post("/api/finance/partner-debts/{id}/settle", debt.getId()).contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "finance-settle-1")
                        .content("{\"amount\":25,\"note\":\"bank settlement\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.settled_amount").value(50));
        mvc.perform(get("/api/finance/partner-debts/{id}/settlements", debt.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].amount").value(25));
        mvc.perform(get("/api/finance/ledger").param("entry_type", "PARTNER_DEBT_SETTLEMENT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));

        mvc.perform(post("/api/finance/cash-handovers").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "finance-handover-1")
                        .content("{\"shift_code\":\"SHIFT-REAL\",\"from_actor\":\"accounting\",\"to_actor\":\"next\",\"actual_amount\":75,\"note\":\"counted\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.expected_amount").value(80))
                .andExpect(jsonPath("$.variance").value(-5));
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void everyFinanceMutationRequiresAnIdempotencyKey() throws Exception {
        mvc.perform(post("/api/finance/cash-handovers").contentType(APPLICATION_JSON)
                        .content("{\"shift_code\":\"SHIFT-MISSING\",\"from_actor\":\"accounting\",\"to_actor\":\"next\",\"actual_amount\":1}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/finance/expenses").contentType(APPLICATION_JSON)
                        .content("{\"category\":\"Food\",\"description\":\"Lunch\",\"amount\":1}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/finance/partner-debts").contentType(APPLICATION_JSON)
                        .content("{\"partner_name\":\"Supplier\",\"reference_code\":\"MISSING-1\",\"amount\":1}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/finance/partner-debts/1/settle").contentType(APPLICATION_JSON)
                        .content("{\"amount\":1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void expenseRetryReplaysAndPayloadMismatchDoesNotCreateAnotherLedgerEntry() throws Exception {
        String body = "{\"category\":\"Food\",\"description\":\"Lunch\",\"amount\":25}";
        var first = mvc.perform(post("/api/finance/expenses").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "expense-retry-1").content(body))
                .andExpect(status().isOk()).andReturn();
        var second = mvc.perform(post("/api/finance/expenses").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "expense-retry-1").content(body))
                .andExpect(status().isOk()).andReturn();
        String firstId = String.valueOf((Object) JsonPath.read(first.getResponse().getContentAsString(), "$.id"));
        String secondId = String.valueOf((Object) JsonPath.read(second.getResponse().getContentAsString(), "$.id"));
        assertThat(secondId).isEqualTo(firstId);
        assertThat(expenses.count()).isEqualTo(1);
        assertThat(ledgerEntries.findAll().stream().filter(x -> "EXPENSE".equals(x.getEntryType())).count()).isEqualTo(1);
        assertThat(audits.findAll().stream()
                .filter(x -> "EXPENSE_RECORDED".equals(x.getAction())).count()).isEqualTo(1);

        mvc.perform(post("/api/finance/expenses").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "expense-retry-1")
                        .content("{\"category\":\"Food\",\"description\":\"Dinner\",\"amount\":25}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void actorSpoofingAndInvalidSettlementAreRejectedWithoutFinancialSideEffects() throws Exception {
        mvc.perform(post("/api/finance/cash-handovers").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "spoofed-handover-1")
                        .content("{\"shift_code\":\"SHIFT-SPOOF\",\"from_actor\":\"attacker\",\"to_actor\":\"next\",\"actual_amount\":1}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ACTOR_MISMATCH"));

        PartnerDebt debt = new PartnerDebt(); debt.setPartnerName("Supplier"); debt.setReferenceCode("SETTLE-INVALID");
        debt.setAmount(new BigDecimal("100")); debt.setSettledAmount(BigDecimal.ZERO); debt.setRecordedAt(LocalDateTime.now());
        em.persist(debt); em.flush();
        mvc.perform(post("/api/finance/partner-debts/{id}/settle", debt.getId()).contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "settle-invalid-1").content("{\"amount\":101}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_DEBT_SETTLEMENT"));
        assertThat(settlements.findByPartnerDebtIdOrderBySettledAtAscIdAsc(debt.getId())).isEmpty();
        assertThat(ledgerEntries.findAll().stream().noneMatch(x -> "PARTNER_DEBT_SETTLEMENT".equals(x.getEntryType()))).isTrue();
    }

    @Test
    @WithMockUser(username = "accounting", roles = "ACCOUNTING")
    void partnerDebtCreationBindsAuthenticatedActorAndAuditsItsLedgerEntry() throws Exception {
        mvc.perform(post("/api/finance/partner-debts").contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "debt-create-1")
                        .content("{\"partner_name\":\"Supplier\",\"reference_code\":\"DEBT-ACTOR-1\",\"amount\":80}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("OPEN"));

        assertThat(ledgerEntries.findAll().stream()
                .filter(x -> "PARTNER_DEBT_RECORDED".equals(x.getEntryType()))
                .allMatch(x -> "accounting".equals(x.getActorId()))).isTrue();
        assertThat(audits.findAll().stream()
                .anyMatch(x -> "PARTNER_DEBT_RECORDED".equals(x.getAction())
                        && "debt-create-1".equals(x.getCorrelationKey()))).isTrue();
    }

    private void payment(Invoice invoice, BigDecimal amount, PaymentMethod method, PaymentTransaction.TransactionType type,
                         LocalDateTime occurredAt, String reference) {
        PaymentTransaction payment = new PaymentTransaction(); payment.setInvoice(invoice); payment.setAmount(amount);
        payment.setMethod(method); payment.setType(type); payment.setStatus(PaymentTransaction.TransactionStatus.COMPLETED);
        payment.setOccurredAt(occurredAt); payment.setActorId("accounting"); payment.setReference(reference);
        em.persist(payment);
    }

    private void receipt(Invoice invoice, BigDecimal amount, PaymentMethod method, LocalDateTime issuedAt, String number) {
        Receipt receipt = new Receipt(); receipt.setInvoice(invoice); receipt.setAmount(amount); receipt.setMethod(method);
        receipt.setIssuedAt(issuedAt); receipt.setIssuedBy("accounting"); receipt.setReceiptNumber(number); em.persist(receipt);
    }

    private void ledger(String type, FinancialLedgerEntry.Direction direction, BigDecimal amount, LocalDateTime occurredAt) {
        FinancialLedgerEntry entry = new FinancialLedgerEntry(); entry.setEntryType(type); entry.setSourceType("TEST");
        entry.setSourceId(type); entry.setDirection(direction); entry.setAmount(amount); entry.setActorId("accounting");
        entry.setOccurredAt(occurredAt); entry.setNote("integration"); em.persist(entry);
    }
}
