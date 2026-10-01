package com.hospitality.mis.entity.reservation;

/** Cách khách hàng bảo đảm booking online trước khi lễ tân tiếp nhận. */
public enum CustomerPaymentMethod {
    /** Chuyển sang cổng VNPay và thu 50% tiền cọc. */
    VNPAY,
    /** Chờ lễ tân xác nhận; booking chưa giữ phòng cho tới lúc được xác nhận. */
    PAY_AT_HOTEL
}
