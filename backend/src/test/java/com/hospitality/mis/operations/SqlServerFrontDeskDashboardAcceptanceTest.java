package com.hospitality.mis.operations;

import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.operations.FrontDeskDashboardService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** SQL Server acceptance for the production dashboard view/function read path. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerFrontDeskDashboardAcceptanceTest {
    private static final LocalDate BUSINESS_DATE = LocalDate.of(2031, 1, 10);
    private static final long ALPHA = 9_310_001L;
    private static final long BETA = 9_310_002L;
    private static final long EARLY = 9_310_003L;
    private static final long DEPARTURE = 9_310_004L;
    private static final long CURRENT = 9_310_005L;
    private static final long UNPAID = 9_310_006L;
    private static final long INCIDENT_ONE = 9_320_001L;
    private static final long INCIDENT_TWO = 9_320_002L;

    @Autowired JdbcTemplate jdbc;
    @Autowired FrontDeskDashboardService dashboard;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into LoaiPhong(maLoaiPhong, ten, giaTheoNgay) values (?,?,?)", "P1MY", "P1 SQL Server", 100000);
        for (int i = 1; i <= 6; i++) {
            jdbc.update("insert into Phong(maPhong, maLoaiPhong, ten, trangThai) values (?,?,?,?)",
                    "M" + i, "P1MY", "SQL Server room " + i, "Sẵn sàng");
        }
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                ALPHA, "Target Alpha", "0931000001", "931000000001");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                BETA, "Target Beta", "0931000002", "931000000002");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                EARLY, "Other Guest", "0931000003", "931000000003");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                DEPARTURE, "Departure Guest", "0931000004", "931000000004");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                CURRENT, "Current Guest", "0931000005", "931000000005");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                UNPAID, "Unpaid Guest", "0931000006", "931000000006");

        reservation(ALPHA, ALPHA, "Đã xác nhận", "M1", BUSINESS_DATE.atTime(8, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "Không yêu cầu");
        reservation(BETA, BETA, "Đã xác nhận", "M2", BUSINESS_DATE.atTime(8, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "Không yêu cầu");
        reservation(EARLY, EARLY, "Đã xác nhận", "M3", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "Không yêu cầu");
        reservation(DEPARTURE, DEPARTURE, "Đã nhận phòng", "M4", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.atTime(10, 0), "Không yêu cầu");
        reservation(CURRENT, CURRENT, "Đã nhận phòng", "M5", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "Không yêu cầu");
        reservation(UNPAID, UNPAID, "Đã xác nhận", "M6", BUSINESS_DATE.plusDays(2).atTime(14, 0), BUSINESS_DATE.plusDays(3).atTime(12, 0), "Chờ thanh toán");
        jdbc.update("SET IDENTITY_INSERT HoaDon ON; insert into HoaDon(maHoaDon, maPhieuDatPhong, tongTienPhong, soTienPhaiTra, trangThai) values (?,?,?,?,?); SET IDENTITY_INSERT HoaDon OFF",
                9_330_001L, UNPAID, 100000, 25000, "Chưa thanh toán");
        incident(INCIDENT_ONE, "M1", "Lamp", 1000);
        incident(INCIDENT_TWO, "M2", "TV", 2000);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from SuCoThietBi where maSuCoThietBi in (?,?)", INCIDENT_ONE, INCIDENT_TWO);
        jdbc.update("delete from HoaDon where maPhieuDatPhong in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from ChiTietDatPhong where maPhieuDatPhong in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from PhieuDatPhong where maPhieuDatPhong in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from KhachLuuTru where maKhachLuuTru in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from Phong where maLoaiPhong = ?", "P1MY");
        jdbc.update("delete from LoaiPhong where maLoaiPhong = ?", "P1MY");
    }

    @Test
    void reservationFilteringBucketsOrderingAndBoundedMetadataComeFromSqlServer() {
        FrontDeskDashboardDtos.Response searched = dashboard.get(BUSINESS_DATE, " target ", ReservationStatus.CONFIRMED, 1, 1);

        assertThat(searched.page()).isEqualTo(1);
        assertThat(searched.size()).isEqualTo(1);
        assertThat(searched.totalElements()).isEqualTo(2);
        assertThat(searched.totalPages()).isEqualTo(2);
        assertThat(searched.arrivals()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(BETA);

        FrontDeskDashboardDtos.Response arrivals = dashboard.get(BUSINESS_DATE, null, null, 0, 1000);
        assertThat(arrivals.arrivals()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(ALPHA, BETA);
        assertThat(arrivals.departures()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(DEPARTURE);
        assertThat(arrivals.currentStays()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(DEPARTURE, CURRENT);
        assertThat(arrivals.unpaidDeposits()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(UNPAID);
        assertThat(arrivals.invoiceBalances()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(UNPAID);
        assertThat(arrivals.totalElements()).isEqualTo(6);
        assertThat(arrivals.totalPages()).isEqualTo(1);
    }

    @Test
    void currentStayDoesNotReattachCancelledSourceRoomsAfterTransfers() {
        jdbc.update("UPDATE ChiTietDatPhong SET trangThai=N'Đang có khách' WHERE maPhieuDatPhong=?",CURRENT);
        for(String room:java.util.List.of("M1","M2")) jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai) VALUES(?,?,?, ?,?,N'Đã hủy')",CURRENT,room,BUSINESS_DATE.minusDays(3).atTime(14,0),BUSINESS_DATE.minusDays(2).atTime(12,0),BUSINESS_DATE.minusDays(2).atTime(12,0));
        var current=dashboard.get(BUSINESS_DATE,null,null,0,100).currentStays().stream().filter(r->r.reservationId()==CURRENT).findFirst().orElseThrow();
        assertThat(current.roomIds()).containsExactly("M5");
        assertThat(current.checkIn()).isEqualTo(BUSINESS_DATE.minusDays(3).atTime(14,0));
    }

    @Test
    void incidentsUseStableDatabaseOrderingAndBoundedPage() {
        FrontDeskDashboardDtos.Response page = dashboard.get(BUSINESS_DATE, null, null, 1, 1);

        assertThat(page.incidents()).hasSize(1);
        assertThat(page.incidents().get(0).id()).isEqualTo(INCIDENT_TWO);
        assertThat(page.totalElements()).isEqualTo(6);
        assertThat(page.totalPages()).isEqualTo(6);
        assertThat(jdbc.queryForObject("select count(*) from SuCoThietBi where maSuCoThietBi in (?,?)", Integer.class,
                INCIDENT_ONE, INCIDENT_TWO)).isEqualTo(2);
    }

    private void reservation(long id, long guestId, String status, String room, LocalDateTime checkIn,
                             LocalDateTime checkOut, String depositStatus) {
        jdbc.update("SET IDENTITY_INSERT PhieuDatPhong ON; insert into PhieuDatPhong(maPhieuDatPhong, maKhachLuuTru, trangThai, hinhThucThue, trangThaiThanhToanCoc) values (?,?,?,?,?); SET IDENTITY_INSERT PhieuDatPhong OFF",
                id, guestId, status, "Theo gói", depositStatus);
        jdbc.update("insert into ChiTietDatPhong(maPhieuDatPhong, maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, thoiDiemTraPhongBanDau) values (?,?,?,?,?)",
                id, room, checkIn, checkOut, checkOut);
    }

    private void incident(long id, String room, String equipment, int compensation) {
        jdbc.update("SET IDENTITY_INSERT SuCoThietBi ON; insert into SuCoThietBi(maSuCoThietBi, maPhieuDatPhong, maPhong, tenThietBi, giaTriBanDau, ngayMua, soLuong, tienBoiThuong) values (?,?,?,?,?,?,?,?); SET IDENTITY_INSERT SuCoThietBi OFF",
                id, ALPHA, room, equipment, new BigDecimal("5000"), LocalDate.of(2030, 1, 1), 1, compensation);
    }
}
