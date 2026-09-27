package com.hospitality.mis.reservation;

import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.h2.Driver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** Chứng minh luồng điều phối nhà hàng dùng dữ liệu thật và ghi nhận đủ tồn kho/audit. */
class RestaurantOperationsTest {
    private JdbcTemplate jdbc;
    private AuditService audit;
    private HotelServiceBookingService service;

    @BeforeEach
    void setUp() {
        var dataSource = new SimpleDriverDataSource(new Driver(),
                "jdbc:h2:mem:restaurant-" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        audit = mock(AuditService.class);
        Clock clock = Clock.fixed(ZonedDateTime.parse("2026-09-23T12:00:00+07:00").toInstant(),
                ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new HotelServiceBookingService(jdbc, audit, clock);

        jdbc.execute("CREATE TABLE PhieuDatPhong (maPhieuDatPhong BIGINT PRIMARY KEY, trangThai VARCHAR(30))");
        jdbc.execute("""
                CREATE TABLE DichVu (
                    maDichVu VARCHAR(40) PRIMARY KEY, ten VARCHAR(120), danhMuc VARCHAR(60),
                    soLuongTonKho INT NOT NULL, dangHoatDong BIT NOT NULL)
                """);
        jdbc.execute("""
                CREATE TABLE DatDichVuKhachSan (
                    maDatDichVuKhachSan BIGINT PRIMARY KEY, maPhieuDatPhong BIGINT NOT NULL, maPhong VARCHAR(20) NOT NULL,
                    maDichVu VARCHAR(40) NOT NULL, thoiDiemDuKien TIMESTAMP NOT NULL,
                    soLuong INT NOT NULL, soLuongMienPhi INT NOT NULL, donGia DECIMAL(15,2) NOT NULL,
                    buoiAn VARCHAR(20), trangThai VARCHAR(20) NOT NULL, ghiChu VARCHAR(255),
                    thoiDiemSuDung TIMESTAMP, nguoiXacNhanSuDung VARCHAR(80))
                """);
        jdbc.execute("""
                CREATE TABLE BienDongKhoDichVu (
                    maBienDongKhoDichVu BIGINT IDENTITY PRIMARY KEY, maDichVu VARCHAR(40), loai VARCHAR(20),
                    soLuong INT, maNguoiThucHien VARCHAR(80), thoiDiemPhatSinh TIMESTAMP, lyDo VARCHAR(255))
                """);
        jdbc.update("INSERT INTO PhieuDatPhong(maPhieuDatPhong,trangThai) VALUES (1,'Đã nhận phòng')");
        jdbc.update("INSERT INTO DichVu(maDichVu,ten,danhMuc,soLuongTonKho,dangHoatDong) VALUES ('MAMREST','Nhà hàng Mâm','Nhà hàng cao cấp',10,1)");
        jdbc.update("INSERT INTO DichVu(maDichVu,ten,danhMuc,soLuongTonKho,dangHoatDong) VALUES ('BREAKFAST','Bữa sáng','Dịch vụ tại phòng',10,1)");
        jdbc.update("INSERT INTO DichVu(maDichVu,ten,danhMuc,soLuongTonKho,dangHoatDong) VALUES ('LNDRYSTD','Giặt ủi','Giặt ủi',10,1)");
        addBooking(11, "MAMREST", "2026-09-23 10:00:00", "CONFIRMED", 2);
        addBooking(12, "BREAKFAST", "2026-09-23 08:00:00", "USED", 1);
        addBooking(13, "LNDRYSTD", "2026-09-23 09:00:00", "CONFIRMED", 1);
        addBooking(14, "MAMREST", "2026-09-24 10:00:00", "CONFIRMED", 1);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void restaurantQueueContainsOnlyFoodOrdersForSelectedDateAndCanFilterStatus() {
        var all = service.restaurantBookings(LocalDate.of(2026, 9, 23), null);
        var waiting = service.restaurantBookings(LocalDate.of(2026, 9, 23), " confirmed ");

        assertThat(all).extracting(HotelServiceBookingService.Response::id).containsExactly(12L, 11L);
        assertThat(all).extracting(HotelServiceBookingService.Response::serviceName)
                .containsExactly("Bữa sáng", "Nhà hàng Mâm");
        assertThat(waiting).extracting(HotelServiceBookingService.Response::id).containsExactly(11L);
    }

    @Test
    void markingRestaurantOrderUsedPersistsStatusStockMovementAndAudit() {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("KITCHEN", "", List.of()));

        var response = service.markRestaurantUsed(11L, "KITCHEN");

        assertThat(response.status()).isEqualTo("USED");
        assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu='MAMREST'", Integer.class))
                .isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu='MAMREST' AND loai='Xuất kho' AND soLuong=2 AND maNguoiThucHien='KITCHEN'", Integer.class))
                .isEqualTo(1);
        verify(audit).record("KITCHEN", "HOTEL_SERVICE_USED", "RESERVATION", "1", null, "11", null);
    }

    private void addBooking(long id, String serviceId, String scheduledAt, String status, int quantity) {
        String databaseStatus = switch (status) {
            case "CONFIRMED" -> "Đã xác nhận";
            case "USED" -> "Đã sử dụng";
            default -> throw new IllegalArgumentException("Unknown booking status: " + status);
        };
        jdbc.update("""
                INSERT INTO DatDichVuKhachSan
                    (maDatDichVuKhachSan,maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,soLuong,soLuongMienPhi,donGia,buoiAn,trangThai,ghiChu)
                VALUES (?,1,'504',?,?,?,0,150000,'Bữa trưa',?,'Kiểm thử nhà hàng')
                """, id, serviceId, scheduledAt, quantity, databaseStatus);
    }
}
