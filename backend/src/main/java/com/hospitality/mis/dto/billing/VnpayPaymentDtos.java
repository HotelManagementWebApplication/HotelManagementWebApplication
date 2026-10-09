package com.hospitality.mis.dto.billing;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Hợp đồng HTTP cho thao tác chuyển hướng và theo dõi thanh toán VNPay. */
public final class VnpayPaymentDtos {
    private VnpayPaymentDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CheckoutResponse(
            Long attemptId,
            Long reservationId,
            String transactionReference,
            BigDecimal amount,
            VnpayPaymentStatus status,
            LocalDateTime expiresAt,
            String paymentUrl) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StatusResponse(
            Long attemptId,
            Long reservationId,
            String transactionReference,
            BigDecimal amount,
            VnpayPaymentStatus status,
            LocalDateTime expiresAt,
            String responseCode) {}

    public record IpnResponse(
            @JsonProperty("RspCode") String responseCode,
            @JsonProperty("Message") String message) {}
}
