package com.hospitality.mis.dao.operations;

import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.dao.room.RoomStatusConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class FrontDeskDashboardDatabase {
    private final JdbcTemplate jdbc;
    private final VietnameseEnumConverters.ReservationStatusConverter statuses=new VietnameseEnumConverters.ReservationStatusConverter();
    private final VietnameseEnumConverters.DepositPaymentStatusConverter deposits=new VietnameseEnumConverters.DepositPaymentStatusConverter();
    public FrontDeskDashboardDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public long count(String query,ReservationStatus status,LocalDateTime from,LocalDateTime to){
        return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.fnDashboardDatPhong(?,?,'ALL',?,?)",Long.class,query,statuses.convertToDatabaseColumn(status),from,to);
    }
    public List<FrontDeskDashboardDtos.ReservationItem> items(String query,ReservationStatus status,String bucket,LocalDateTime from,LocalDateTime to,int page,int size){
        return jdbc.query("SELECT maPhieuDatPhong,maKhachLuuTru,hoVaTen,soDienThoai,trangThai,thoiDiemNhanPhong,thoiDiemTraPhong,tienDatCoc,trangThaiThanhToanCoc,soTienPhaiTra FROM dbo.fnDashboardDatPhong(?,?,?,?,?) ORDER BY thoiDiemNhanPhong,maPhieuDatPhong OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",this::reservation,query,statuses.convertToDatabaseColumn(status),bucket,from,to,(long)page*size,size);
    }
    public List<FrontDeskDashboardDtos.RoomSummary> rooms(){
        return jdbc.query("SELECT maPhong,ten,trangThai,maLoaiPhong,tenLoaiPhong,tang,giaTheoNgay,loaiGiuong FROM dbo.vwPhongNoiBo ORDER BY maPhong",(r,n)->new FrontDeskDashboardDtos.RoomSummary(r.getString(1),r.getString(2),new RoomStatusConverter().convertToEntityAttribute(r.getString(3)),r.getString(4),r.getString(5),(Integer)r.getObject(6),r.getBigDecimal(7),r.getString(8)));
    }
    public List<FrontDeskDashboardDtos.IncidentItem> incidents(int page,int size){
        return jdbc.query("SELECT maSuCoThietBi,maPhieuDatPhong,maPhong,tienBoiThuong FROM dbo.vwSuCoLeTan ORDER BY maSuCoThietBi OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",(r,n)->new FrontDeskDashboardDtos.IncidentItem(r.getLong(1),(Long)r.getObject(2),r.getString(3),r.getBigDecimal(4)),(long)page*size,size);
    }
    private FrontDeskDashboardDtos.ReservationItem reservation(ResultSet r,int n)throws SQLException{
        long id=r.getLong(1);
        var activeRooms=jdbc.queryForList("SELECT maPhong FROM dbo.vwDatPhongChiTiet WHERE maPhieuDatPhong=? AND trangThaiPhongTrongDatPhong IN(N'Đã giữ phòng',N'Đang có khách') ORDER BY maPhong",String.class,id);
        var deposit=deposits.convertToEntityAttribute(r.getString(9));
        return new FrontDeskDashboardDtos.ReservationItem(id,(Long)r.getObject(2),r.getString(3),r.getString(4),statuses.convertToEntityAttribute(r.getString(5)),dateTime(r,6),dateTime(r,7),activeRooms,r.getBigDecimal(8),deposit==null?null:deposit.name(),r.getBigDecimal(10));
    }
    private static LocalDateTime dateTime(ResultSet r,int index)throws SQLException{var value=r.getTimestamp(index);return value==null?null:value.toLocalDateTime();}
}
