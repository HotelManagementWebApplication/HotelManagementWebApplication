package com.hospitality.mis.reservation;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.reservation.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;
class ReservationCancellationCorrectnessTest extends ReservationSqlFixture {
    @Test void boundaryAndReplayKeepOneViolationAndRejectDifferentPayload(){
        var booking=create(now.plusHours(48),24,false,"HCT-R1");String key=key();
        var first=service.cancel(booking.id(),new ReservationDtos.CancelRequest("guest request"),"HCT-FD",key);
        assertThat(first.cancellationOutcome()).isEqualTo(CancellationOutcome.FORFEIT);
        assertThat(service.cancel(booking.id(),new ReservationDtos.CancelRequest("guest request"),"HCT-FD",key)).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT soLanHuyMuon FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
        assertThatThrownBy(()->service.cancel(booking.id(),new ReservationDtos.CancelRequest("different"),"HCT-FD",key)).extracting("code").isEqualTo("IDEMPOTENCY_KEY_CONFLICT");
    }
    @Test void freeCancellationNeedsApprovalAndRollsBackReservationUntilApproved(){
        var booking=create(now.plusHours(48).plusMinutes(1),24,false,"HCT-R1");
        assertThatThrownBy(()->service.cancel(booking.id(),new ReservationDtos.CancelRequest("changed plans"),"HCT-FD",key())).extracting("code").isEqualTo("APPROVAL_REQUIRED");
        assertThat(service.get(booking.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
        var invoice=billing.getByReservation(booking.id());
        long payment=jdbc.queryForObject("SELECT maGiaoDichThanhToan FROM GiaoDichThanhToan WHERE maHoaDon=?",Long.class,invoice.id());
        var approval=approvals.request("HCT-FD","DEPOSIT_REFUND",invoice.id().toString(),"CANCELLATION_DEPOSIT:"+booking.id()+":"+payment,booking.deposit(),"approved",key());
        actor("HCT-DIR","DIRECTOR");approvals.approve(approval.id(),"HCT-DIR");actor("HCT-FD","FRONT_DESK");
        assertThat(service.cancel(booking.id(),new ReservationDtos.CancelRequest("changed plans"),"HCT-FD",key()).cancellationOutcome()).isEqualTo(CancellationOutcome.REFUND);
        assertThat(billing.getByReservation(booking.id()).deposit()).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"Đang bảo trì","Đang có khách","Đang dọn phòng","Ngừng sử dụng"})
    void checkInRejectsPhysicalBlockWithoutPartialState(String status){
        var booking=create(now,24,false,"HCT-R1");
        jdbc.update("UPDATE Phong SET trangThai=? WHERE maPhong=N'HCT-R1'",status);
        assertThatThrownBy(()->service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key())).extracting("code").isEqualTo("ROOM_NOT_AVAILABLE");
        assertThat(service.get(booking.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
    }
}
