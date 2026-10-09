package com.hospitality.mis.dao.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Persistence contract for hotel-operated services: views for reads, procedures for commands. */
@Repository
public class HotelServiceBookingDatabase {
    private static final String READ="SELECT maDatDichVuKhachSan,maPhieuDatPhong,maPhong,maDichVu,tenDichVu,thoiDiemDuKien,soLuong,soLuongMienPhi,donGia,buoiAn,trangThai,ghiChu FROM dbo.vwDatDichVuKhachSan";
    private final JdbcTemplate jdbc;

    public HotelServiceBookingDatabase(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<HotelServiceBookingService.Response> list(long reservationId, Long customerId) {
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.vwChuSoHuuDatPhong WHERE maPhieuDatPhong=? AND (? IS NULL OR maTaiKhoanKhachHang=?)",
                Integer.class, reservationId, customerId, customerId);
        if (owned == null || owned == 0) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        return reservationServices(reservationId);
    }

    public List<HotelServiceBookingService.Response> reservationServices(long reservationId) {
        return jdbc.query(READ+" WHERE maPhieuDatPhong=? ORDER BY thoiDiemDuKien,maDatDichVuKhachSan",
                (rs, n) -> HotelServiceBookingService.response(rs), reservationId);
    }

    public List<HotelServiceBookingService.Response> restaurant(LocalDate date, String status) {
        return jdbc.query(READ+"""
                 WHERE CAST(thoiDiemDuKien AS DATE)=?
                AND (maDichVu IN ('MAMREST','BREAKFAST') OR danhMuc=N'Nhà hàng cao cấp')
                AND (? IS NULL OR trangThai=?) ORDER BY thoiDiemDuKien,maPhong,maDatDichVuKhachSan
                """, (rs, n) -> HotelServiceBookingService.response(rs), date, status, status);
    }

    public HotelServiceBookingService.Response find(long id) {
        var rows = jdbc.query(READ+" WHERE maDatDichVuKhachSan=?",
                (rs, n) -> HotelServiceBookingService.response(rs), id);
        if (rows.isEmpty()) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ");
        return rows.get(0);
    }

    public HotelServiceBookingService.Response book(HotelServiceBookingService.Request request, String meal, String key,
            String fingerprint, String actor, Long customerId, boolean atDesk, LocalDateTime now) {
        try {
            Long id = jdbc.queryForObject("EXEC dbo.uspDatDichVuKhachSan ?,?,?,?,?,?,?,?,?,?,?,?,?", Long.class,
                    request.reservationId(), request.roomId(), request.serviceId(), request.scheduledAt(), request.quantity(),
                    meal, request.note(), key, fingerprint, actor, customerId, atDesk, now);
            return find(id);
        } catch (DataAccessException error) { throw translate(error); }
    }

    public HotelServiceBookingService.Response use(long reservationId, long id, String actor, LocalDateTime now) {
        try {
            jdbc.update("EXEC dbo.uspXacNhanSuDungDichVu ?,?,?,?", id, actor, now, reservationId);
            return find(id);
        } catch (DataAccessException error) { throw translate(error); }
    }

    public HotelServiceBookingService.Response cancel(long id, String actor, long customerId) {
        try {
            jdbc.update("EXEC dbo.uspHuyDatDichVu ?,?,?", id, actor, customerId);
            return find(id);
        } catch (DataAccessException error) { throw translate(error); }
    }

    public void cancelReservation(long reservationId, String actor) {
        jdbc.update("EXEC dbo.uspHuyDichVuTheoDatPhong ?,?", reservationId, actor);
    }

    public BigDecimal usedTotal(long reservationId) {
        return jdbc.queryForObject("SELECT dbo.fnTongDichVuKhachSanDaDung(?)", BigDecimal.class, reservationId);
    }

    private RuntimeException translate(DataAccessException error) {
        for (Throwable cause=error; cause!=null; cause=cause.getCause()) {
            if (!(cause instanceof SQLException sql)) continue;
            String code = switch (sql.getErrorCode()) {
                case 51001 -> "RESERVATION_NOT_FOUND";
                case 51002, 53611 -> "INVALID_STATE";
                case 51005 -> "IDEMPOTENCY_KEY_CONFLICT";
                case 51006 -> "INSUFFICIENT_STOCK";
                case 51101 -> "SERVICE_BOOKING_NOT_FOUND";
                case 51102 -> "SERVICE_NOT_DUE";
                case 51103 -> "INVALID_SERVICE_BOOKING";
                case 51104 -> "MEAL_PERIOD_REQUIRED";
                case 51105 -> "INVALID_MEAL_PERIOD";
                case 51106 -> "POOL_WALK_IN_ONLY";
                case 51107 -> "DEPOSIT_NOT_PAID";
                case 51108, 53610 -> "SERVICE_OUTSIDE_STAY";
                case 51109 -> "SERVICE_NOT_FOUND";
                case 51110 -> "SERVICE_PRICE_NOT_SET";
                case 53609 -> "SERVICE_OUTSIDE_MEAL_HOURS";
                default -> null;
            };
            if (code != null) return new DomainException(code, sql.getMessage());
        }
        return error;
    }
}
