package com.hospitality.mis.billing;

import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

/** HTTP -> dịch vụ thật -> repository thật. Chạy trên cả H2 và MySQL. */
@Transactional
@WithMockUser(username = "clerk", roles = "FRONT_DESK")
public abstract class BillingWorkflowAssertions {
    /** MockMvc đi qua controller, security và dịch vụ thật như một request production. */
    @Autowired MockMvc mvc;
    /** EntityManager seed invoice/approval trực tiếp trong transaction của test. */
    @Autowired EntityManager em;
    /** Invoice chung của mỗi test; roomTotal 1250500 kiểm tra quy tắc làm tròn 1251000. */
    private Invoice invoice;

    /** Given nhân viên, khách và invoice sạch, When bắt đầu test, Then mọi workflow dùng cùng aggregate. */
    @BeforeEach void seedInvoice() {
        Employee employee = new Employee(); employee.setEmployeeId("clerk"); employee.setFullName("Clerk");
        employee.setPassword("test-hash"); employee.setPhone("0900000091"); employee.setRole(EmployeeRole.FRONT_DESK); em.persist(employee);
        Guest guest = new Guest(); guest.setFullName("Billing Guest"); guest.setPhone("0900000092");
        guest.setIdentityNumber("012345678991"); em.persist(guest);
        Reservation r = new Reservation(); r.setEmployee(employee); r.setGuest(guest); em.persist(r);
        invoice = new Invoice(); invoice.setReservation(r); invoice.setRoomTotal(new BigDecimal("1250500"));
        em.persist(invoice); em.flush();
    }

    /** Given invoice 1250500, When thu, xuất receipt, refund lặp, Then ledger không nhân bản và payable đúng. */
    @Test void collectRoundedTotalIssueReceiptRefundAndReplayWithoutDuplicate() throws Exception {
        payment("1251000", "PAYMENT", "collect");
        mvc.perform(get("/api/invoices/reservation/{id}", invoice.getReservation().getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.payable").value(0));
        mvc.perform(post("/api/invoices/{id}/receipts", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", "receipt-test")
                .content("{\"receipt_number\":\"TEST-RECEIPT\",\"amount\":1251000,\"method\":\"CASH\"}"))
                .andExpect(status().isOk());
        approveRefund("251000", "refund");
        payment("251000", "REFUND", "refund");
        payment("251000", "REFUND", "refund");
        em.flush(); em.clear();
        mvc.perform(get("/api/invoices/{id}/payments", invoice.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/invoices/reservation/{id}", invoice.getReservation().getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.payable").value(251000));
    }

    /** Given invoice thuộc ca trước, When actor ca sau đọc, Then tài liệu tài chính vẫn được chia sẻ để vận hành liên tục. */
    @Test @WithMockUser(username = "other", roles = "FRONT_DESK")
    void nextShiftCanReadReservationFinancialDocuments() throws Exception {
        mvc.perform(get("/api/invoices/reservation/{id}", invoice.getReservation().getId())).andExpect(status().isOk());
        mvc.perform(get("/api/invoices/{id}/payments", invoice.getId())).andExpect(status().isOk());
        mvc.perform(get("/api/invoices/{id}/receipts", invoice.getId())).andExpect(status().isOk());
    }

    /** Given request thiếu idempotency key, When qua HTTP boundary, Then bị validation trước khi ghi tiền. */
    @Test void missingIdempotencyKeyIsRejectedAtHttpBoundary() throws Exception {
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .content("{\"amount\":1000,\"method\":\"CASH\",\"type\":\"PAYMENT\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    /** Cùng header nhưng khác payload không được replay thành một giao dịch khác. */
    @Test void sameIdempotencyKeyWithDifferentPayloadIsRejected() throws Exception {
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", "same-payload")
                .content(body("1000", "PAYMENT", "same-payload")))
                .andExpect(status().isOk());
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", "same-payload")
                .content(body("2000", "PAYMENT", "same-payload")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_MISMATCH"));
        mvc.perform(get("/api/invoices/{id}/payments", invoice.getId()))
                .andExpect(jsonPath("$.length()").value(1));
    }

    /** Refund không có approval exact payload phải bị chặn trước khi ghi tiền. */
    @Test void refundWithoutApprovalIsRejected() throws Exception {
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", "refund-without-approval")
                .content(body("1000", "REFUND", "refund-without-approval")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("APPROVAL_REQUIRED"));
    }

    /** Given amount vượt payable, When ghi payment, Then trả lỗi nghiệp vụ và không tạo ledger row. */
    @Test void overpaymentIsRejectedWithoutRecordingMoney() throws Exception {
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", "overpay").content(body("1252000", "PAYMENT", "overpay")))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("PAYMENT_EXCEEDS_BALANCE"));
        mvc.perform(get("/api/invoices/{id}/payments", invoice.getId())).andExpect(jsonPath("$.length()").value(0));
    }

    /** Gửi payment với amount/type/key để các test tập trung vào outcome của workflow. */
    private void payment(String amount, String type, String key) throws Exception {
        mvc.perform(post("/api/invoices/{id}/payments", invoice.getId()).contentType(APPLICATION_JSON)
                .header("Idempotency-Key", key).content(body(amount, type, key))).andExpect(status().isOk());
    }

    /** Tạo approval hợp lệ cho refund; fingerprint và amount phải khớp binding khi consume. */
    private void approveRefund(String amount, String key) throws Exception {
        var request = new PaymentTransactionDtos.CreateRequest(new BigDecimal(amount), PaymentMethod.CASH,
                PaymentTransaction.TransactionType.REFUND, "guest request");
        String payload = request.approvalPayload(invoice.getId(), key);
        ApprovalRequest approval = new ApprovalRequest("clerk", "PAYMENT_REFUND", String.valueOf(invoice.getId()),
                payload, ApprovalService.fingerprintFor(payload), new BigDecimal(amount), "approved refund",
                Instant.now().plusSeconds(3600), "approval-" + key);
        em.persist(approval); em.flush();
        mvc.perform(post("/api/governance/approvals/{id}/approve", approval.getId())
                .with(user("director").roles("DIRECTOR"))).andExpect(status().isOk());
    }
    /** Tạo JSON snake_case theo đúng wire contract; khóa retry nằm ở HTTP header. */
    private String body(String amount, String type, String key) {
        return "{\"amount\":" + amount + ",\"method\":\"CASH\",\"type\":\"" + type
                + "\",\"reference\":\"guest request\"}";
    }
}
