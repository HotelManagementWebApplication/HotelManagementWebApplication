package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.*;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.entity.governance.AuditLog;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationTimelineAggregationTest {
    @Mock ReservationRepository reservations; @Mock GuestStore guests; @Mock EmployeeRepository employees;
    @Mock RoomRepository rooms; @Mock AuditService audit; @Mock BillingService billing;
    @Mock ServiceRepository services; @Mock ServiceLineRepository serviceLines;
    @Mock InventoryMovementRepository inventory; @Mock InvoiceRepository invoices;
    @Mock PaymentTransactionRepository payments; @Mock ReceiptRepository receipts;

    @Test
    void timelineIncludesReservationInvoicePaymentAndReceiptAudit() {
        ReservationService service = new ReservationService(reservations, guests, employees, rooms, audit, billing,
                services, serviceLines, inventory);
        ReflectionTestUtils.invokeMethod(service, "setTimelineRepositories", invoices, payments, receipts);
        Invoice invoice = new Invoice(); ReflectionTestUtils.setField(invoice, "id", 20L);
        PaymentTransaction payment = new PaymentTransaction(); ReflectionTestUtils.setField(payment, "id", 30L);
        Receipt receipt = new Receipt(); ReflectionTestUtils.setField(receipt, "id", 40L);
        when(reservations.existsById(9L)).thenReturn(true);
        when(invoices.findByReservationId(9L)).thenReturn(Optional.of(invoice));
        when(payments.findByInvoiceIdOrderByOccurredAtAscIdAsc(20L)).thenReturn(List.of(payment));
        when(receipts.findByInvoiceIdOrderByIssuedAtAscIdAsc(20L)).thenReturn(List.of(receipt));
        when(audit.timeline("RESERVATION", "9")).thenReturn(List.of(log("BOOKING", "2026-09-14T01:00:00Z")));
        when(audit.timeline("INVOICE", "20")).thenReturn(List.of(log("INVOICE", "2026-09-14T02:00:00Z")));
        when(audit.timeline("PAYMENT_TRANSACTION", "30")).thenReturn(List.of(log("PAYMENT", "2026-09-14T03:00:00Z")));
        when(audit.timeline("RECEIPT", "40")).thenReturn(List.of(log("RECEIPT", "2026-09-14T04:00:00Z")));

        assertThat(service.timeline(9L)).extracting(x -> x.action())
                .containsExactly("BOOKING", "INVOICE", "PAYMENT", "RECEIPT");
    }

    private AuditLog log(String action, String at) {
        return new AuditLog("actor", action, "TYPE", "1", null, null, null, null, Instant.parse(at));
    }
}
