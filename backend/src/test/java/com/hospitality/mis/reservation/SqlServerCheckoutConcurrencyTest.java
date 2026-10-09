package com.hospitality.mis.reservation;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import org.junit.jupiter.api.Test;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
class SqlServerCheckoutConcurrencyTest extends ReservationSqlFixture {
    @Test void twoConnectionsReplayOneCheckoutAndOneMembershipIncrement()throws Exception{
        var checkIn=now.withHour(14);
        var booking=create(checkIn,22,false,"HCT-R1");service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(checkIn),"HCT-FD",key());
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);String key=key();
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Object> call=()->{actor("HCT-FD","FRONT_DESK");try{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();return service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(checkIn.plusHours(22),PaymentMethod.CASH),"HCT-FD",key);}finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}};
            var a=pool.submit(call);var b=pool.submit(call);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE maDoiTuong=? AND hanhDong=N'RESERVATION_CHECKED_OUT'",Integer.class,booking.id().toString())).isEqualTo(1);
    }
}
