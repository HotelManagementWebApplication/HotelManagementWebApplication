package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.VnpayPaymentDtos;
import com.hospitality.mis.service.billing.VnpayPaymentService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

/** Callback public có checksum VNPay thay cho JWT. */
@RestController
@RequestMapping("/api/public/payments/vnpay")
public class VnpayCallbackController {
    private final VnpayPaymentService service;
    private final String frontendResultUrl;

    public VnpayCallbackController(VnpayPaymentService service,
                                   @Value("${hotel.payment.vnpay.frontend-result-url:http://localhost:5173/payment/vnpay-result}") String frontendResultUrl) {
        this.service = service;
        this.frontendResultUrl = frontendResultUrl;
    }

    @GetMapping("/ipn")
    public VnpayPaymentDtos.IpnResponse ipn(@RequestParam Map<String, String> query) {
        VnpayPaymentService.CallbackOutcome result = service.processCallback(query);
        return new VnpayPaymentDtos.IpnResponse(result.responseCode(), result.message());
    }

    @GetMapping("/return")
    public ResponseEntity<Void> paymentReturn(@RequestParam Map<String, String> query) {
        VnpayPaymentService.CallbackOutcome result = service.processCallback(query);
        String display = result.paymentSucceeded() ? "success"
                : "97".equals(result.responseCode()) ? "invalid" : "failed";
        URI location = UriComponentsBuilder.fromUriString(frontendResultUrl)
                .queryParam("result", display)
                .queryParamIfPresent("reservation_id", java.util.Optional.ofNullable(result.reservationId()))
                .queryParamIfPresent("response_code", java.util.Optional.ofNullable(result.providerResponseCode()))
                .build(true).toUri();
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, location.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .build();
    }
}
