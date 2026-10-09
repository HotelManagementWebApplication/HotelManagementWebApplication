package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentMethodConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.VnpayPaymentStatusConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

/** SQL Server owner for online-deposit attempts and atomic provider finalization. */
@Repository
public class DepositPaymentDatabase {
    public record Attempt(long id,long reservationId,long customerId,String merchantReference,
                          BigDecimal amount,VnpayPaymentStatus status,LocalDateTime createdAt,
                          LocalDateTime expiresAt,LocalDateTime completedAt,String providerTransaction,
                          String bankCode,String cardType,String responseCode,long version) {}
    public record Completion(long reservationId,Long paymentId,String paymentStatus,
                             String reservationStatus,boolean accepted,boolean replay,
                             String email,String rooms) {}

    private static final String CALL="EXEC dbo.uspLenhThanhToanCocOnline ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?";
    private final JdbcTemplate jdbc;
    private final VnpayPaymentStatusConverter statuses=new VnpayPaymentStatusConverter();
    private final PaymentMethodConverter methods=new PaymentMethodConverter();

    public DepositPaymentDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}

    public Attempt create(long reservation,long customer,String merchant,String actor,LocalDateTime now){
        return attempt(call("create",reservation,customer,merchant,null,null,null,null,null,null,null,null,null,actor,now));
    }

    public Attempt fail(String merchant,String response,String providerTransaction,String bank,String card,LocalDateTime now){
        return attempt(call("fail",null,null,merchant,null,null,response,providerTransaction,bank,card,null,null,null,"VNPAY",now));
    }

    public Completion finalizeVnpay(String merchant,BigDecimal amount,String response,String providerTransaction,
                                    String bank,String card,String reference,String externalEvent,
                                    PaymentMethod method,LocalDateTime now){
        return completion(call("finalize",null,null,merchant,null,amount,response,providerTransaction,bank,card,
                reference,externalEvent,method,"VNPAY",now));
    }

    public Completion finalizeWebhook(String paymentCode,BigDecimal amount,String reference,String externalEvent,
                                      LocalDateTime now){
        return completion(call("finalize",null,null,null,paymentCode,amount,null,null,null,null,reference,
                externalEvent,PaymentMethod.BANK_TRANSFER,"PAYMENT_GATEWAY",now));
    }

    public Attempt latest(long reservation,long customer,LocalDateTime now){
        return jdbc.query("SELECT TOP(1) * FROM dbo.vwYeuCauThanhToanVnpay WHERE maPhieuDatPhong=? AND maTaiKhoanKhachHang=? ORDER BY thoiDiemTao DESC,maYeuCauThanhToanVnpay DESC",
                (r,n)->mapAttempt(r),reservation,customer).stream().findFirst()
                .map(value->value.status()==VnpayPaymentStatus.PENDING&&!value.expiresAt().isAfter(now)
                        ?new Attempt(value.id(),value.reservationId(),value.customerId(),value.merchantReference(),value.amount(),VnpayPaymentStatus.EXPIRED,value.createdAt(),value.expiresAt(),value.completedAt(),value.providerTransaction(),value.bankCode(),value.cardType(),value.responseCode(),value.version()):value)
                .orElseThrow(()->new DomainException("VNPAY_PAYMENT_NOT_FOUND","Booking chưa có giao dịch VNPay"));
    }

    public Attempt find(String merchant){
        return jdbc.query("SELECT * FROM dbo.vwYeuCauThanhToanVnpay WHERE maThamChieuMerchant=?",(r,n)->mapAttempt(r),merchant)
                .stream().findFirst().orElseThrow(()->new DomainException("VNPAY_PAYMENT_NOT_FOUND","Không tìm thấy giao dịch VNPay"));
    }

    private List<java.util.Map<String,Object>> call(String command,Long reservation,Long customer,String merchant,
            String paymentCode,BigDecimal amount,String response,String providerTransaction,String bank,String card,
            String reference,String externalEvent,PaymentMethod method,String actor,LocalDateTime now){
        try{return jdbc.queryForList(CALL,command,reservation,customer,merchant,paymentCode,amount,response,
                providerTransaction,bank,card,reference,externalEvent,
                method==null?null:methods.convertToDatabaseColumn(method),actor,now);}
        catch(DataAccessException error){translate(error);throw error;}
    }

    private Attempt attempt(List<java.util.Map<String,Object>> rows){
        if(rows.isEmpty())throw new IllegalStateException("Deposit command returned no attempt");
        var r=rows.get(0);
        return new Attempt(number(r,"maYeuCauThanhToanVnpay").longValue(),number(r,"maPhieuDatPhong").longValue(),
                number(r,"maTaiKhoanKhachHang").longValue(),string(r,"maThamChieuMerchant"),decimal(r,"soTien"),
                statuses.convertToEntityAttribute(string(r,"trangThai")),date(r,"thoiDiemTao"),date(r,"thoiDiemHetHan"),
                date(r,"thoiDiemHoanTat"),string(r,"maGiaoDichVnpay"),string(r,"maNganHang"),string(r,"loaiThe"),
                string(r,"maPhanHoi"),number(r,"phienBan").longValue());
    }

    private Completion completion(List<java.util.Map<String,Object>> rows){
        if(rows.isEmpty())throw new IllegalStateException("Deposit command returned no completion");
        var r=rows.get(0);Number payment=number(r,"maGiaoDichThanhToan");
        return new Completion(number(r,"maPhieuDatPhong").longValue(),payment==null?null:payment.longValue(),
                string(r,"trangThaiThanhToan"),string(r,"trangThaiDatPhong"),bool(r,"daXuLy"),bool(r,"lapLai"),
                string(r,"email"),string(r,"phong"));
    }

    private Attempt mapAttempt(java.sql.ResultSet r)throws java.sql.SQLException{
        return new Attempt(r.getLong("maYeuCauThanhToanVnpay"),r.getLong("maPhieuDatPhong"),r.getLong("maTaiKhoanKhachHang"),
                r.getString("maThamChieuMerchant"),r.getBigDecimal("soTien"),statuses.convertToEntityAttribute(r.getString("trangThai")),
                r.getTimestamp("thoiDiemTao").toLocalDateTime(),r.getTimestamp("thoiDiemHetHan").toLocalDateTime(),
                r.getTimestamp("thoiDiemHoanTat")==null?null:r.getTimestamp("thoiDiemHoanTat").toLocalDateTime(),
                r.getString("maGiaoDichVnpay"),r.getString("maNganHang"),r.getString("loaiThe"),r.getString("maPhanHoi"),r.getLong("phienBan"));
    }

    private void translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){
                case 53301->"RESERVATION_NOT_FOUND";case 53302,53307->"RESERVATION_NOT_PAYABLE";
                case 53303->"PAYMENT_CODE_EXPIRED";case 53304->"PAYMENT_AMOUNT_MISMATCH";
                case 53305->"VNPAY_PAYMENT_NOT_FOUND";case 53306->"PAYMENT_CODE_NOT_FOUND";
                case 53308->"DEPOSIT_ALREADY_PAID";case 53309->"PAYMENT_BUSY";
                case 53310->"IDEMPOTENCY_MISMATCH";default->null;};
            if(code!=null)throw new DomainException(code,sql.getMessage());
        }
    }
    private static Number number(java.util.Map<String,Object> r,String key){return (Number)r.get(key);}
    private static BigDecimal decimal(java.util.Map<String,Object> r,String key){return (BigDecimal)r.get(key);}
    private static String string(java.util.Map<String,Object> r,String key){Object v=r.get(key);return v==null?null:v.toString();}
    private static LocalDateTime date(java.util.Map<String,Object> r,String key){Object v=r.get(key);return v==null?null:((java.sql.Timestamp)v).toLocalDateTime();}
    private static boolean bool(java.util.Map<String,Object> r,String key){Object v=r.get(key);return v instanceof Boolean b?b:((Number)v).intValue()!=0;}
}
