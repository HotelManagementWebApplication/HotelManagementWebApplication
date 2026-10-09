
package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceCategoryConverter;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceUnitConverter;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.*;
import java.math.BigDecimal;

@Repository
public class ServiceCatalogDatabase {
    private static final String COLUMNS="maDichVu,ten,gia,donViTinh,danhMuc,moTa,duongDanAnh,soLuongTonKho,nguongAnToan,dangHoatDong";
    private final JdbcTemplate jdbc;
    private final ServiceCategoryConverter categories=new ServiceCategoryConverter();
    private final ServiceUnitConverter units=new ServiceUnitConverter();
    private final RowMapper<ServiceDtos.Response> rows=(r,n)->new ServiceDtos.Response(r.getString(1),r.getString(2),r.getBigDecimal(3),units.convertToEntityAttribute(r.getString(4)),categories.convertToEntityAttribute(r.getString(5)),r.getString(6),r.getString(7),r.getInt(8),r.getInt(9),r.getInt(8)<=r.getInt(9),r.getBoolean(10));
    public ServiceCatalogDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Optional<ServiceDtos.Response> find(String id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwDichVuNoiBo WHERE maDichVu=?",rows,id).stream().findFirst();}
    public ServiceDtos.Response required(String id){return find(id).orElseThrow(()->new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ"));}
    public List<ServiceDtos.Response> all(){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwDichVuNoiBo ORDER BY maDichVu",rows);}
    public List<ServiceDtos.Response> lowStock(){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwDichVuNoiBo WHERE soLuongTonKho<=nguongAnToan ORDER BY ten,maDichVu",rows);}
    public void lock(String id){jdbc.update("EXEC dbo.uspKhoaDichVuDanhMuc ?",id);}
    public void create(ServiceDtos.CreateRequest request,String unit,String category,LocalDateTime now){
        command("create",request.id(),request.name(),request.price(),unit,categories.convertToDatabaseColumn(category),trim(request.description()),trim(request.imageUrl()),request.safetyThreshold(),null,null,now);
    }
    public void price(String id,BigDecimal price,String approver,Long approval,LocalDateTime now){command("price",id,null,price,null,null,null,null,null,approver,approval,now);}
    private void command(String command,String id,String name,BigDecimal price,String unit,String category,String description,String image,Integer threshold,String actor,Long approval,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspLenhDanhMucDichVu ?,?,?,?,?,?,?,?,?,?,?,?",command,id,name,price,unit,category,description,image,threshold,actor,approval,now);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 53001->"SERVICE_EXISTS";case 53002->"SERVICE_NOT_FOUND";case 52205->"APPROVAL_REQUIRED";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
    }
    public List<ServiceDtos.PriceHistoryResponse> history(String id){required(id);return jdbc.query("SELECT maLichSuGiaDichVu,maDichVu,gia,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc FROM dbo.vwLichSuGiaDichVu WHERE maDichVu=? ORDER BY thoiDiemHieuLuc DESC,maLichSuGiaDichVu DESC",(r,n)->new ServiceDtos.PriceHistoryResponse(r.getLong(1),r.getString(2),r.getBigDecimal(3),r.getString(4),r.getObject(5,Long.class),r.getTimestamp(6).toLocalDateTime()),id);}
    private static String trim(String value){return value==null||value.isBlank()?null:value.trim();}
}
