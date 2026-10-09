package com.hospitality.mis.dao.auth;

import com.hospitality.mis.dao.guest.GuestDatabase;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class CustomerAccountDatabase {
    public record Snapshot(Long id,Long guestId,String phone,String password,boolean enabled,boolean accountNonLocked,String email){
        public CustomerAccountDtos.Response response(){return new CustomerAccountDtos.Response(id,guestId,phone,enabled,accountNonLocked);}
    }
    public record RegistrationScope(boolean phoneUsed,boolean emailUsed){}
    private static final String COLUMNS="maTaiKhoanKhachHang,maKhachLuuTru,soDienThoai,matKhau,duocKichHoat,taiKhoanKhongBiKhoa,email";
    private final JdbcTemplate jdbc;
    private final RowMapper<Snapshot> rows=(r,n)->new Snapshot(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getBoolean(5),r.getBoolean(6),r.getString(7));
    public CustomerAccountDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Optional<Snapshot> find(Long id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwTaiKhoanKhachHang WHERE maTaiKhoanKhachHang=?",rows,id).stream().findFirst();}
    public Optional<Snapshot> phone(String phone){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwTaiKhoanKhachHang WHERE soDienThoai=?",rows,phone).stream().findFirst();}
    public Optional<Snapshot> email(String email){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwTaiKhoanKhachHang WHERE LOWER(email)=LOWER(?) ORDER BY maTaiKhoanKhachHang",rows,email).stream().findFirst();}
    public RegistrationScope registrationScope(String phone,String email){return jdbc.queryForObject("EXEC dbo.uspKhoaDangKyTaiKhoan ?,?",(r,n)->new RegistrationScope(r.getBoolean(1),r.getBoolean(2)),phone,email);}
    public Snapshot register(String phone,String name,String identity,String email,String password){Long id=command("register",null,phone,name,identity,email,password);return find(id).orElseThrow();}
    public void password(Long id,String encoded){command("password",id,null,null,null,null,encoded);}
    private Long command(String command,Long id,String phone,String name,String identity,String email,String password){
        try{return jdbc.queryForObject("DECLARE @id BIGINT=?;EXEC dbo.uspLenhTaiKhoanKhachHang ?,@id OUTPUT,?,?,?,?,?;SELECT @id",Long.class,id,command,phone,name,identity,email,password);}
        catch(DataAccessException error){throw GuestDatabase.translate(error);}
    }
}
