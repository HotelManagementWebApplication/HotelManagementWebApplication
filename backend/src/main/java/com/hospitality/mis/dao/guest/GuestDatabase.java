package com.hospitality.mis.dao.guest;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.guest.*;
import com.hospitality.mis.persistence.VietnameseEnumConverters.MembershipTierConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.util.*;

@Repository
public class GuestDatabase {
    public record Snapshot(GuestDtos.Response response,int completedStays,long version){}
    private static final String COLUMNS="maKhachLuuTru,hoVaTen,namSinh,soGiayToTuyThan,soDienThoai,email,diaChi,hangThanhVien,tongChiTieu,soLanHuyMuon,soLanTraPhongMuon,biChanDatPhong,soLanLuuTruHoanThanh,phienBan";
    private final JdbcTemplate jdbc;
    private final MembershipTierConverter tiers=new MembershipTierConverter();
    private final RowMapper<Snapshot> rows=(r,n)->new Snapshot(new GuestDtos.Response(r.getLong(1),r.getString(2),r.getObject(3,Integer.class),r.getString(4),r.getString(5),r.getString(6),r.getString(7),tiers.convertToEntityAttribute(r.getString(8)),r.getBigDecimal(9),r.getInt(10),r.getInt(11),r.getBoolean(12)),r.getInt(13),r.getLong(14));
    public GuestDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Optional<Snapshot> find(Long id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwKhachLuuTru WHERE maKhachLuuTru=?",rows,id).stream().findFirst();}
    public void lockRegistration(){jdbc.update("EXEC dbo.uspKhoaDangKyTaiKhoan NULL,NULL,0");}
    public boolean phoneExists(String phone){return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwKhachLuuTru WHERE soDienThoai=?",Long.class,phone)>0;}
    public boolean identityExists(String identity){return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwKhachLuuTru WHERE soGiayToTuyThan=?",Long.class,identity)>0;}
    public List<GuestDtos.Response> search(String query){
        String filter=query==null||query.isBlank()?null:"%"+query.trim()+"%";
        return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwKhachLuuTru WHERE ? IS NULL OR LOWER(hoVaTen) LIKE LOWER(?) OR soGiayToTuyThan LIKE ? OR soDienThoai LIKE ? ORDER BY hoVaTen,maKhachLuuTru",rows,filter,filter,filter,filter).stream().map(Snapshot::response).toList();
    }
    public GuestDtos.Response create(GuestDtos.CreateRequest request){Long id=command("create",null,request.fullName(),request.identityNumber(),request.phone(),request.email(),request.address(),request.birthYear(),null);return find(id).orElseThrow().response();}
    public GuestDtos.Response profile(Long id,String name,String identity,String email,String address,Integer year,long version){command("profile",id,name,identity,null,email,address,year,version);return find(id).orElseThrow().response();}
    private Long command(String command,Long id,String name,String identity,String phone,String email,String address,Integer year,Long version){
        try{return jdbc.queryForObject("DECLARE @id BIGINT=?;EXEC dbo.uspLenhKhachLuuTru ?,@id OUTPUT,?,?,?,?,?,?,?;SELECT @id",Long.class,id,command,name,identity,phone,email,address,year,version);}
        catch(DataAccessException error){throw translate(error);}
    }
    public List<MembershipHistoryDtos.Response> history(Long id){return jdbc.query("SELECT maLichSuHangThanhVien,maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi FROM dbo.vwLichSuHangThanhVien WHERE maKhachLuuTru=? ORDER BY thoiDiemThayDoi DESC,maLichSuHangThanhVien DESC",(r,n)->new MembershipHistoryDtos.Response(r.getLong(1),r.getLong(2),tiers.convertToEntityAttribute(r.getString(3)),tiers.convertToEntityAttribute(r.getString(4)),r.getString(5),r.getTimestamp(6).toLocalDateTime()),id);}
    public static RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 52602->"PHONE_ALREADY_IN_USE";case 52701->"GUEST_PHONE_EXISTS";case 52702->"GUEST_IDENTITY_EXISTS";case 52703->"GUEST_NOT_FOUND";case 52704->"EMAIL_ALREADY_IN_USE";case 52705->"GUEST_IDENTITY_MISMATCH";case 52706->"CUSTOMER_ACCOUNT_NOT_FOUND";case 51003->"VERSION_CONFLICT";default->null;};if(code!=null)return new DomainException(code,sql.getMessage());}return error;
    }
}
