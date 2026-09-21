package com.hospitality.mis.controller.billing;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.dto.billing.InvoiceDtos;




import com.hospitality.mis.service.billing.BillingService;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.*;
import com.hospitality.mis.middleware.security.SecurityActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;


/**
 * Cung cấp các thao tác đọc hóa đơn, hoàn tiền đặt cọc và điều chỉnh số tiền hóa đơn.
 */
@RestController

@RequestMapping("/api/invoices")

public class InvoiceController {
    /** Dịch vụ giữ quy tắc tính hóa đơn, hoàn tiền và điều chỉnh có kiểm soát. */
    private final BillingService service;

    public InvoiceController(BillingService service) { this.service = service; }

    @GetMapping
    @PreAuthorize("@departmentAccess.allows(authentication, 'BILLING_READ')")
    public InvoiceDtos.PageResponse list(@RequestParam(name = "status", required = false) com.hospitality.mis.entity.billing.PaymentStatus status,
                                         @RequestParam(name = "reservation_id", required = false) Long reservationId,
                                         @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
                                         @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
                                         @RequestParam(name = "page", defaultValue = "0") int page,
                                         @RequestParam(name = "size", defaultValue = "20") int size) {
        return service.list(status, reservationId, from, to, page, size);
    }



    /**
     * Lấy hóa đơn của đặt phòng qua GET /api/invoices/reservation/{reservationId}; reservationId là path parameter.
     * Trả response hóa đơn để màn hình và nghiệp vụ thanh toán đọc; không có body hay khóa idempotency.
     * Chỉ phạm vi BILLING_READ được phép; đặt phòng không tồn tại hoặc không hợp lệ tạo lỗi từ dịch vụ.
     */
    @GetMapping("/reservation/{reservationId}")


    @PreAuthorize("@departmentAccess.allows(authentication, 'BILLING_READ')")
    public InvoiceDtos.Response getByReservation(@PathVariable Long reservationId) { return service.getByReservation(reservationId); }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AdjustmentRequest(@NotNull BigDecimal delta, @NotBlank String reason) {}

    /**
     * Hoàn tiền đặt cọc của đặt phòng qua POST /api/invoices/reservation/{reservationId}/deposit/refund.
     * reservationId nằm trên path, actor lấy từ security context; trả hóa đơn sau hoàn tiền và không nhận body.
     * Chỉ phạm vi PAYMENT_WRITE được gọi; kiểm tra trạng thái/số dư và lỗi nghiệp vụ do BillingService xử lý.
     * Không có Idempotency-Key nên tính lặp lại tuân theo quy tắc hoàn tiền của dịch vụ.
     */
    @PostMapping("/reservation/{reservationId}/deposit/refund")

    @PreAuthorize("@departmentAccess.allows(authentication, 'PAYMENT_WRITE')")
    public InvoiceDtos.Response refundDeposit(@PathVariable Long reservationId) { return service.refundDeposit(reservationId, SecurityActor.currentActor()); }

    /**
     * Điều chỉnh hóa đơn qua POST /api/invoices/{invoiceId}/adjust.
     * invoiceId là path parameter, body gồm delta và reason, đều được {@code @Valid} kiểm tra; header bắt buộc
     * {@code Idempotency-Key} chống ghi nhận điều chỉnh trùng. Chỉ BILLING_WRITE được phép; trả hóa đơn sau điều chỉnh,
     * còn khóa lặp, hóa đơn không tồn tại hoặc delta/reason sai được dịch vụ xử lý thành lỗi tương ứng.
     */
    @PostMapping("/{invoiceId}/adjust")

    @PreAuthorize("@departmentAccess.allows(authentication, 'BILLING_WRITE')")
    public InvoiceDtos.Response adjust(@PathVariable Long invoiceId, @Valid @RequestBody AdjustmentRequest request,
                                       @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return service.adjust(invoiceId, request.delta(), request.reason(), SecurityActor.currentActor(), idempotencyKey);
    }
}
