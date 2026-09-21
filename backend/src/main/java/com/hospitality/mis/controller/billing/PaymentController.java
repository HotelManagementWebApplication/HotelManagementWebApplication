package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Quản lý các giao dịch thanh toán gắn với một hóa đơn.
 */
@RestController
@RequestMapping("/api/invoices/{invoiceId}/payments")
public class PaymentController {
    /** Dịch vụ đọc và ghi giao dịch thanh toán, đồng thời áp dụng các quy tắc liên kết với hóa đơn. */
    private final PaymentTransactionService service;
    public PaymentController(PaymentTransactionService service) { this.service = service; }
    /**
     * Liệt kê thanh toán của hóa đơn qua GET /api/invoices/{invoiceId}/payments.
     * invoiceId là path parameter, không có query/header/body; trả danh sách giao dịch để đối soát hóa đơn.
     * Chỉ BILLING_READ được phép; hóa đơn không tồn tại hoặc lỗi truy vấn được dịch vụ báo lỗi. Đây là thao tác đọc,
     * không có idempotency concern.
     */
    @GetMapping 
    @PreAuthorize("@departmentAccess.allows(authentication, 'BILLING_READ')")
    public Object list(@PathVariable Long invoiceId, @RequestParam(name = "page", required = false) Integer page, @RequestParam(name = "size", required = false) Integer size) { return page == null && size == null ? service.listByInvoice(invoiceId) : service.pageByInvoice(invoiceId, page == null ? 0 : page, size == null ? 20 : size); }
    /**
     * Ghi nhận thanh toán qua POST /api/invoices/{invoiceId}/payments.
     * invoiceId là path parameter, body tạo giao dịch được {@code @Valid} kiểm tra; actor hiện tại được truyền cho dịch vụ,
     * response là giao dịch đã ghi. Chỉ PAYMENT_WRITE được gọi; Idempotency-Key là bắt buộc
     * để retry/double-click không ghi thêm giao dịch.
     */
    @PostMapping 
    @PreAuthorize("@departmentAccess.allows(authentication, 'PAYMENT_WRITE')")
    public PaymentTransactionDtos.Response record(@PathVariable Long invoiceId,
                                                  @Valid @RequestBody PaymentTransactionDtos.CreateRequest request,
                                                  @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return service.record(invoiceId, request, SecurityActor.currentActor(), idempotencyKey);
    }
}
