package com.hospitality.mis.dao.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.RoomMediaDtos;
import com.hospitality.mis.service.room.RoomImageStorage;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.util.List;
import java.util.function.Supplier;

@Repository
public class RoomMediaDatabase {
    private final JdbcTemplate jdbc;
    public RoomMediaDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void requireRoom(String room){
        if(jdbc.queryForObject("SELECT COUNT(*) FROM dbo.vwPhongNoiBo WHERE maPhong=?",Integer.class,room)==0)throw new DomainException("ROOM_NOT_FOUND","Không tìm thấy phòng: "+room);
    }
    public long imageCount(String room){return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwHinhAnhPhongNoiBo WHERE maPhong=? AND dangHoatDong=1",Long.class,room);}
    public List<String> allPaths(){return jdbc.queryForList("SELECT duongDanTuongDoi FROM dbo.vwHinhAnhPhongNoiBo",String.class);}
    public List<RoomMediaDtos.ImageResponse> images(String room){return jdbc.query("SELECT maHinhAnhPhong,duongDanTuongDoi,thuTuHienThi,laAnhBia,loaiNoiDung,kichThuocByte FROM dbo.vwHinhAnhPhongNoiBo WHERE maPhong=? AND dangHoatDong=1 ORDER BY thuTuHienThi,maHinhAnhPhong",(r,n)->new RoomMediaDtos.ImageResponse(r.getLong(1),"/media/rooms/"+r.getString(2),r.getInt(3),r.getBoolean(4),r.getString(5),r.getLong(6)),room);}
    public List<String> amenityNames(String room){return jdbc.queryForList("SELECT a.ten FROM dbo.vwTienNghiTheoLoaiPhong a JOIN dbo.vwPhongNoiBo p ON p.maLoaiPhong=a.maLoaiPhong WHERE p.maPhong=? AND a.dangHoatDong=1 ORDER BY a.ten,a.maTienNghi",String.class,room);}
    public RoomMediaDtos.ImageResponse upload(String room,RoomImageStorage.StoredImage stored,String actor){
        long id=command(()->jdbc.queryForObject("EXEC dbo.uspThemAnhPhong ?,?,?,?,?",Long.class,room,stored.relativePath(),stored.contentType(),stored.sizeBytes(),actor));
        return images(room).stream().filter(r->r.id()==id).findFirst().orElseThrow();
    }
    public String delete(String room,long image,String actor){return command(()->jdbc.queryForObject("EXEC dbo.uspXoaAnhPhong ?,?,?",String.class,room,image,actor));}
    public List<RoomMediaDtos.AmenityResponse> amenities(){return jdbc.query("SELECT maTienNghi,ten,dangHoatDong FROM dbo.vwTienNghiNoiBo ORDER BY ten,maTienNghi",(r,n)->new RoomMediaDtos.AmenityResponse(r.getLong(1),r.getString(2),r.getBoolean(3)));}
    public RoomMediaDtos.AmenityResponse amenity(long id){return jdbc.query("SELECT maTienNghi,ten,dangHoatDong FROM dbo.vwTienNghiNoiBo WHERE maTienNghi=?",(r,n)->new RoomMediaDtos.AmenityResponse(r.getLong(1),r.getString(2),r.getBoolean(3)),id).stream().findFirst().orElseThrow(()->new DomainException("AMENITY_NOT_FOUND","Không tìm thấy tiện nghi"));}
    public RoomMediaDtos.AmenityResponse createAmenity(String name,String actor){long id=command(()->jdbc.queryForObject("EXEC dbo.uspTaoTienNghi ?,?",Long.class,name,actor));return amenity(id);}
    public RoomMediaDtos.AmenityResponse updateAmenity(long id,String name,Boolean active,String actor){command(()->jdbc.update("EXEC dbo.uspSuaTienNghi ?,?,?,?",id,name,active,actor));return amenity(id);}
    public List<RoomMediaDtos.AmenityResponse> assign(String type,List<Long> ids,String actor){
        command(()->jdbc.update("EXEC dbo.uspGanTienNghiLoaiPhong ?,?,?,?",type,ids.toString(),ids.toString(),actor));
        return jdbc.query("SELECT maTienNghi,ten,dangHoatDong FROM dbo.vwTienNghiTheoLoaiPhong WHERE maLoaiPhong=? ORDER BY maTienNghi",(r,n)->new RoomMediaDtos.AmenityResponse(r.getLong(1),r.getString(2),r.getBoolean(3)),type);
    }
    private <T> T command(Supplier<T> operation){
        try{return operation.get();}catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
                String code=switch(sql.getErrorCode()){case 51401->"ROOM_NOT_FOUND";case 51402->"ROOM_IMAGE_LIMIT";case 51403->"ROOM_IMAGE_NOT_FOUND";case 51404->"AMENITY_ALREADY_EXISTS";case 51405->"AMENITY_NOT_FOUND";case 51406->"ROOM_TYPE_NOT_FOUND";default->null;};
                if(code!=null)throw new DomainException(code,sql.getMessage());
            }
            throw error;
        }
    }
}
