package com.hospitality.mis.dao.reservation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.reservation.*;
import com.hospitality.mis.entity.reservation.*;
import com.hospitality.mis.persistence.VietnameseEnumConverters.*;
import com.hospitality.mis.persistence.VietnameseCodeConverters.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.*;

/** Reservation projections and SQL Server commands; no managed entity state. */
@Repository
public class ReservationDatabase {
    public record Snapshot(ReservationDtos.Response response,Long customerId,String paymentCode,
            LocalDateTime expiresAt,String pendingType,LocalDateTime previousCheckIn,
            LocalDateTime previousCheckOut,BigDecimal additionalDeposit,long version,
            List<CustomerReservationDtos.RoomLine> customerRooms) {}
    public record Document(String type,long id) {}
    private static final String COLUMNS="maPhieuDatPhong,maKhachLuuTru,maNhanVien,maTaiKhoanKhachHang,thoiDiemDat,trangThai,hinhThucThue,tienDatCoc,trangThaiThanhToanCoc,thoiDiemNhanPhongThucTe,thoiDiemTraPhongThucTe,lyDoHuy,ketQuaHuy,soPhutGiaHan,khoaChongTrung,maThanhToanDatCoc,thoiDiemHetHanThanhToanCoc,phuongThucBaoDam,loaiThayDoiDangCho,thoiDiemNhanPhongTruocThayDoi,thoiDiemTraPhongTruocThayDoi,tienDatCocTruocThayDoi,tienDatCocBoSung,emailXacNhan,nguonDatPhong,doanhThuGopOta,hoaHongOta,trangThaiDoiSoatOta,phienBan,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThaiPhongTrongDatPhong,soLuongKhach,tenPhong,tenLoaiPhong,giaTheoNgay,giaTheoGio,tongTienPhongDuKien";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ReservationStatusConverter statuses=new ReservationStatusConverter();
    private final RentalTypeConverter rentals=new RentalTypeConverter();
    private final DepositPaymentStatusConverter deposits=new DepositPaymentStatusConverter();
    private final CustomerPaymentMethodConverter methods=new CustomerPaymentMethodConverter();
    private final CancellationOutcomeConverter cancellations=new CancellationOutcomeConverter();
    private final BookingSourceConverter sources=new BookingSourceConverter();
    private final OtaReconciliationStatusConverter ota=new OtaReconciliationStatusConverter();
    public ReservationDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}

    public Snapshot get(long id){return load(" WHERE maPhieuDatPhong=?",id).stream().findFirst()
        .orElseThrow(()->error("RESERVATION_NOT_FOUND","Không tìm thấy đặt phòng"));}
    public Snapshot customer(long id,long customer){return load(" WHERE maPhieuDatPhong=? AND maTaiKhoanKhachHang=?",id,customer).stream().findFirst()
        .orElseThrow(()->error("RESERVATION_NOT_FOUND","Không tìm thấy booking"));}
    public Snapshot byKey(String key){return load(" WHERE khoaChongTrung=?",key).stream().findFirst()
        .orElseThrow(()->error("IDEMPOTENCY_RESULT_NOT_FOUND","Không tìm thấy booking đã ghi nhận"));}
    public List<Snapshot> customers(long customer){return load(" WHERE maTaiKhoanKhachHang=?",customer);}
    public ReservationDtos.PageResponse page(String actor,ReservationStatus status,Long guest,int page,int size){
        String where=" WHERE (CAST(? AS NVARCHAR(10)) IS NULL OR maNhanVien=?) AND (CAST(? AS NVARCHAR(30)) IS NULL OR trangThai=?) AND (CAST(? AS BIGINT) IS NULL OR maKhachLuuTru=?)";
        Object[] args={actor,actor,statuses.convertToDatabaseColumn(status),statuses.convertToDatabaseColumn(status),guest,guest};
        long count=jdbc.queryForObject("SELECT COUNT(DISTINCT maPhieuDatPhong) FROM dbo.vwDatPhongChiTiet"+where,Long.class,args);
        List<Object> values=new ArrayList<>(Arrays.asList(args));values.add(page*size);values.add(size);
        var ids=jdbc.queryForList("SELECT maPhieuDatPhong FROM dbo.vwDatPhongChiTiet"+where+" GROUP BY maPhieuDatPhong,thoiDiemDat ORDER BY thoiDiemDat DESC,maPhieuDatPhong DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",Long.class,values.toArray());
        return new ReservationDtos.PageResponse(ids.stream().map(this::get).map(Snapshot::response).toList(),page,size,count,(int)Math.ceil((double)count/size));
    }
    public List<Document> documents(long reservation){return jdbc.query("SELECT loaiDoiTuong,maDoiTuong FROM dbo.vwTaiLieuTaiChinhDatPhong WHERE maPhieuDatPhong=? ORDER BY loaiDoiTuong,maDoiTuong",(r,n)->new Document(r.getString(1),r.getLong(2)),reservation);}

    public long create(long guest,String employee,Long customer,ReservationDtos.RentalType rental,BigDecimal deposit,
            String key,List<ReservationDtos.RoomStay> rooms,String actor,LocalDateTime now,ReservationStatus initial,
            CustomerPaymentMethod method,String paymentCode,LocalDateTime expires,String email,String source){
        try{return jdbc.queryForObject("EXEC dbo.uspTaoDatPhong ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?",Long.class,
            guest,employee,customer,rentals.convertToDatabaseColumn(rental.name()),deposit,key,roomsJson(rooms),actor,now,
            statuses.convertToDatabaseColumn(initial),methods.convertToDatabaseColumn(method),paymentCode,expires,email,
            sources.convertToDatabaseColumn(source==null||source.isBlank()?"DIRECT":source.trim().toUpperCase(Locale.ROOT)),true);}
        catch(DataAccessException error){throw translate(error);}
    }

    public void command(String command,long id,Long customer,List<ReservationDtos.RoomStay> rooms,LocalDateTime at,
            LocalDateTime newIn,BigDecimal deposit,String reason,String service,Integer quantity,String paymentCode,
            LocalDateTime expires,String actor,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspLenhDatPhong ?,?,?,?,?,?,?,?,?,?,?,?,?,?",command,id,customer,rooms==null?null:roomsJson(rooms),
            at,newIn,deposit,reason,service,quantity,paymentCode,expires,actor,now);}
        catch(DataAccessException error){throw translate(error);}
    }

    private String roomsJson(List<ReservationDtos.RoomStay> rooms){
        var values=rooms.stream().map(line->Map.of("maPhong",line.roomId().trim(),"thoiDiemNhanPhong",line.expectedCheckIn(),
            "thoiDiemTraPhong",line.expectedCheckOut(),"soLuongKhach",line.guestCount()==null?1:line.guestCount())).toList();
        try{return mapper.writeValueAsString(values);}catch(JsonProcessingException error){throw new IllegalStateException(error);}
    }

    private List<Snapshot> load(String where,Object...args){
        var grouped=new LinkedHashMap<Long,List<Map<String,Object>>>();
        for(var row:jdbc.queryForList("SELECT "+COLUMNS+" FROM dbo.vwDatPhongChiTiet"+where+" ORDER BY thoiDiemDat DESC,maPhieuDatPhong DESC,maPhong",args))
            grouped.computeIfAbsent(num(row,"maPhieuDatPhong").longValue(),key->new ArrayList<>()).add(row);
        return grouped.values().stream().map(this::snapshot).toList();
    }
    private Snapshot snapshot(List<Map<String,Object>> rows){
        var r=rows.get(0);long id=num(r,"maPhieuDatPhong").longValue();
        LocalDateTime actualIn=date(r,"thoiDiemNhanPhongThucTe"),actualOut=date(r,"thoiDiemTraPhongThucTe");
        boolean hourly="Theo giờ".equals(str(r,"hinhThucThue"));
        var lines=rows.stream().map(row->new ReservationDtos.RoomLine(str(row,"maPhong"),date(row,"thoiDiemNhanPhong"),date(row,"thoiDiemTraPhong"),actualIn,actualOut)).toList();
        var customerRooms=rows.stream().map(row->new CustomerReservationDtos.RoomLine(str(row,"maPhong"),str(row,"tenPhong"),str(row,"tenLoaiPhong"),
            hourly?money(row,"giaTheoGio"):money(row,"giaTheoNgay"),money(row,"tongTienPhongDuKien"),date(row,"thoiDiemNhanPhong"),date(row,"thoiDiemTraPhong"),num(row,"soLuongKhach").intValue())).toList();
        var usages=jdbc.query("SELECT maDichVu,ten,ngaySuDung,soLuong,donGia FROM dbo.vwSuDungDichVuDatPhong WHERE maPhieuDatPhong=? ORDER BY ngaySuDung,ten,maDichVu",
            (row,n)->new ReservationDtos.ServiceUsageLine(row.getString(1),row.getString(2),row.getDate(3).toLocalDate(),row.getInt(4),row.getBigDecimal(5),row.getBigDecimal(5).multiply(BigDecimal.valueOf(row.getInt(4)))),id);
        var response=new ReservationDtos.Response(id,num(r,"maKhachLuuTru").longValue(),str(r,"maNhanVien"),statuses.convertToEntityAttribute(str(r,"trangThai")),
            hourly?ReservationDtos.RentalType.HOURLY:ReservationDtos.RentalType.PACKAGE,money(r,"tienDatCoc"),date(r,"thoiDiemDat"),actualIn,actualOut,lines,
            str(r,"lyDoHuy"),cancellations.convertToEntityAttribute(str(r,"ketQuaHuy")),sources.convertToEntityAttribute(str(r,"nguonDatPhong")),
            money(r,"doanhThuGopOta"),money(r,"hoaHongOta"),money(r,"doanhThuGopOta").subtract(money(r,"hoaHongOta")),ota.convertToEntityAttribute(str(r,"trangThaiDoiSoatOta")),
            usages,methods.convertToEntityAttribute(str(r,"phuongThucBaoDam")),deposits.convertToEntityAttribute(str(r,"trangThaiThanhToanCoc")));
        Number customer=num(r,"maTaiKhoanKhachHang");
        return new Snapshot(response,customer==null?null:customer.longValue(),str(r,"maThanhToanDatCoc"),date(r,"thoiDiemHetHanThanhToanCoc"),str(r,"loaiThayDoiDangCho"),
            date(r,"thoiDiemNhanPhongTruocThayDoi"),date(r,"thoiDiemTraPhongTruocThayDoi"),money(r,"tienDatCocBoSung"),num(r,"phienBan").longValue(),customerRooms);
    }
    public static RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){
                case 51001->"GUEST_NOT_FOUND";case 51002,53414->"ROOM_NOT_AVAILABLE";case 51003->"VERSION_CONFLICT";
                case 51004->"OVERBOOKING";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51006->"INSUFFICIENT_STOCK";case 51008->"INVALID_INTERVAL";
                case 53401->"GUEST_BOOKING_BLOCKED";case 53402->"CUSTOMER_ACCOUNT_NOT_FOUND";case 53403->"ROOM_NOT_FOUND";
                case 53404->"INVALID_GUEST_COUNT";case 53405->"CHECK_IN_MUST_BE_FUTURE";case 53406->"ROOM_TYPE_NOT_ACTIVE";
                case 53407->"INVALID_DEPOSIT";case 53408->"RESERVATION_NOT_FOUND";case 53409->"INVALID_RESERVATION";
                case 53410->"INVALID_STATE";case 53411->"DEPOSIT_PAYMENT_REQUIRED";case 53412->"EARLY_CHECK_IN";case 53413->"INVALID_CHECK_IN_TIME";
                case 53415->"INVALID_EXTENSION";case 53416->"EXTENSION_TOO_LATE";case 53417->"ROOM_SET_IMMUTABLE";
                case 53418->"RESERVATION_NOT_CHANGEABLE";case 53419->"PACKAGE_BOOKING_REQUIRED";case 53420->"CHANGE_ALREADY_PENDING";
                case 53421->"MIXED_STAY_DATES";case 53422->"CHANGE_TOO_LATE";case 53423->"EXTENSION_MUST_BE_CONTIGUOUS";
                case 53424->"RESCHEDULE_DURATION_MISMATCH";case 53425->"INVALID_ADDITIONAL_DEPOSIT";case 53426->"PENDING_CHANGE_PAYMENT";
                case 53427->"NO_SHOW_TOO_EARLY";case 53428->"CANCELLATION_REASON_REQUIRED";case 53429->"SERVICE_NOT_FOUND";case 53430->"SERVICE_NOT_AVAILABLE";default->null;};
            if(code!=null)return error(code,sql.getMessage());
        }return error;
    }
    private static Number num(Map<String,Object> r,String key){return (Number)r.get(key);}
    private static String str(Map<String,Object> r,String key){Object v=r.get(key);return v==null?null:v.toString();}
    private static BigDecimal money(Map<String,Object> r,String key){return (BigDecimal)r.get(key);}
    private static LocalDateTime date(Map<String,Object> r,String key){Object v=r.get(key);return v==null?null:((java.sql.Timestamp)v).toLocalDateTime();}
    private static DomainException error(String code,String text){return new DomainException(code,text);}
}
