package com.hospitality.mis.entity.billing;

/** Trạng thái của một lần thử thanh toán trên cổng VNPay. */
public enum VnpayPaymentStatus {
    PENDING,
    SUCCEEDED,
    FAILED,
    EXPIRED,
    CANCELLED
}
