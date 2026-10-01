package com.hospitality.mis.service.billing;

import java.math.BigDecimal;

/** Dữ liệu tối thiểu để gửi email sau khi transaction thanh toán đã commit. */
public record BookingDepositPaidEvent(
        String email,
        Long reservationId,
        BigDecimal amount,
        String roomSummary,
        String paymentReference) {}
