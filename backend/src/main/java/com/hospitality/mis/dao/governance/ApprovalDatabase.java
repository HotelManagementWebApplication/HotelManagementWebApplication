package com.hospitality.mis.dao.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters.*;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.util.*;

@Repository
public class ApprovalDatabase {
    private static final String COLUMNS="maYeuCauPheDuyet,nguoiYeuCau,hanhDong,maDoiTuong,duLieuThayDoi,soTien,lyDo,mucDoRuiRo,trangThai,nguoiPheDuyet,thoiDiemQuyetDinh,thoiDiemHetHan,thoiDiemSuDung,thoiDiemYeuCau,khoaLienKet";
    private final JdbcTemplate jdbc;
    private final ApprovalActionConverter actions=new ApprovalActionConverter();
    private final ApprovalStatusConverter statuses=new ApprovalStatusConverter();
    private final PriorityConverter risks=new PriorityConverter();
    private final RowMapper<ApprovalDtos.Response> rows=(r,n)->new ApprovalDtos.Response(r.getLong(1),r.getString(2),actions.convertToEntityAttribute(r.getString(3)),r.getString(4),r.getString(5),r.getBigDecimal(6),r.getString(7),risks.convertToEntityAttribute(r.getString(8)),statuses.convertToEntityAttribute(r.getString(9)),r.getString(10),instant(r,11),instant(r,12),instant(r,13),instant(r,14),r.getString(15));
    public ApprovalDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private static Instant instant(ResultSet row,int index)throws SQLException{var value=row.getObject(index,OffsetDateTime.class);return value==null?null:value.toInstant();}
    public Optional<ApprovalDtos.Response> find(Long id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwYeuCauPheDuyet WHERE maYeuCauPheDuyet=?",rows,id).stream().findFirst();}
    public ApprovalDtos.Response replayRequest(String actor,String key){return jdbc.queryForObject("SELECT TOP(1) "+COLUMNS+" FROM dbo.vwYeuCauPheDuyet WHERE nguoiYeuCau=? AND khoaLienKet=? ORDER BY maYeuCauPheDuyet",rows,actor,key);}
    public ApprovalDtos.Response command(String command,Long id,String actor,String action,String target,String payload,String hash,BigDecimal amount,String reason,String risk,String key,boolean director,Instant now){
        String sql="DECLARE @id BIGINT=?;EXEC dbo.uspLenhPheDuyet ?,@id OUTPUT,?,?,?,?,?,?,?,?,?,?,?;SELECT "+COLUMNS+" FROM dbo.vwYeuCauPheDuyet WHERE maYeuCauPheDuyet=@id";
        try{return jdbc.queryForObject(sql,rows,id,command,actor,actions.convertToDatabaseColumn(action),target,payload,hash,amount,reason,risks.convertToDatabaseColumn(risk),key,director,now.atOffset(ZoneOffset.UTC));}
        catch(DataAccessException error){throw translate(error);}
    }
    public void expire(Instant now){jdbc.update("DECLARE @id BIGINT;EXEC dbo.uspLenhPheDuyet N'expire',@id OUTPUT,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,?",now.atOffset(ZoneOffset.UTC));}
    public List<ApprovalDtos.Response> list(String status,String requester,String action){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwYeuCauPheDuyet WHERE (? IS NULL OR trangThai=?) AND (? IS NULL OR nguoiYeuCau=?) AND (? IS NULL OR hanhDong=?) ORDER BY maYeuCauPheDuyet DESC",rows,statuses.convertToDatabaseColumn(status),statuses.convertToDatabaseColumn(status),requester,requester,actions.convertToDatabaseColumn(action),actions.convertToDatabaseColumn(action));}
    public Page<ApprovalDtos.Response> page(String status,String action,String target,String requester,String risk,Instant from,Instant to,int page,int size){
        String filter=" WHERE trangThai=? AND (? IS NULL OR hanhDong=?) AND (? IS NULL OR maDoiTuong=?) AND (? IS NULL OR nguoiYeuCau=?) AND (? IS NULL OR mucDoRuiRo=?) AND (? IS NULL OR thoiDiemYeuCau>=?) AND (? IS NULL OR thoiDiemYeuCau<?)";
        String physicalAction=actions.convertToDatabaseColumn(action),physicalRisk=risks.convertToDatabaseColumn(risk);
        Object fromTime=from==null?null:from.atOffset(ZoneOffset.UTC),toTime=to==null?null:to.atOffset(ZoneOffset.UTC);
        Object[] args={statuses.convertToDatabaseColumn(status),physicalAction,physicalAction,target,target,requester,requester,physicalRisk,physicalRisk,fromTime,fromTime,toTime,toTime};
        long total=jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwYeuCauPheDuyet"+filter,Long.class,args);
        Object[] paged=Arrays.copyOf(args,args.length+2);paged[args.length]=(long)page*size;paged[args.length+1]=size;
        return new PageImpl<>(jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwYeuCauPheDuyet"+filter+" ORDER BY maYeuCauPheDuyet DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,paged),PageRequest.of(page,size),total);
    }
    private RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){case 52201->"APPROVAL_NOT_FOUND";case 52202->"APPROVAL_EXPIRED";case 52203->"DIRECTOR_APPROVAL_REQUIRED";case 52204->"APPROVAL_ALREADY_DECIDED";case 52205->"APPROVAL_REQUIRED";case 52206->"SELF_APPROVAL_FORBIDDEN";default->null;};
            if(code!=null)return new DomainException(code,sql.getMessage());
        }
        return error;
    }
}
