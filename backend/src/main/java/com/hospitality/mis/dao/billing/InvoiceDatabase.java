package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.InvoiceDtos;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.dao.reservation.ReservationDatabase;
import com.hospitality.mis.persistence.VietnameseEnumConverters.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.*;
import java.util.*;

@Repository
public class InvoiceDatabase {
    public record Snapshot(InvoiceDtos.Response response,String employeeId,Long customerId){}
    public record Deposit(long sourceId,BigDecimal amount){}
    private static final String COLUMNS="maHoaDon,maPhieuDatPhong,thoiDiemPhatHanh,tongTienPhong,tongTienDichVu,tienPhuThu,tienBoiThuong,phiGiaHan,tongTienDieuChinh,tienGiamGia,tienDatCocDaTra,soDuConLai,phuongThucThanhToan,trangThai,maNhanVien,maTaiKhoanKhachHang";
    private final JdbcTemplate jdbc;
    private final PaymentMethodConverter methods=new PaymentMethodConverter();
    private final PaymentStatusConverter statuses=new PaymentStatusConverter();
    private final RowMapper<Snapshot> rows=(r,n)->new Snapshot(new InvoiceDtos.Response(r.getLong(1),r.getLong(2),r.getTimestamp(3).toLocalDateTime(),r.getBigDecimal(4),r.getBigDecimal(5),r.getBigDecimal(6),r.getBigDecimal(7),r.getBigDecimal(8),r.getBigDecimal(9),r.getBigDecimal(10),r.getBigDecimal(11),r.getBigDecimal(12),methods.convertToEntityAttribute(r.getString(13)),
        "Dự kiến".equals(r.getString(14))?PaymentStatus.DU_KIEN:r.getBigDecimal(12).signum()==0?PaymentStatus.DA_THANH_TOAN:PaymentStatus.CHUA_THANH_TOAN),r.getString(15),r.getObject(16,Long.class));
    public InvoiceDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Snapshot get(long id){return find("maHoaDon",id);}
    public Snapshot reservation(long id){return find("maPhieuDatPhong",id);}
    private Snapshot find(String column,long id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwHoaDonChiTiet WHERE "+column+"=?",rows,id).stream().findFirst().orElseThrow(()->new DomainException("INVOICE_NOT_FOUND","Không tìm thấy hóa đơn"));}
    public void lock(long id){jdbc.queryForObject("EXEC dbo.uspKhoaHoaDon ?",Long.class,id);}
    public Deposit deposit(long invoice){
        var sources=jdbc.query("SELECT maGiaoDichThanhToan,soDu FROM dbo.vwSoDuTienCoc WHERE maHoaDon=? AND soDu>0 ORDER BY thoiDiemPhatSinh,maGiaoDichThanhToan",(r,n)->new Deposit(r.getLong(1),r.getBigDecimal(2)),invoice);
        if(sources.isEmpty())throw new DomainException("DEPOSIT_ALREADY_REFUNDED","Tiền cọc đã hoàn hoặc chưa ghi nhận");
        return new Deposit(sources.get(0).sourceId(),sources.stream().map(Deposit::amount).reduce(BigDecimal.ZERO,BigDecimal::add));
    }
    public void command(String command,Long reservation,Long invoice,LocalDateTime at,PaymentMethod method,
            BigDecimal delta,String reason,String storedKey,String actor,Long approval,String fingerprint,Long customer,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspLenhHoaDon ?,?,?,?,?,?,?,?,?,?,?,?,?",command,reservation,invoice,at,methods.convertToDatabaseColumn(method),delta,reason,storedKey,actor,approval,fingerprint,customer,now);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
                String code=switch(sql.getErrorCode()){case 53101->"INVOICE_NOT_FOUND";case 53501->"INVALID_CHECKOUT_TIME";
                    case 53502->"INVALID_ADJUSTMENT";case 53503->"ADJUSTMENT_EXCEEDS_TOTAL";case 53504->"DEPOSIT_ALREADY_REFUNDED";
                    case 53505->"APPROVAL_REQUIRED";case 52205->"APPROVAL_REQUIRED";default->null;};
                if(code!=null)throw new DomainException(code,sql.getMessage());
            }throw ReservationDatabase.translate(error);
        }
    }
    public InvoiceDtos.PageResponse page(PaymentStatus status,Long reservation,LocalDate from,LocalDate to,int page,int size){
        int p=Math.max(0,page),s=Math.max(1,Math.min(100,size));
        String where=" WHERE (CAST(? AS NVARCHAR(30)) IS NULL OR trangThai=?) AND (CAST(? AS BIGINT) IS NULL OR maPhieuDatPhong=?) AND (CAST(? AS DATETIME2) IS NULL OR thoiDiemPhatHanh>=?) AND (CAST(? AS DATETIME2) IS NULL OR thoiDiemPhatHanh<?)";
        Object[] values={statuses.convertToDatabaseColumn(status),statuses.convertToDatabaseColumn(status),reservation,reservation,from==null?null:from.atStartOfDay(),from==null?null:from.atStartOfDay(),to==null?null:to.plusDays(1).atStartOfDay(),to==null?null:to.plusDays(1).atStartOfDay()};
        long total=jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwHoaDonChiTiet"+where,Long.class,values);
        var args=new ArrayList<>(Arrays.asList(values));args.add(p*s);args.add(s);
        var items=jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwHoaDonChiTiet"+where+" ORDER BY thoiDiemPhatHanh DESC,maHoaDon DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,args.toArray()).stream().map(Snapshot::response).toList();
        return new InvoiceDtos.PageResponse(items,p,s,total,(int)Math.ceil((double)total/s));
    }
}
