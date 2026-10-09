package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.ReceiptDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.persistence.VietnameseEnumConverters.PaymentMethodConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;

@Repository
public class ReceiptDatabase {
    private static final String COLS="maBienLai,soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh";
    private final JdbcTemplate jdbc;
    private final PaymentDatabase payments;
    private final PaymentMethodConverter methods=new PaymentMethodConverter();
    private final RowMapper<ReceiptDtos.Response> rows=(r,n)->new ReceiptDtos.Response(r.getLong(1),r.getString(2),r.getLong(3),r.getBigDecimal(4),methods.convertToEntityAttribute(r.getString(5)),r.getTimestamp(6).toLocalDateTime(),r.getString(7));
    public ReceiptDatabase(JdbcTemplate jdbc,PaymentDatabase payments){this.jdbc=jdbc;this.payments=payments;}
    public PaymentDatabase.InvoiceScope invoice(long id){return payments.invoice(id);}
    public ReceiptDtos.Response issue(long invoice,String number,BigDecimal amount,PaymentMethod method,String actor,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspPhatHanhBienLai ?,?,?,?,?,?",invoice,number,amount,methods.convertToDatabaseColumn(method),actor,now);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 53201->"RECEIPT_EXISTS";case 53101->"INVOICE_NOT_FOUND";case 53202->"INVALID_RECEIPT";case 53203->"RECEIPT_EXCEEDS_PAYMENT";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
        return jdbc.queryForObject("SELECT "+COLS+" FROM dbo.vwBienLai WHERE soBienLai=?",rows,number);
    }
    public ReceiptDtos.PageResponse page(Long invoice,PaymentMethod method,String actor,LocalDateTime from,LocalDateTime to,int page,int size,boolean asc){
        if(invoice!=null)payments.invoice(invoice);
        int p=Math.max(0,page),s=Math.max(1,Math.min(100,size)),offset=p*s;
        String where=" WHERE (CAST(? AS BIGINT) IS NULL OR maHoaDon=?) AND (CAST(? AS NVARCHAR(30)) IS NULL OR phuongThuc=?) AND (CAST(? AS NVARCHAR(50)) IS NULL OR nguoiPhatHanh=?) AND (CAST(? AS DATETIME2) IS NULL OR thoiDiemPhatHanh>=?) AND (CAST(? AS DATETIME2) IS NULL OR thoiDiemPhatHanh<?)";
        Object dbMethod=method==null?null:methods.convertToDatabaseColumn(method);
        Object[] args={invoice,invoice,dbMethod,dbMethod,actor,actor,from,from,to,to};
        long total=jdbc.queryForObject("SELECT COUNT(*) FROM dbo.vwBienLai"+where,Long.class,args);
        List<Object> paged=new ArrayList<>(Arrays.asList(args));paged.add(offset);paged.add(s);String direction=asc?" ASC":" DESC";
        var items=jdbc.query("SELECT "+COLS+" FROM dbo.vwBienLai"+where+" ORDER BY thoiDiemPhatHanh"+direction+",maBienLai"+direction+" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,paged.toArray());
        return new ReceiptDtos.PageResponse(items,p,s,total,(int)Math.ceil((double)total/s));
    }
}
