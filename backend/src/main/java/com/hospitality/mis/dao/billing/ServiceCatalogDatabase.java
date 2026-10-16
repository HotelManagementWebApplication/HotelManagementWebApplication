
package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceAvailabilityDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceConsumptionDto;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceScheduleDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceCategoryConverter;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceUnitConverter;
import java.math.BigDecimal;
import java.sql.*;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

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
    public void createApprovedCatalog(ServiceDtos.CreateRequest request,boolean warehouse,String actor,Long approval,LocalDateTime now){
        command(warehouse?"create-stock":"create",request.id(),request.name(),request.price(),request.unit(),categories.convertToDatabaseColumn(request.category()),null,null,0,actor,approval,now);
    }
    private void command(String command,String id,String name,BigDecimal price,String unit,String category,String description,String image,Integer threshold,String actor,Long approval,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspLenhDanhMucDichVu ?,?,?,?,?,?,?,?,?,?,?,?",command,id,name,price,unit,category,description,image,threshold,actor,approval,now);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 53001->"SERVICE_EXISTS";case 53002->"SERVICE_NOT_FOUND";case 52205->"APPROVAL_REQUIRED";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
    }
    public List<ServiceDtos.PriceHistoryResponse> history(String id){required(id);return jdbc.query("SELECT maLichSuGiaDichVu,maDichVu,gia,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc FROM dbo.vwLichSuGiaDichVu WHERE maDichVu=? ORDER BY thoiDiemHieuLuc DESC,maLichSuGiaDichVu DESC",(r,n)->new ServiceDtos.PriceHistoryResponse(r.getLong(1),r.getString(2),r.getBigDecimal(3),r.getString(4),r.getObject(5,Long.class),r.getTimestamp(6).toLocalDateTime()),id);}
    private static String trim(String value){return value==null||value.isBlank()?null:value.trim();}


    // ServiceAvailabilityDatabase
    @Repository
    public static class ServiceAvailabilityDatabase {
        private final JdbcTemplate jdbc;
        public ServiceAvailabilityDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
        public List<ServiceAvailabilityDtos.Response> list(LocalDateTime from,LocalDateTime to){
            return jdbc.query("SELECT * FROM dbo.fnKhaDungDichVu(?,?) ORDER BY maDichVu",(r,n)->new ServiceAvailabilityDtos.Response(
                r.getString("maDichVu"),r.getString("donViKhaDung"),r.getInt("congSuat"),r.getLong("daDat"),r.getLong("conLai"),
                switch(r.getString("cachTinh")){case "Theo thời lượng"->"DURATION";case "Theo kỳ lưu trú"->"STAY";case "Theo tồn kho"->"STOCK";case "Theo ngày"->"DAILY";case "Qua đêm"->"OVERNIGHT";default->"UNITS";},r.getBoolean("truTon")),from,to);
        }
    }

    // ServiceConsumptionDatabase
    @Repository
    public static class ServiceConsumptionDatabase {
        private final JdbcTemplate jdbc;
        public ServiceConsumptionDatabase(JdbcTemplate jdbc) { this.jdbc=jdbc; }
        public List<ServiceConsumptionDto> list(LocalDate from,LocalDate to) {
            return jdbc.query("SELECT * FROM dbo.vwTieuThuDichVu WHERE thoiDiem>=? AND thoiDiem<? ORDER BY thoiDiem,maLuot",
                (r,n)->new ServiceConsumptionDto(r.getString("maLuot"),r.getString("maDichVu"),r.getTimestamp("thoiDiem").toLocalDateTime(),
                    r.getInt("soLuong"),r.getInt("soLuongMienPhi"),r.getBigDecimal("donGia"),r.getBigDecimal("thanhTien")),from.atStartOfDay(),to.plusDays(1).atStartOfDay());
        }
    }

    // ServiceScheduleDatabase
    @Repository
    public static class ServiceScheduleDatabase {
        private final JdbcTemplate jdbc;
        public ServiceScheduleDatabase(JdbcTemplate jdbc) { this.jdbc=jdbc; }
        public ServiceScheduleDtos.Response get(String id) {
            var rows=jdbc.query("SELECT * FROM dbo.vwCauHinhLichDichVu WHERE maDichVu=?",(r,n)->
                new ServiceScheduleDtos.Response(r.getString("maDichVu"),r.getObject("congSuat",Integer.class),
                    r.getString("donViKhaDung"),r.getObject("soPhutMoiLuot",Integer.class),r.getString("cachTinh"),r.getBoolean("truTon")),id);
            if(rows.isEmpty()) throw new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ");
            return rows.getFirst();
        }
        public ServiceScheduleDtos.Response save(String id,ServiceScheduleDtos.Request request,String mode,String actor) {
            try {
                jdbc.update("EXEC dbo.uspCauHinhLichDichVu ?,?,?,?,?,?,?,?",id,request.capacity(),request.unit().trim(),
                    request.minutesPerUnit(),mode,request.consumesStock(),actor,request.reason().trim());
                return get(id);
            } catch(DataAccessException error) {
                for(Throwable cause=error;cause!=null;cause=cause.getCause()) if(cause instanceof SQLException sql) {
                    if(sql.getErrorCode()==53801) throw new DomainException("SERVICE_SCHEDULE_IN_USE","Còn lượt đặt đang giữ chỗ. Hãy xử lý các lượt đặt trước khi đổi cấu hình.");
                    if(sql.getErrorCode()==53802) throw new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ");
                }
                throw error;
            }
        }
    }
}
