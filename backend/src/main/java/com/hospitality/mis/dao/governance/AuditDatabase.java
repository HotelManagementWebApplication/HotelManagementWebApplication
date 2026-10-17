package com.hospitality.mis.dao.governance;

import com.hospitality.mis.dto.governance.AuditDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.*;
import java.time.*;
import java.util.List;

/** Explicit immutable read model; all audit writes pass through the append command. */
@Repository
public class AuditDatabase {
    private static final String COLUMNS="maNhatKyKiemSoat,nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,khoaLienKet,thoiDiemTao";
    private final JdbcTemplate jdbc;
    private final RowMapper<AuditDtos.Response> rows=(r,n)->new AuditDtos.Response(r.getLong(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getString(8),r.getString(9),r.getObject(10,OffsetDateTime.class).toInstant());
    public AuditDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void append(String actor,String action,String type,String id,String before,String after,String reason,String correlation,Instant now){
        jdbc.update("EXEC dbo.uspGhiNhatKyKiemSoat ?,?,?,?,?,?,?,?,?",actor,action,type,id,before,after,reason,correlation,now.atOffset(ZoneOffset.UTC));
    }
    public List<AuditDtos.Response> list(String actor){return jdbc.query("SELECT TOP(100) "+COLUMNS+" FROM dbo.vwNhatKyKiemSoat WHERE (? IS NULL OR nguoiThucHien=?) ORDER BY thoiDiemTao DESC,maNhatKyKiemSoat DESC",rows,actor,actor);}
    public List<AuditDtos.Response> timeline(String type,String id){return jdbc.query("SELECT TOP(100) "+COLUMNS+" FROM dbo.vwNhatKyKiemSoat WHERE loaiDoiTuong=? AND maDoiTuong=? ORDER BY thoiDiemTao,maNhatKyKiemSoat",rows,type,id);}
    public Page<AuditDtos.Response> page(String actor,String action,String type,String id,String correlation,Instant from,Instant to,int page,int size){
        String filter=" WHERE (? IS NULL OR nguoiThucHien=?) AND (? IS NULL OR hanhDong=?) AND (? IS NULL OR loaiDoiTuong=?) AND (? IS NULL OR maDoiTuong=?) AND (? IS NULL OR khoaLienKet=?) AND (? IS NULL OR thoiDiemTao>=?) AND (? IS NULL OR thoiDiemTao<?)";
        Object fromTime=from==null?null:from.atOffset(ZoneOffset.UTC),toTime=to==null?null:to.atOffset(ZoneOffset.UTC);
        Object[] args={actor,actor,action,action,type,type,id,id,correlation,correlation,fromTime,fromTime,toTime,toTime};
        long total=jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwNhatKyKiemSoat"+filter,Long.class,args);
        Object[] pageArgs=java.util.Arrays.copyOf(args,args.length+2);pageArgs[args.length]=(long)page*size;pageArgs[args.length+1]=size;
        var content=jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwNhatKyKiemSoat"+filter+" ORDER BY thoiDiemTao DESC,maNhatKyKiemSoat DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",rows,pageArgs);
        return new PageImpl<>(content,PageRequest.of(page,size),total);
    }
}
