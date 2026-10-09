package com.hospitality.mis.billing;
import com.hospitality.mis.reservation.ReservationSqlFixture;
import com.hospitality.mis.dao.reservation.ReservationDatabase;
import com.hospitality.mis.dao.billing.DepositPaymentDatabase;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.dto.billing.DepositPaymentWebhookDtos;
import com.hospitality.mis.entity.reservation.*;
import com.hospitality.mis.service.billing.*;
import com.hospitality.mis.service.auth.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import org.springframework.context.ApplicationEventPublisher;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SqlServerDepositFinalizationTest extends ReservationSqlFixture {
    @Autowired ReservationDatabase reservations;
    @Autowired DepositPaymentDatabase deposits;
    @Autowired ApplicationEventPublisher events;
    @Autowired PlatformTransactionManager transactions;
    @MockBean EmailService email;
    @Test void concurrentCallbacksCommitOnePaymentReceiptAndEmailWithExactReplayBinding()throws Exception{
        long id=online();var request=new DepositPaymentWebhookDtos.Request("HCT-PROVIDER","HCT-CODE",new BigDecimal("1200000.00"),"bank-ref","SUCCESS");
        var webhook=new DepositPaymentWebhookService(deposits,events,"hct-secret");String signature=sign(request);
        doAnswer(invocation->{assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(jdbc.queryForObject("SELECT trangThai FROM PhieuDatPhong WHERE maPhieuDatPhong=?",String.class,id)).isEqualTo("Đã thanh toán cọc");return null;})
            .when(email).sendBookingDepositConfirmation(anyString(),anyLong(),any(),anyString(),anyString());
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Object> call=()->{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();return webhook.accept(request,signature);};
            var a=pool.submit(call);var b=pool.submit(call);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        verify(email,times(1)).sendBookingDepositConfirmation(eq("hct@example.test"),eq(id),any(),any(),eq("bank-ref"));
        long invoice=jdbc.queryForObject("SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong=?",Long.class,id);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
        var mismatch=new DepositPaymentWebhookDtos.Request("HCT-PROVIDER","HCT-CODE",new BigDecimal("1200001.00"),"bank-ref","SUCCESS");
        assertThatThrownBy(()->webhook.accept(mismatch,sign(mismatch))).extracting("code").isEqualTo("IDEMPOTENCY_MISMATCH");
    }
    @Test void signatureAndAmountFailuresLeaveNoFinanceAndOuterRollbackSendsNoEmail()throws Exception{
        long id=online();var request=new DepositPaymentWebhookDtos.Request("HCT-ROLLBACK","HCT-CODE",new BigDecimal("1200000.00"),"bank-ref","SUCCESS");
        var webhook=new DepositPaymentWebhookService(deposits,events,"hct-secret");
        assertThatThrownBy(()->webhook.accept(request,"invalid")).extracting("code").isEqualTo("PAYMENT_SIGNATURE_INVALID");
        var wrong=new DepositPaymentWebhookDtos.Request("HCT-WRONG","HCT-CODE",BigDecimal.ONE,"bank-ref","SUCCESS");
        assertThatThrownBy(()->webhook.accept(wrong,sign(wrong))).extracting("code").isEqualTo("PAYMENT_AMOUNT_MISMATCH");
        new TransactionTemplate(transactions).executeWithoutResult(tx->{try{webhook.accept(request,sign(request));}catch(Exception error){throw new RuntimeException(error);}tx.setRollbackOnly();});
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HoaDon WHERE maPhieuDatPhong=?",Integer.class,id)).isZero();verifyNoInteractions(email);
    }
    private long online(){
        jdbc.update("UPDATE KhachLuuTru SET email=N'hct@example.test' WHERE maKhachLuuTru=?",guest);
        jdbc.update("INSERT TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) VALUES(?,N'0901111112',N'test')",guest);
        long customer=jdbc.queryForObject("SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE maKhachLuuTru=?",Long.class,guest);
        LocalDateTime at=LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        return reservations.create(guest,null,customer,ReservationDtos.RentalType.PACKAGE,null,key(),List.of(new ReservationDtos.RoomStay("HCT-R1",now.plusDays(4),now.plusDays(5))),"HCT-CUST",at,ReservationStatus.DRAFT,CustomerPaymentMethod.VNPAY,"HCT-CODE",at.plusMinutes(15),null,"DIRECT");
    }
    private String sign(DepositPaymentWebhookDtos.Request r)throws Exception{
        Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec("hct-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal((r.providerEventId()+"|"+r.paymentCode()+"|"+r.amount().toPlainString()+"|SUCCESS|"+r.reference()).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
}
