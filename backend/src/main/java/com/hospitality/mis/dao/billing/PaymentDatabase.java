package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.persistence.VietnameseEnumConverters.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;

@Repository
public class PaymentDatabase {
    public record InvoiceScope(long invoiceId,long reservationId,String employeeId,Long customerId){}
    private static final String COLS="maGiaoDichThanhToan,maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien";
    private final JdbcTemplate jdbc;
    private final PaymentMethodConverter methods=new PaymentMethodConverter();
    private final TransactionTypeConverter types=new TransactionTypeConverter();
    private final TransactionStatusConverter statuses=new TransactionStatusConverter();
    private final RowMapper<PaymentTransactionDtos.Response> rows=(r,n)->new PaymentTransactionDtos.Response(r.getLong(1),r.getLong(2),r.getBigDecimal(3),methods.convertToEntityAttribute(r.getString(4)),types.convertToEntityAttribute(r.getString(5)),statuses.convertToEntityAttribute(r.getString(6)),r.getString(7),r.getTimestamp(8).toLocalDateTime(),r.getString(9));
    public PaymentDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public InvoiceScope invoice(long id){
        return jdbc.query("SELECT maHoaDon,maPhieuDatPhong,maNhanVien,maTaiKhoanKhachHang FROM dbo.vwHoaDonChiTiet WHERE maHoaDon=?",(r,n)->new InvoiceScope(r.getLong(1),r.getLong(2),r.getString(3),r.getObject(4,Long.class)),id).stream().findFirst()
            .orElseThrow(()->new DomainException("INVOICE_NOT_FOUND","Không tìm thấy hóa đơn"));
    }
    public void lock(long id){jdbc.queryForObject("EXEC dbo.uspKhoaHoaDon ?",Long.class,id);}
    public PaymentTransactionDtos.Response record(String command,long invoice,BigDecimal amount,PaymentMethod method,String reference,String storedKey,String actor,Long approval,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspLenhGiaoDichThanhToan ?,?,?,?,?,?,?,?,?",command,invoice,amount,methods.convertToDatabaseColumn(method),reference,storedKey,actor,approval,now);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 53101->"INVOICE_NOT_FOUND";case 53102->"INVALID_TRANSACTION";case 53103->"PAYMENT_EXCEEDS_BALANCE";case 53104->"REFUND_EXCEEDS_PAID";case 53105->"REFUND_SOURCE_NOT_FOUND";case 52205->"APPROVAL_REQUIRED";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
        return jdbc.queryForObject("SELECT "+COLS+" FROM dbo.vwGiaoDichThanhToan WHERE khoaChongTrung=?",rows,storedKey);
    }
    public List<PaymentTransactionDtos.Response> list(long invoice){invoice(invoice);return jdbc.query("SELECT "+COLS+" FROM dbo.vwGiaoDichThanhToan WHERE maHoaDon=? ORDER BY thoiDiemPhatSinh,maGiaoDichThanhToan",rows,invoice);}
    public PaymentTransactionDtos.PageResponse page(Long invoice,PaymentMethod method,PaymentTransaction.TransactionType type,PaymentTransaction.TransactionStatus status,LocalDateTime from,LocalDateTime to,int page,int size,boolean ascending){
        int p=Math.max(0,page),s=Math.max(1,Math.min(100,size)),offset=p*s;
        String where=" WHERE (? IS NULL OR maHoaDon=?) AND (? IS NULL OR phuongThuc=?) AND (? IS NULL OR loai=?) AND (? IS NULL OR trangThai=?) AND (? IS NULL OR thoiDiemPhatSinh>=?) AND (? IS NULL OR thoiDiemPhatSinh<?)";
        Object[] args={invoice,invoice,method==null?null:methods.convertToDatabaseColumn(method),method==null?null:methods.convertToDatabaseColumn(method),type==null?null:types.convertToDatabaseColumn(type),type==null?null:types.convertToDatabaseColumn(type),status==null?null:statuses.convertToDatabaseColumn(status),status==null?null:statuses.convertToDatabaseColumn(status),from,from,to,to};
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM dbo.vwGiaoDichThanhToan"+where,Long.class,args);
        List<Object> paged=new ArrayList<>(Arrays.asList(args));paged.add(offset);paged.add(s);
        String order=ascending?" ASC":" DESC";
        var items=jdbc.query("SELECT "+COLS+" FROM dbo.vwGiaoDichThanhToan"+where+" ORDER BY thoiDiemPhatSinh"+order+",maGiaoDichThanhToan"+order+" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,paged.toArray());
        return new PaymentTransactionDtos.PageResponse(items,p,s,total,(int)Math.ceil((double)total/s));
    }
    public PaymentTransactionDtos.LedgerPageResponse ledgerPage(Long invoice,PaymentMethod method,PaymentTransaction.TransactionType type,
            PaymentTransaction.TransactionStatus status,LocalDateTime from,LocalDateTime to,String search,int page,int size){
        int p=Math.max(0,page),s=Math.max(1,Math.min(100,size));
        String source=" FROM dbo.vwGiaoDichThanhToan p JOIN dbo.vwHoaDonChiTiet h ON h.maHoaDon=p.maHoaDon";
        String filter=" WHERE (CAST(? AS BIGINT) IS NULL OR p.maHoaDon=?) AND (CAST(? AS NVARCHAR(30)) IS NULL OR p.loai=?)"
            +" AND (CAST(? AS NVARCHAR(30)) IS NULL OR p.trangThai=?) AND (CAST(? AS DATETIME2) IS NULL OR p.thoiDiemPhatSinh>=?)"
            +" AND (CAST(? AS DATETIME2) IS NULL OR p.thoiDiemPhatSinh<?)"
            +" AND (CAST(? AS NVARCHAR(200)) IS NULL OR CHARINDEX(LOWER(?),LOWER(CONCAT(N'PAY-',p.maGiaoDichThanhToan,N' INV-',p.maHoaDon,N' ',h.maPhieuDatPhong,N' ',p.maThamChieu,N' ',p.phuongThuc,N' ',CASE WHEN p.loai=N'Hoàn tiền' THEN N'Hoàn tiền' WHEN h.tongTienDichVu>0 THEN N'Phòng & dịch vụ' ELSE N'Tiền phòng' END) COLLATE DATABASE_DEFAULT))>0)";
        String physicalType=type==null?null:types.convertToDatabaseColumn(type),physicalStatus=status==null?null:statuses.convertToDatabaseColumn(status);
        Object[] args={invoice,invoice,physicalType,physicalType,physicalStatus,physicalStatus,from,from,to,to,search,search};
        Map<String,Long> methodCounts=new LinkedHashMap<>();
        jdbc.query("SELECT p.phuongThuc,COUNT_BIG(*)"+source+filter+" GROUP BY p.phuongThuc",r->{
            methodCounts.put(methods.convertToEntityAttribute(r.getString(1)).name(),r.getLong(2));
        },args);
        String physicalMethod=method==null?null:methods.convertToDatabaseColumn(method);
        filter+=" AND (CAST(? AS NVARCHAR(30)) IS NULL OR p.phuongThuc=?)";
        List<Object> values=new ArrayList<>(Arrays.asList(args));values.add(physicalMethod);values.add(physicalMethod);
        long total=jdbc.queryForObject("SELECT COUNT_BIG(*)"+source+filter,Long.class,values.toArray());
        values.add((long)p*s);values.add(s);
        String columns=Arrays.stream(COLS.split(",")).map(c->"p."+c).reduce((a,b)->a+","+b).orElseThrow();
        var items=jdbc.query("SELECT "+columns+",h.maPhieuDatPhong,h.tongTienDichVu"+source+filter
            +" ORDER BY p.thoiDiemPhatSinh DESC,p.maGiaoDichThanhToan DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            (r,n)->new PaymentTransactionDtos.LedgerResponse(r.getLong(1),r.getLong(2),r.getBigDecimal(3),methods.convertToEntityAttribute(r.getString(4)),
                types.convertToEntityAttribute(r.getString(5)),statuses.convertToEntityAttribute(r.getString(6)),r.getString(7),r.getTimestamp(8).toLocalDateTime(),r.getString(9),r.getLong(10),r.getBigDecimal(11)),values.toArray());
        return new PaymentTransactionDtos.LedgerPageResponse(items,p,s,total,(int)Math.ceil((double)total/s),methodCounts);
    }
}
