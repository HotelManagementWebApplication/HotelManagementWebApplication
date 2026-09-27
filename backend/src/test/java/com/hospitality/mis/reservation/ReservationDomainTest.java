package com.hospitality.mis.reservation;

import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Bảo vệ mapping reservation và state machine không mở lại terminal state. */
class ReservationDomainTest {
    @Test
    /** Given entity canonical, When soi bảng/cột, Then mapping khớp schema vật lý tiếng Việt. */
    void canonicalOwnersUseVietnameseTableAndColumnNames() throws Exception {
        assertThat(Reservation.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Reservation.class.getAnnotation(Table.class).name()).isEqualTo("PhieuDatPhong");
        assertThat(ReservationRoom.class.getAnnotation(Table.class).name()).isEqualTo("ChiTietDatPhong");
        assertColumn(Reservation.class, "depositAmount", "tienDatCoc");
        assertColumn(Reservation.class, "actualCheckIn", "thoiDiemNhanPhongThucTe");
        assertColumn(Reservation.class, "idempotencyKey", "khoaChongTrung");
        assertColumn(ReservationRoom.class, "checkIn", "thoiDiemNhanPhong");
        assertColumn(ReservationRoom.class, "checkOut", "thoiDiemTraPhong");
        assertColumn(ReservationRoom.class, "transferCount", "soLanChuyenPhong");
    }

    @Test
    /** Given CONFIRMED -> CHECKED_IN -> CHECKED_OUT, When mở lại, Then terminal state bị từ chối. */
    void stateTransitionsAreExplicitAndTerminalStatesCannotBeReopened() {
        Reservation reservation = new Reservation();
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.transitionTo(ReservationStatus.CHECKED_IN);
        reservation.transitionTo(ReservationStatus.CHECKED_OUT);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CHECKED_OUT);
        assertThrows(IllegalStateException.class, () -> reservation.transitionTo(ReservationStatus.CANCELLED));
    }

    @Test
    /** Given deposit đã trả, When transition trực tiếp, Then DEPOSIT_PAID là creation state hợp lệ. */
    void depositPaidIsAValidCreationState() {
        Reservation reservation = new Reservation();
        reservation.transitionTo(ReservationStatus.DEPOSIT_PAID);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
    }

    /** Helper đọc annotation để assertions mapping dùng cùng quy tắc. */
    private void assertColumn(Class<?> type, String field, String expected) throws Exception {
        assertThat(type.getDeclaredField(field).getAnnotation(Column.class).name()).isEqualTo(expected);
    }
}
