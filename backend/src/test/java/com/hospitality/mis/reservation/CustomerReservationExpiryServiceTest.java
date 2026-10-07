package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.billing.VnpayPaymentAttemptRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.reservation.CustomerReservationExpiryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerReservationExpiryServiceTest {
    @Mock ReservationRepository reservations;
    @Mock AuditService audit;
    @Mock VnpayPaymentAttemptRepository vnpayAttempts;

    @Test
    void expiredExtensionPaymentRestoresOriginalConfirmedBooking() {
        var originalCheckIn = LocalDateTime.of(2026, 10, 10, 14, 0);
        var originalCheckOut = LocalDateTime.of(2026, 10, 12, 12, 0);
        var extendedCheckOut = LocalDateTime.of(2026, 10, 14, 12, 0);

        var reservation = new Reservation();
        ReflectionTestUtils.setField(reservation, "id", 41L);
        reservation.transitionTo(ReservationStatus.CONFIRMED);
        reservation.setDepositAmount(new BigDecimal("3600000"));
        reservation.setDepositPaymentStatus(DepositPaymentStatus.PENDING);
        reservation.setDepositPaymentCode("EXT-41");
        reservation.setDepositPaymentExpiresAt(LocalDateTime.of(2026, 10, 2, 9, 0));
        reservation.setPendingChangeType("Gia hạn");
        reservation.setPendingPreviousCheckIn(originalCheckIn);
        reservation.setPendingPreviousCheckOut(originalCheckOut);
        reservation.setPendingPreviousDepositAmount(new BigDecimal("1800000"));
        reservation.setPendingAdditionalDeposit(new BigDecimal("1800000"));

        var room = new ReservationRoom();
        room.setCheckIn(originalCheckIn);
        room.setCheckOut(extendedCheckOut);
        reservation.addRoom(room);

        when(reservations.findExpiredCustomerHoldsForUpdate(any())).thenReturn(List.of(reservation));
        when(vnpayAttempts.findByReservationIdAndStatus(any(), any())).thenReturn(List.of());

        var service = new CustomerReservationExpiryService(reservations, audit, vnpayAttempts);
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(
            Instant.parse("2026-10-02T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));

        service.expireHolds();

        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
        assertThat(reservation.getDepositPaymentStatus()).isEqualTo(DepositPaymentStatus.PAID);
        assertThat(reservation.getDepositAmount()).isEqualByComparingTo("1800000");
        assertThat(room.getCheckIn()).isEqualTo(originalCheckIn);
        assertThat(room.getCheckOut()).isEqualTo(originalCheckOut);
        assertThat(reservation.getPendingChangeType()).isNull();
        assertThat(reservation.getPendingAdditionalDeposit()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(reservation.getDepositPaymentCode()).isNull();
        assertThat(reservation.getDepositPaymentExpiresAt()).isNull();
        verify(audit).record("SYSTEM", "CUSTOMER_EXTENSION_PAYMENT_EXPIRED", "RESERVATION",
            "41", "PENDING", "ROLLED_BACK", "ADDITIONAL_DEPOSIT_TIMEOUT");
    }
}
