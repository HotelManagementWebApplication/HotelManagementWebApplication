package com.hospitality.mis.entity.reservation;



public enum ReservationStatus {
    /** Bản nháp chưa xác nhận. */
    DRAFT,

    /** Phòng được giữ tạm tới hạn nộp cọc; chưa có khoản tiền thực thu. */
    PENDING_PAYMENT,

    /** Đã thu tiền đặt cọc. */
    DEPOSIT_PAID,

    /** Đặt phòng đã được xác nhận. */
    CONFIRMED,

    /** Khách đã nhận phòng. */
    CHECKED_IN,

    /** Khách đã trả phòng và kết thúc lưu trú. */
    CHECKED_OUT,

    /** Đặt phòng đã bị hủy. */
    CANCELLED,

    /** Khách không đến nhận phòng theo lịch. */
    NO_SHOW;

    /** Kiểm tra trạng thái đích có hợp lệ trong vòng đời hiện tại hay không. */
    public boolean canTransitionTo(ReservationStatus next) {
        return switch (this) {
            case DRAFT -> next == PENDING_PAYMENT || next == CANCELLED;
            case PENDING_PAYMENT -> next == DEPOSIT_PAID || next == CANCELLED;
            case DEPOSIT_PAID, CONFIRMED -> next == CHECKED_IN || next == CANCELLED || next == NO_SHOW;
            case CHECKED_IN -> next == CHECKED_OUT;
            case CHECKED_OUT, CANCELLED, NO_SHOW -> false;
        };
    }
}
