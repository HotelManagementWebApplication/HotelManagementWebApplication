package com.hospitality.mis.entity.reservation;

/** Quyết định quyết toán rõ ràng do chính sách hủy đặt phòng đưa ra. */
public enum CancellationOutcome {
    /** Hoàn lại tiền theo chính sách hủy. */
    REFUND,
    /** Hủy đúng hạn nhưng không có khoản thanh toán đủ điều kiện để hoàn. */
    RETAIN,
    /** Mất quyền hoàn tiền do hủy muộn hoặc không đến nhận phòng. */
    FORFEIT
}
