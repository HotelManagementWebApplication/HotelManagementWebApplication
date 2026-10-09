package com.hospitality.mis.dao.finance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.*;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ShiftCodeConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.*;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.*;

@Repository
public class FinanceDatabase {
    public record LedgerTotal(FinancialLedgerEntry.Direction direction,BigDecimal amount){}
    private static final String CASH="maBanGiaoTienCa,maCa,nguoiBanGiao,nguoiNhanBanGiao,soTienDuKien,soTienThucTe,chenhLech,thoiDiemBanGiao,ghiChu";
    private static final String EXPENSE="maKhoanChi,danhMuc,moTa,soTien,nguoiChiTra,thoiDiemChiTra,trangThai";
    private static final String DEBT="maCongNoDoiTac,tenDoiTac,maThamChieu,soTien,soTienDaThanhToan,trangThai,thoiDiemGhiNhan";
    private static final String LEDGER="maButToanTaiChinh,loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ShiftCodeConverter shifts=new ShiftCodeConverter();
    private final ExpenseStatusConverter expenseStatuses=new ExpenseStatusConverter();
    private final DebtStatusConverter debtStatuses=new DebtStatusConverter();
    private final LedgerDirectionConverter directions=new LedgerDirectionConverter();
    private final RowMapper<FinanceDtos.CashHandoverResponse> cashRows=(r,n)->new FinanceDtos.CashHandoverResponse(r.getLong(1),shifts.convertToEntityAttribute(r.getString(2)),r.getString(3),r.getString(4),r.getBigDecimal(5),r.getBigDecimal(6),r.getBigDecimal(7),r.getTimestamp(8).toLocalDateTime(),r.getString(9),List.of());
    private final RowMapper<FinanceDtos.ExpenseResponse> expenseRows=(r,n)->new FinanceDtos.ExpenseResponse(r.getLong(1),r.getString(2),r.getString(3),r.getBigDecimal(4),r.getString(5),r.getTimestamp(6).toLocalDateTime(),expenseStatuses.convertToEntityAttribute(r.getString(7)));
    private final RowMapper<FinanceDtos.PartnerDebtResponse> debtRows=(r,n)->new FinanceDtos.PartnerDebtResponse(r.getLong(1),r.getString(2),r.getString(3),r.getBigDecimal(4),r.getBigDecimal(5),debtStatuses.convertToEntityAttribute(r.getString(6)),r.getTimestamp(7).toLocalDateTime());
    private final RowMapper<FinanceDtos.LedgerEntryResponse> ledgerRows=(r,n)->new FinanceDtos.LedgerEntryResponse(r.getLong(1),r.getString(2),r.getString(3),r.getString(4),directions.convertToEntityAttribute(r.getString(5)).name(),r.getBigDecimal(6),r.getString(7),r.getTimestamp(8).toLocalDateTime(),r.getString(9),r.getBoolean(10));
    public FinanceDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    public FinanceDtos.CashHandoverResponse handover(FinanceDtos.CashHandoverRequest request,String actor,String key,LocalDateTime now){
        String lines;
        try{lines=mapper.writeValueAsString(request.denominations()==null?List.of():request.denominations());}catch(JsonProcessingException error){throw new IllegalStateException(error);}
        Long id=command("handover",null,actor,shifts.convertToDatabaseColumn(request.shiftCode().trim()),request.toActor().trim(),request.actualAmount(),lines,request.note(),key,now);
        return denominations(jdbc.queryForObject("SELECT "+CASH+" FROM dbo.vwBanGiaoTienCa WHERE maBanGiaoTienCa=?",cashRows,id));
    }
    public FinanceDtos.ExpenseResponse expense(FinanceDtos.ExpenseRequest request,String actor,String key,LocalDateTime now){
        Long id=command("expense",null,actor,request.category().trim(),request.description().trim(),request.amount(),null,null,key,now);
        return jdbc.queryForObject("SELECT "+EXPENSE+" FROM dbo.vwKhoanChi WHERE maKhoanChi=?",expenseRows,id);
    }
    public FinanceDtos.PartnerDebtResponse debt(FinanceDtos.PartnerDebtRequest request,String actor,String key,LocalDateTime now){
        Long id=command("debt",null,actor,request.partnerName().trim(),request.referenceCode().trim(),request.amount(),null,null,key,now);return debt(id).orElseThrow();
    }
    public FinanceDtos.PartnerDebtResponse settle(Long id,FinanceDtos.DebtSettlementRequest request,String actor,String key,LocalDateTime now){
        command("settle",id,actor,null,null,request.amount(),null,request.note(),key,now);return debt(id).orElseThrow();
    }
    private Long command(String command,Long id,String actor,String first,String second,BigDecimal amount,String lines,String note,String key,LocalDateTime now){
        try{return jdbc.queryForObject("DECLARE @id BIGINT=?;EXEC dbo.uspLenhTaiChinh ?,@id OUTPUT,?,?,?,?,?,?,?,?,?;SELECT @id",Long.class,id,command,actor,first,second,amount,lines,note,key,amount.toPlainString(),now);}
        catch(DataAccessException error){throw translate(error);}
    }
    private RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){case 52301->"INVALID_DENOMINATION";case 52302->"DENOMINATION_TOTAL_MISMATCH";case 52303->"PARTNER_DEBT_EXISTS";case 52304->"PARTNER_DEBT_NOT_FOUND";case 52305->"INVALID_DEBT_STATE";case 52306->"INVALID_DEBT_SETTLEMENT";default->null;};
            if(code!=null)return new DomainException(code,sql.getMessage());
        }
        return error;
    }
    public List<FinanceDtos.CashHandoverResponse> handovers(){return jdbc.query("SELECT "+CASH+" FROM dbo.vwBanGiaoTienCa ORDER BY thoiDiemBanGiao DESC,maBanGiaoTienCa DESC",cashRows).stream().map(this::denominations).toList();}
    public List<FinanceDtos.ExpenseResponse> expenses(){return jdbc.query("SELECT "+EXPENSE+" FROM dbo.vwKhoanChi ORDER BY thoiDiemChiTra DESC,maKhoanChi DESC",expenseRows);}
    public List<FinanceDtos.PartnerDebtResponse> debts(){return jdbc.query("SELECT "+DEBT+" FROM dbo.vwCongNoDoiTac ORDER BY thoiDiemGhiNhan DESC,maCongNoDoiTac DESC",debtRows);}
    private FinanceDtos.CashHandoverResponse denominations(FinanceDtos.CashHandoverResponse row){
        var lines=jdbc.query("SELECT menhGia,soLuong FROM dbo.vwChiTietTienBanGiao WHERE maBanGiaoTienCa=? ORDER BY maChiTietTienBanGiao",(r,n)->new FinanceDtos.DenominationLine(r.getBigDecimal(1),r.getInt(2)),row.id());
        return new FinanceDtos.CashHandoverResponse(row.id(),row.shiftCode(),row.fromActor(),row.toActor(),row.expectedAmount(),row.actualAmount(),row.variance(),row.handedOverAt(),row.note(),lines);
    }
    public Optional<FinanceDtos.PartnerDebtResponse> debt(Long id){return jdbc.query("SELECT "+DEBT+" FROM dbo.vwCongNoDoiTac WHERE maCongNoDoiTac=?",debtRows,id).stream().findFirst();}
    public List<FinanceDtos.DebtSettlementResponse> settlements(Long id){
        if(debt(id).isEmpty())throw new DomainException("PARTNER_DEBT_NOT_FOUND","Không tìm thấy công nợ đối tác");
        return jdbc.query("SELECT maThanhToanCongNo,maCongNoDoiTac,soTien,nguoiThanhToan,thoiDiemThanhToan,ghiChu FROM dbo.vwThanhToanCongNoDoiTac WHERE maCongNoDoiTac=? ORDER BY thoiDiemThanhToan,maThanhToanCongNo",(r,n)->new FinanceDtos.DebtSettlementResponse(r.getLong(1),r.getLong(2),r.getBigDecimal(3),r.getString(4),r.getTimestamp(5).toLocalDateTime(),r.getString(6)),id);
    }
    public Page<FinanceDtos.CashHandoverResponse> handovers(String shift,String actor,LocalDateTime from,LocalDateTime to,int page,int size){
        String physical=shifts.convertToDatabaseColumn(shift);
        var result=page("vwBanGiaoTienCa",CASH," WHERE (? IS NULL OR maCa=?) AND (? IS NULL OR nguoiBanGiao=? OR nguoiNhanBanGiao=?) AND (? IS NULL OR thoiDiemBanGiao>=?) AND (? IS NULL OR thoiDiemBanGiao<?)","thoiDiemBanGiao DESC,maBanGiaoTienCa DESC",cashRows,new Object[]{physical,physical,actor,actor,actor,from,from,to,to},page,size);
        return result.map(this::denominations);
    }
    public Page<FinanceDtos.ExpenseResponse> expenses(String category,Expense.ExpenseStatus status,LocalDateTime from,LocalDateTime to,int page,int size){
        String physical=expenseStatuses.convertToDatabaseColumn(status);
        return page("vwKhoanChi",EXPENSE," WHERE (? IS NULL OR danhMuc=?) AND (? IS NULL OR trangThai=?) AND (? IS NULL OR thoiDiemChiTra>=?) AND (? IS NULL OR thoiDiemChiTra<?)","thoiDiemChiTra DESC,maKhoanChi DESC",expenseRows,new Object[]{category,category,physical,physical,from,from,to,to},page,size);
    }
    public Page<FinanceDtos.PartnerDebtResponse> debts(String partner,PartnerDebt.DebtStatus status,LocalDateTime from,LocalDateTime to,int page,int size){
        String physical=debtStatuses.convertToDatabaseColumn(status);
        return page("vwCongNoDoiTac",DEBT," WHERE (? IS NULL OR LOWER(tenDoiTac) LIKE LOWER(N'%'+?+N'%')) AND (? IS NULL OR trangThai=?) AND (? IS NULL OR thoiDiemGhiNhan>=?) AND (? IS NULL OR thoiDiemGhiNhan<?)","thoiDiemGhiNhan DESC,maCongNoDoiTac DESC",debtRows,new Object[]{partner,partner,physical,physical,from,from,to,to},page,size);
    }
    public Page<FinanceDtos.LedgerEntryResponse> ledger(String type,LocalDateTime from,LocalDateTime to,int page,int size){
        return page("vwButToanTaiChinh",LEDGER," WHERE daChotSo=1 AND (? IS NULL OR loaiButToan=?) AND (? IS NULL OR thoiDiemPhatSinh>=?) AND (? IS NULL OR thoiDiemPhatSinh<?)","thoiDiemPhatSinh DESC,maButToanTaiChinh DESC",ledgerRows,new Object[]{type,type,from,from,to,to},page,size);
    }
    /** Identifiers here are private constants, never supplied by a request. */
    private <T> Page<T> page(String view,String columns,String filter,String order,RowMapper<T> rows,Object[] args,int page,int size){
        long count=jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo."+view+filter,Long.class,args);
        Object[] paged=Arrays.copyOf(args,args.length+2);paged[args.length]=(long)page*size;paged[args.length+1]=size;
        return new PageImpl<>(jdbc.query("SELECT "+columns+" FROM dbo."+view+filter+" ORDER BY "+order+" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,paged),PageRequest.of(page,size),count);
    }
    public List<LedgerTotal> ledgerTotals(String type,LocalDateTime from,LocalDateTime to){return jdbc.query("SELECT chieuButToan,COALESCE(SUM(soTien),0) FROM dbo.vwButToanTaiChinh WHERE daChotSo=1 AND loaiButToan=? AND thoiDiemPhatSinh>=? AND thoiDiemPhatSinh<? GROUP BY chieuButToan",(r,n)->new LedgerTotal(directions.convertToEntityAttribute(r.getString(1)),r.getBigDecimal(2)),type,from,to);}
    public BigDecimal outstandingDebt(){return jdbc.queryForObject("SELECT COALESCE(SUM(soTien-soTienDaThanhToan),0) FROM dbo.vwCongNoDoiTac",BigDecimal.class);}
    public void ledger(String type,String sourceType,String sourceId,FinancialLedgerEntry.Direction direction,BigDecimal amount,String actor,LocalDateTime now,String note){
        jdbc.update("EXEC dbo.uspGhiButToanTaiChinh ?,?,?,?,?,?,?,?",type,sourceType,sourceId,directions.convertToDatabaseColumn(direction),amount,actor,now,note);
    }
}
