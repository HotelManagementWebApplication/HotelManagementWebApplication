package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.VnpayPaymentDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.VnpayPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Điểm vào có xác thực để customer tạo và theo dõi giao dịch VNPay của chính mình. */
@RestController
@RequestMapping("/api/customer/reservations/{reservationId}/vnpay-payments")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerVnpayPaymentController {
    private final VnpayPaymentService service;

    public CustomerVnpayPaymentController(VnpayPaymentService service) { this.service = service; }

    @PostMapping
    public VnpayPaymentDtos.CheckoutResponse checkout(@PathVariable Long reservationId,
                                                      HttpServletRequest request) {
        return service.createCheckout(reservationId, SecurityActor.currentActor(), clientIp(request));
    }

    @GetMapping("/latest")
    public VnpayPaymentDtos.StatusResponse latest(@PathVariable Long reservationId) {
        return service.latest(reservationId, SecurityActor.currentActor());
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
