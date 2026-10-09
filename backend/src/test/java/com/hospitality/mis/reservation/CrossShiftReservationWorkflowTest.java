package com.hospitality.mis.reservation;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.reservation.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class CrossShiftReservationWorkflowTest extends ReservationSqlFixture {
    @Autowired MockMvc mvc;
    @Test void nextShiftOperatesPreviousBookingAndAuditBindsCurrentActor()throws Exception{
        var booking=create(now,24,false,"HCT-R1");actor("HCT-NEXT","FRONT_DESK");
        mvc.perform(post("/api/reservations/{id}/check-in",booking.id()).header("Idempotency-Key",key()).contentType(APPLICATION_JSON).content("{\"at\":\"2031-01-01T12:00:00\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CHECKED_IN"));
        mvc.perform(post("/api/reservations/{id}/check-out",booking.id()).header("Idempotency-Key",key()).contentType(APPLICATION_JSON).content("{\"at\":\"2031-01-02T12:00:00\",\"payment_method\":\"CASH\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.payable").value(1200000));
        assertThat(service.get(booking.id()).status()).isEqualTo(ReservationStatus.CHECKED_OUT);
        assertThat(service.get(booking.id()).employeeId()).isEqualTo("HCT-FD");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'HCT-NEXT' AND hanhDong=N'RESERVATION_CHECKED_IN'",Integer.class)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"ACCOUNTING","HOUSEKEEPING","TECHNICAL","STAFF","CUSTOMER","ADMIN","DIRECTOR"})
    void creatorRoleDoesNotGrantMutationPermission(String role){
        var booking=create(now,24,false,"HCT-R1");actor("HCT-FD",role);
        assertThatThrownBy(()->service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(service.get(booking.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
    }
    @Test void noShowBoundaryAndExpiredCancelKeepDepositWithoutCountingStay(){
        var booking=create(now,24,false,"HCT-R1");clock(now.plusHours(1));
        assertThatThrownBy(()->service.markNoShow(booking.id(),"HCT-FD",key())).extracting("code").isEqualTo("NO_SHOW_TOO_EARLY");
        clock(now.plusDays(1).plusMinutes(1));
        var result=service.cancel(booking.id(),new ReservationDtos.CancelRequest("absent"),"HCT-FD",key());
        assertThat(result.status()).isEqualTo(ReservationStatus.NO_SHOW);assertThat(result.cancellationOutcome()).isEqualTo(CancellationOutcome.FORFEIT);
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isZero();
    }
    @Test void missingAuthenticationCannotTrustSuppliedActor(){
        var booking=create(now,24,false,"HCT-R1");SecurityContextHolder.clearContext();
        assertThatThrownBy(()->service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key())).isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
    }
}
