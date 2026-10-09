package com.hospitality.mis;



import com.hospitality.mis.dao.room.RoomDatabase;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Collectors;
import java.util.stream.Stream;


import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;



/** Thực thi migration SQL Server thực tế và kiểm tra Hibernate; yêu cầu một cơ sở dữ liệu trống dùng tạm thời. */

@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",

        "spring.flyway.baseline-on-migrate=false",

        "spring.jpa.hibernate.ddl-auto=validate"

})
class SqlServerMigrationTest {
    /** Flyway thật dùng kiểm tra migration line và pending state. */
    @Autowired Flyway flyway;
    /** DataSource thật dùng kiểm tra product name và metadata SQL. */
    @Autowired DataSource dataSource;
    /** Adapter native SQL phải dùng đúng giá trị trạng thái tiếng Việt trong SQL Server. */
    @Autowired RoomDatabase reservationOverlap;
    @Autowired java.time.Clock overlapClock;


    @Test

    /** Given SQL Server đã chạy migration chain, When validate/info, Then baseline V1 hiện diện và JPA validate hợp lệ. */
    void sqlServerHasTheCompleteMigrationLineAndJpaMappingsValidate() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualToIgnoringCase("Microsoft SQL Server");
        }
        var validation = flyway.validateWithResult();
        assertThat(validation.validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        var appliedVersions = java.util.Arrays.stream(flyway.info().applied())
                .map(info -> info.getVersion() == null ? "" : info.getVersion().toString())
                .toList();
        assertThat(appliedVersions).containsExactly("1", "2", "3", "4", "5", "6");
        Path migrations = Stream.of(Path.of("src/main/resources/db/migration"),
                        Path.of("backend/src/main/resources/db/migration"))
                .filter(Files::isDirectory).findFirst()
                .orElseThrow(() -> new IllegalStateException("Cannot locate the six owned migration files"));
        try (var files = Files.walk(migrations)) {
            var sqlFiles = files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(java.util.Locale.ROOT).endsWith(".sql"))
                    .map(path -> migrations.relativize(path).toString().replace('\\', '/'))
                    .toList();
            assertThat(sqlFiles).containsExactlyInAnyOrder(
                    "V1__baseline_schema.sql", "V2__indexes.sql", "V3__functions.sql",
                    "V4__views.sql", "V5__stored_procedures.sql", "V6__triggers.sql");
        }
        assertDatabaseObjects("FN", Set.of(
                "fnKiemTraPhongTrong", "fnTinhTongTienPhong", "fnTinhTongTienDichVu",
                "fnTinhSoDuHoaDon", "fnKiemTraTrungCaLamViec"));
        assertDatabaseObjects("V", Set.of(
                "vwPhongCongKhai", "vwDichVuCongKhai", "vwDatPhongChiTiet", "vwDashboardLeTan",
                "vwHoaDonChiTiet", "vwTonKhoHienTai", "vwCongViecBuongPhong", "vwChuyenPhong",
                "vwCongViecKyThuat", "vwLichLamViecNhanVien", "vwDoanhThuTheoNgay"));
        assertDatabaseObjects("P", Set.of(
                "uspTaoDatPhong", "uspLenhDatPhong", "uspLenhHoaDon",
                "uspChuyenPhong", "uspLenhThanhToanCocOnline", "uspHetHanGiuCoc",
                "uspXacNhanSuDungDichVu", "uspHuyDatDichVu", "uspDieuChinhTonKho",
                "uspLenhGiaoDichThanhToan", "uspPhatHanhBienLai", "uspTaoNhiemVuBuongPhong",
                "uspCapNhatNhiemVuBuongPhong", "uspLenhCongViecKyThuat",
                "uspPhanCongCa", "uspLenhPheDuyet"));
        assertDatabaseObjects("TR", Set.of(
                "trgBienLaiBaoDamTienThu", "trgThanhToanBaoDamBienLai", "trgCaLamViecKhongTrung",
                "trgNhatKyKiemSoatKhongSua", "trgYeuCauPheDuyetKhongTuDuyet",
                "trgButToanTaiChinhKhongSua", "trgLichSuHangThanhVienKhongSua",
                "trgDatDichVuDungKhungGioBuaAn", "trgDatDichVuTrongKyLuuTru",
                "trgDatDichVuChiDungKhiDangO"));
    }

    @Test
    /** Audit đã ghi chỉ được bổ sung bằng sự kiện mới, không được sửa lại bằng DML trực tiếp. */
    void auditTriggerRejectsRewritingExistingEvidence() throws Exception {
        String key = "TR-AUDIT-" + UUID.randomUUID();
        try (var connection = dataSource.getConnection()) {
            try (var insert = connection.prepareStatement("insert dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,khoaLienKet) values(N'AUDIT',N'ORIGINAL',N'TRIGGER_TEST',N'1',?)")) {
                insert.setString(1, key);
                assertThat(insert.executeUpdate()).isEqualTo(1);
            }
            assertThatThrownBy(() -> {
                try (var update = connection.prepareStatement("update dbo.NhatKyKiemSoat set hanhDong=N'REWRITTEN' where khoaLienKet=?")) {
                    update.setString(1, key);
                    update.executeUpdate();
                }
            }).isInstanceOf(java.sql.SQLException.class)
                    .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(53605));
            try (var query = connection.prepareStatement("select hanhDong from dbo.NhatKyKiemSoat where khoaLienKet=?")) {
                query.setString(1, key);
                try (var result = query.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("ORIGINAL");
                }
            } finally {
                try (var cleanup = connection.prepareStatement("delete dbo.NhatKyKiemSoat where khoaLienKet=?")) {
                    cleanup.setString(1, key);
                    cleanup.executeUpdate();
                }
            }
        }
    }

    @Test
    /** DML trực tiếp cũng phải giữ separation-of-duties giữa requester và approver. */
    void approvalTriggerRejectsSelfApprovalAndAllowsAnotherApprover() throws Exception {
        String key = "TR-APP-" + UUID.randomUUID();
        try (var connection = dataSource.getConnection()) {
            try (var insert = connection.prepareStatement("insert dbo.YeuCauPheDuyet(nguoiYeuCau,hanhDong,maDoiTuong,duLieuThayDoi,dauVanTayDuLieu,lyDo,mucDoRuiRo,thoiDiemYeuCau,trangThai,thoiDiemHetHan,khoaLienKet) values(N'REQUESTER',N'Điều chỉnh giá',N'1',N'{}',REPLICATE(N'0',64),N'Kiểm tra SoD',N'Thấp',SYSDATETIMEOFFSET(),N'Chờ phê duyệt',DATEADD(HOUR,1,SYSDATETIMEOFFSET()),?)")) {
                insert.setString(1, key);
                assertThat(insert.executeUpdate()).isEqualTo(1);
            }
            assertThatThrownBy(() -> {
                try (var update = connection.prepareStatement("update dbo.YeuCauPheDuyet set trangThai=N'Đã phê duyệt',nguoiPheDuyet=N'REQUESTER',thoiDiemQuyetDinh=SYSDATETIMEOFFSET() where khoaLienKet=?")) {
                    update.setString(1, key);
                    update.executeUpdate();
                }
            }).isInstanceOf(java.sql.SQLException.class)
                    .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(53606));
            try (var valid = connection.prepareStatement("update dbo.YeuCauPheDuyet set trangThai=N'Đã phê duyệt',nguoiPheDuyet=N'DIRECTOR',thoiDiemQuyetDinh=SYSDATETIMEOFFSET() where khoaLienKet=?")) {
                valid.setString(1, key);
                assertThat(valid.executeUpdate()).isEqualTo(1);
            }
            try (var query = connection.prepareStatement("select trangThai,nguoiPheDuyet from dbo.YeuCauPheDuyet where khoaLienKet=?")) {
                query.setString(1, key);
                try (var result = query.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("Đã phê duyệt");
                    assertThat(result.getString(2)).isEqualTo("DIRECTOR");
                }
            } finally {
                try (var cleanup = connection.prepareStatement("delete dbo.YeuCauPheDuyet where khoaLienKet=?")) {
                    cleanup.setString(1, key);
                    cleanup.executeUpdate();
                }
            }
        }
    }

    @Test
    /** Bút toán đã ghi là chứng từ bất biến; sửa sai phải dùng dòng điều chỉnh mới. */
    void financialPostingTriggerRejectsRewritingLedgerHistory() throws Exception {
        String source = "TR-LEDGER-" + UUID.randomUUID();
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                statement.executeUpdate("insert dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo) "
                        + "values(N'Kiểm thử',N'TRIGGER',N'" + source + "',N'Ghi nợ',1000,N'AUDIT',SYSDATETIME(),N'Giá trị gốc',1)");
                assertThatThrownBy(() -> statement.executeUpdate("update dbo.ButToanTaiChinh set soTien=2000 where maNguon=N'" + source + "'"))
                        .isInstanceOf(java.sql.SQLException.class)
                        .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(53607));
                try (var result = statement.executeQuery("select soTien from dbo.ButToanTaiChinh where maNguon=N'" + source + "'")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getBigDecimal(1)).isEqualByComparingTo("1000");
                }
            } finally {
                statement.executeUpdate("delete dbo.ButToanTaiChinh where maNguon=N'" + source + "'");
            }
        }
    }

    @Test
    /** Lịch sử đổi hạng chỉ được nối thêm, không được viết lại sự kiện đã xảy ra. */
    void membershipTierHistoryTriggerRejectsRewritingTransitions() throws Exception {
        String reason = "TR-TIER-" + UUID.randomUUID();
        String phone = "07" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                statement.executeUpdate("insert dbo.KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) "
                        + "values(N'Trigger tier test',N'" + phone + "',N'" + phone + "')");
                statement.executeUpdate("insert dbo.LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi) "
                        + "select maKhachLuuTru,N'Tiêu chuẩn',N'Bạc',N'" + reason + "',SYSDATETIME() from dbo.KhachLuuTru where soDienThoai=N'" + phone + "'");
                assertThatThrownBy(() -> statement.executeUpdate("update dbo.LichSuHangThanhVien set hangMoi=N'Vàng' where lyDo=N'" + reason + "'"))
                        .isInstanceOf(java.sql.SQLException.class)
                        .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(53608));
                try (var result = statement.executeQuery("select hangMoi from dbo.LichSuHangThanhVien where lyDo=N'" + reason + "'")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("Bạc");
                }
            } finally {
                statement.executeUpdate("delete dbo.LichSuHangThanhVien where lyDo=N'" + reason + "'");
                statement.executeUpdate("delete dbo.KhachLuuTru where soDienThoai=N'" + phone + "'");
            }
        }
    }

    @Test
    /** Function tiền phòng phải giữ cách làm tròn giờ/ngày và giá giờ cấu hình của PricingPolicy. */
    void databasePricingFunctionsMatchCurrentBoundaryRules() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("select "
                    + "dbo.fnTinhTongTienPhong(1000000,100000,'2035-01-10T14:00:00','2035-01-11T12:00:00',0,3),"
                    + "dbo.fnTinhTongTienPhong(1000000,100000,'2035-01-10T08:00:00','2035-01-10T12:15:00',1,3),"
                    + "dbo.fnTinhTongTienPhong(1000000,100000,'2035-01-10T12:00:00','2035-01-10T12:00:00',0,3)")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBigDecimal(1)).isEqualByComparingTo("1000000.00");
                assertThat(result.getBigDecimal(2)).isEqualByComparingTo("500000.00");
                assertThat(result.getBigDecimal(3)).isNull();
            }
        }
    }

    @Test
    /** View public chỉ chứa allow-list và không đưa PII/booking/payment vào schema. */
    void publicViewsDoNotExposeSensitiveColumns() throws Exception {
        Set<String> forbidden = Set.of("maKhachLuuTru", "hoVaTen", "soDienThoai", "email",
                "soGiayToTuyThan", "maPhieuDatPhong", "maHoaDon", "maGiaoDichThanhToan",
                "maNhanVien", "ghiChu");
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("select column_name from information_schema.columns "
                     + "where table_schema='dbo' and table_name in ('vwPhongCongKhai','vwDichVuCongKhai')")) {
            Set<String> actual = new HashSet<>();
            try (var result = statement.executeQuery()) {
                while (result.next()) actual.add(result.getString(1));
            }
            assertThat(actual).isNotEmpty();
            assertThat(actual).doesNotContainAnyElementsOf(forbidden);
        }
    }

    @Test
    /** Procedure tồn kho phải rollback cả stock lẫn movement khi số lượng không đủ. */
    void inventoryProcedureRejectsNegativeStockWithoutPartialWrite() throws Exception {
        String itemId = "AUDIT-STOCK-" + UUID.randomUUID().toString().substring(0, 6);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                statement.executeUpdate("insert into MatHangTonKho(maMatHang,ten,danhMuc,donViTinh,soLuongHienTai,nguongAnToan) "
                        + "values(N'" + itemId + "',N'Audit stock',N'Minibar',N'đơn vị',1,0)");
                assertThatThrownBy(() -> {
                    try (var call = connection.prepareCall("{call dbo.uspDieuChinhTonKho(?,?,?,?,?,?)}")) {
                        call.setString(1, itemId);
                        call.setNString(2, "Xuất kho");
                        call.setInt(3, 2);
                        call.setNString(4, "AUDIT");
                        call.setNString(5, "rollback contract");
                        call.setObject(6, LocalDateTime.of(2035, 1, 10, 10, 0));
                        call.execute();
                    }
                }).isInstanceOf(java.sql.SQLException.class)
                        .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(51006));
                try (var result = statement.executeQuery("select soLuongHienTai,(select count(*) from BienDongTonKho "
                        + "where maMatHang=N'" + itemId + "') from MatHangTonKho where maMatHang=N'" + itemId + "'")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getInt(1)).isEqualTo(1);
                    assertThat(result.getInt(2)).isZero();
                }
            } finally {
                statement.executeUpdate("delete from BienDongTonKho where maMatHang=N'" + itemId + "'");
                statement.executeUpdate("delete from MatHangTonKho where maMatHang=N'" + itemId + "'");
            }
        }
    }

    @Test
    /** Hai lần phân cùng khoảng ca phải tạo đúng một ca và trả SQL error ổn định. */
    void shiftProcedurePreventsOverlapAndKeepsOneAssignment() throws Exception {
        String employeeId = "AS" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String phone = "08" + String.format("%010d", Math.floorMod(UUID.randomUUID().getLeastSignificantBits(), 10_000_000_000L));
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                statement.executeUpdate("insert into NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) "
                        + "values(N'" + employeeId + "',N'Audit shift',N'not-a-password',N'Nhân viên',N'" + phone + "')");
                callAssignShift(connection, employeeId, "AUDIT-1",
                        LocalDateTime.of(2035, 2, 10, 8, 0), LocalDateTime.of(2035, 2, 10, 16, 0));
                assertThatThrownBy(() -> callAssignShift(connection, employeeId, "AUDIT-2",
                        LocalDateTime.of(2035, 2, 10, 12, 0), LocalDateTime.of(2035, 2, 10, 20, 0)))
                        .isInstanceOf(java.sql.SQLException.class)
                        .satisfies(error -> assertThat(((java.sql.SQLException) error).getErrorCode()).isEqualTo(51004));
                try (var result = statement.executeQuery("select count(*) from CaLamViecNhanVien where maNhanVien=N'" + employeeId + "'")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getInt(1)).isEqualTo(1);
                }
            } finally {
                statement.executeUpdate("delete from NhatKyKiemSoat where nguoiThucHien=N'AUDIT' and duLieuSau=N'" + employeeId + "'");
                statement.executeUpdate("delete from CaLamViecNhanVien where maNhanVien=N'" + employeeId + "'");
                statement.executeUpdate("delete from NhanVien where maNhanVien=N'" + employeeId + "'");
            }
        }
    }

    private void callAssignShift(java.sql.Connection connection, String employeeId, String code,
                                 LocalDateTime startsAt, LocalDateTime endsAt) throws Exception {
        try (var call = connection.prepareCall("{call dbo.uspPhanCongCa(?,?,?,?,?,?)}")) {
            call.setString(1, employeeId);
            call.setObject(2, startsAt.toLocalDate());
            call.setString(3, code);
            call.setObject(4, startsAt);
            call.setObject(5, endsAt);
            call.setString(6, "AUDIT");
            call.execute();
        }
    }

    private void assertDatabaseObjects(String type, Set<String> expectedNames) throws Exception {
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("select name from sys.objects where type=?")) {
            statement.setString(1, type);
            Set<String> actual = new HashSet<>();
            try (var result = statement.executeQuery()) {
                while (result.next()) actual.add(result.getString(1));
            }
            assertThat(actual).containsAll(expectedNames);
        }
    }

    @Test
    /** Given phone columns production, When đọc metadata, Then NOT NULL và unique được bảo vệ bằng SQL. */
    void employeeAndCustomerPhoneColumnsAreNotNullAndUniqueInSql() {
        assertPhoneConstraint("NhanVien");
        assertPhoneConstraint("TaiKhoanKhachHang");
    }

    @Test
    /** Metadata phải khớp trọn bộ bảng và quy ước PascalCase/camelCase đã chốt. */
    void physicalSchemaMatchesTheVietnameseNamingContract() throws Exception {
        Set<String> expectedTables = Set.of(
                "BanGhiChongTrung", "BanGiaoTienCa", "BienDongKhoDichVu", "BienDongTonKho", "BienLai",
                "ButToanTaiChinh", "CaLamViecNhanVien", "ChamCong", "ChiTietDatPhong", "ChiTietTienBanGiao",
                "ChuyenPhong", "CongNoDoiTac", "DatDichVuKhachSan", "DichVu", "DieuChinhHoaDon", "DonNghiPhep",
                "GiaoDichThanhToan", "HangDoiThongBao", "HinhAnhLoaiPhong", "HinhAnhPhong", "HoaDon", "HoaDonGiaTriGiaTang",
                "KetQuaChecklistBuongPhong", "KhachLuuTru", "KhoanChi", "KiemTraBuongPhong", "LichSuGiaDichVu",
                "LichSuGiaLoaiPhong", "LichSuHangThanhVien", "LoaiPhong", "LoaiPhongTienNghi", "MaLamMoiDangNhap",
                "MatHangTonKho", "MauChecklistBuongPhong", "NhanVien", "NhatKyKiemSoat", "NhiemVuBuongPhong",
                "NhomKhoaChongTrung", "PhieuBaoTri", "PhieuCongViecKyThuat", "PhieuDatPhong", "Phong",
                "SuCoThietBi", "SuDungDichVu", "SuKienDangNhapNhanVien", "TaiKhoanKhachHang", "TaiSanKyThuat",
                "ThanhToanCongNoDoiTac", "ThietBiPhong", "TienNghi", "YeuCauPheDuyet", "YeuCauThanhToanVnpay");

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            Set<String> actualTables = new HashSet<>();
            try (var result = statement.executeQuery("select table_name from information_schema.tables "
                    + "where table_schema='dbo' and table_type='BASE TABLE' "
                    + "and table_name <> 'flyway_schema_history'")) {
                while (result.next()) actualTables.add(result.getString(1));
            }
            assertThat(actualTables).containsExactlyInAnyOrderElementsOf(expectedTables);
            assertThat(actualTables).allMatch(name -> name.matches("[A-Z][A-Za-z0-9]*"));

            try (var result = statement.executeQuery("select table_name,column_name from information_schema.columns "
                    + "where table_schema='dbo' and table_name <> 'flyway_schema_history'")) {
                while (result.next()) {
                    assertThat(result.getString(2))
                            .as("physical column %s.%s", result.getString(1), result.getString(2))
                            .matches("[a-z][A-Za-z0-9]*");
                }
            }

            assertThat(actualTables).hasSize(52);
            assertColumnCount(statement, 479);
            assertConstraintCount(statement, "FOREIGN KEY", 52);
            assertConstraintCount(statement, "UNIQUE", 26);
            assertConstraintCount(statement, "CHECK", 130);

            try (var result = statement.executeQuery("select constraint_name from information_schema.table_constraints "
                    + "where table_schema='dbo' and LTRIM(RTRIM(constraint_type)) <> 'PRIMARY KEY'")) {
                while (result.next()) {
                    assertThat(result.getString(1)).matches("(fk|uk|chk)[A-Z][A-Za-z0-9]*");
                }
            }
            try (var result = statement.executeQuery("select distinct i.name from sys.indexes i "
                    + "join sys.tables t on t.object_id=i.object_id "
                    + "join sys.schemas s on s.schema_id=t.schema_id "
                    + "where s.name='dbo' and t.name <> 'flyway_schema_history' and i.is_primary_key=0")) {
                while (result.next()) {
                    assertThat(result.getString(1)).matches("(idx|fk|uk)[A-Z][A-Za-z0-9]*");
                }
            }
        }
    }

    @Test
    /** Từ điển giá trị phải khớp metadata đầy đủ; so sánh sai dấu/chữ hoa phải bị CHECK chặn. */
    void everyDictionaryColumnUsesExactCollationAndRejectsAccentlessLookalikes() throws Exception {
        Set<String> expectedColumns = valueDictionaryColumns();
        assertThat(expectedColumns).hasSize(57);
        String auditRun = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String invalidEmployeeCode = "AC" + auditRun;
        String leaveEmployeeCode = "AL" + auditRun;
        String invalidServiceCode = "SV" + auditRun;
        String invalidEmployeePhone = "09" + String.format("%010d",
                Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 10_000_000_000L));
        String leaveEmployeePhone = "09" + String.format("%010d",
                Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 10_000_000_000L));
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                java.util.Map<String, String> actual = new java.util.HashMap<>();
                try (var result = statement.executeQuery("select table_name, column_name, collation_name "
                        + "from information_schema.columns where table_schema='dbo' and collation_name is not null")) {
                    while (result.next()) actual.put(result.getString(1) + "." + result.getString(2), result.getString(3));
                }
                assertThat(actual.keySet()).containsAll(expectedColumns);
                for (String column : expectedColumns) {
                    assertThat(actual.get(column)).as("collation for %s", column).isEqualTo("Vietnamese_100_CS_AS");
                }
                assertThatThrownBy(() -> statement.executeUpdate("insert into NhanVien "
                        + "(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai, trangThaiLamViec) "
                        + "values ('" + invalidEmployeeCode + "', 'Audit', 'not-a-password', 'Lễ tân', '"
                        + invalidEmployeePhone + "', 'dang lam viec')"))
                        .as("accentless employee status must violate the database check")
                        .isInstanceOf(java.sql.SQLException.class);
                assertThatThrownBy(() -> statement.executeUpdate("insert into DichVu "
                        + "(maDichVu, ten, gia, danhMuc) values ('" + invalidServiceCode + "', 'Audit', 0, 'dich vu tai phong')"))
                        .as("accentless service category must violate the database check")
                        .isInstanceOf(java.sql.SQLException.class);
                statement.executeUpdate("insert into NhanVien "
                        + "(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) "
                        + "values ('" + leaveEmployeeCode + "', 'Audit leave', 'not-a-password', N'Lễ tân', '"
                        + leaveEmployeePhone + "')");
                assertThatThrownBy(() -> statement.executeUpdate("insert into DonNghiPhep "
                        + "(maNhanVien, loaiNghiPhep, ngayBatDau, ngayKetThuc, lyDo, nguoiYeuCau, trangThai) "
                        + "values ('" + leaveEmployeeCode + "', N'Nghỉ phép năm', '2035-01-10', '2035-01-11', N'Audit', '"
                        + leaveEmployeeCode + "', N'dang phe duyet')"))
                        .as("leave status outside the Vietnamese dictionary must violate CHECK")
                        .isInstanceOf(java.sql.SQLException.class);
            } finally {
                statement.executeUpdate("delete from DonNghiPhep where maNhanVien in ('" + invalidEmployeeCode + "','"
                        + leaveEmployeeCode + "') or nguoiYeuCau in ('" + invalidEmployeeCode + "','" + leaveEmployeeCode + "')");
                statement.executeUpdate("delete from NhanVien where maNhanVien in ('" + invalidEmployeeCode + "','"
                        + leaveEmployeeCode + "')");
                statement.executeUpdate("delete from DichVu where maDichVu='" + invalidServiceCode + "'");
            }
        }
    }

    @Test
    /** Trạng thái đặt phòng phải thuộc từ điển, không chỉ dựa vào bộ chuyển đổi Java. */
    void reservationStatusCheckRejectsValuesOutsideTheDictionary() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            try {
                statement.executeUpdate("insert into KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) "
                        + "values(N'Audit status','0999999995','999999999995')");
                long guestId;
                try (var result = statement.executeQuery("select maKhachLuuTru from KhachLuuTru "
                        + "where soDienThoai='0999999995'")) {
                    assertThat(result.next()).isTrue();
                    guestId = result.getLong(1);
                }
                long invalidGuestId = guestId;
                assertThatThrownBy(() -> statement.executeUpdate("insert into PhieuDatPhong "
                        + "(maKhachLuuTru,trangThai) values(" + invalidGuestId + ",N'pending')"))
                        .as("reservation status outside the dictionary must violate CHECK")
                        .isInstanceOf(java.sql.SQLException.class);
            } finally {
                connection.rollback();
            }
        }
    }

    @Test
    /** Dòng phòng đã hủy không được truy vấn native SQL tính là đang chiếm chỗ. */
    void cancelledReservationRoomDoesNotBlockAvailability() throws Exception {
        LocalDateTime from = LocalDateTime.of(2035, 1, 10, 14, 0);
        LocalDateTime to = LocalDateTime.of(2035, 1, 11, 12, 0);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.executeUpdate("insert into LoaiPhong(maLoaiPhong,ten,giaTheoNgay) values(N'AUDIT-RT',N'Audit',100000)");
            statement.executeUpdate("insert into Phong(maPhong,maLoaiPhong,trangThai) values(N'AUDIT-R',N'AUDIT-RT',N'Sẵn sàng')");
            LocalDateTime pointProbe = from.plusHours(1);
            assertThat(reservationOverlap.overlap("AUDIT-R", pointProbe, pointProbe.plusNanos(1), LocalDateTime.now(overlapClock))).isFalse();
            statement.executeUpdate("insert into KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) "
                    + "values(N'Audit','0999999998','999999999998')");
            long guestId;
            try (var result = statement.executeQuery("select maKhachLuuTru from KhachLuuTru where soDienThoai='0999999998'")) {
                assertThat(result.next()).isTrue();
                guestId = result.getLong(1);
            }
            statement.executeUpdate("insert into PhieuDatPhong(maKhachLuuTru,trangThai) values(" + guestId + ",N'Đã hủy')");
            long reservationId;
            try (var result = statement.executeQuery("select cast(scope_identity() as bigint)")) {
                assertThat(result.next()).isTrue();
                reservationId = result.getLong(1);
            }
            statement.executeUpdate("insert into ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,"
                    + "thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai) values(" + reservationId
                    + ",N'AUDIT-R','2035-01-10 14:00:00','2035-01-11 12:00:00','2035-01-11 12:00:00',N'Đã hủy')");

            assertThat(reservationOverlap.overlap("AUDIT-R", from, to, LocalDateTime.now(overlapClock))).isFalse();
            statement.executeUpdate("update PhieuDatPhong set trangThai=N'Đã xác nhận' where maPhieuDatPhong=" + reservationId);
            statement.executeUpdate("update ChiTietDatPhong set trangThai=N'Đã giữ phòng' where maPhieuDatPhong=" + reservationId);
            assertThat(reservationOverlap.overlap("AUDIT-R", from, to, LocalDateTime.now(overlapClock))).isTrue();
            assertThat(reservationOverlap.overlap("AUDIT-R", pointProbe, pointProbe.plusNanos(1), LocalDateTime.now(overlapClock))).isTrue();

            statement.executeUpdate("delete from PhieuDatPhong where maPhieuDatPhong=" + reservationId);
            statement.executeUpdate("delete from KhachLuuTru where maKhachLuuTru=" + guestId);
            statement.executeUpdate("delete from Phong where maPhong=N'AUDIT-R'");
            statement.executeUpdate("delete from LoaiPhong where maLoaiPhong=N'AUDIT-RT'");
        }
    }

    @Test
    /** Booking online trả tại khách sạn chỉ chiếm lịch sau khi lễ tân xác nhận. */
    void payAtHotelDraftDoesNotBlockUntilFrontDeskConfirms() throws Exception {
        LocalDateTime from = LocalDateTime.of(2035, 2, 10, 14, 0);
        LocalDateTime to = LocalDateTime.of(2035, 2, 11, 12, 0);
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try {
                statement.executeUpdate("insert into LoaiPhong(maLoaiPhong,ten,giaTheoNgay) "
                        + "values(N'AUDPHRT',N'Audit pay hotel',100000)");
                statement.executeUpdate("insert into Phong(maPhong,maLoaiPhong,trangThai) "
                        + "values(N'AUDPHR',N'AUDPHRT',N'Sẵn sàng')");
                statement.executeUpdate("insert into KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) "
                        + "values(N'Audit pay hotel','0999999997','999999999997')");
                long guestId;
                try (var result = statement.executeQuery("select maKhachLuuTru from KhachLuuTru "
                        + "where soDienThoai='0999999997'")) {
                    assertThat(result.next()).isTrue();
                    guestId = result.getLong(1);
                }
                statement.executeUpdate("insert into TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) "
                        + "values(" + guestId + ",'0999999997','not-a-password')");
                long customerAccountId;
                try (var result = statement.executeQuery("select cast(scope_identity() as bigint)")) {
                    assertThat(result.next()).isTrue();
                    customerAccountId = result.getLong(1);
                }
                statement.executeUpdate("insert into PhieuDatPhong(maKhachLuuTru,maTaiKhoanKhachHang,trangThai,"
                        + "trangThaiThanhToanCoc,phuongThucBaoDam) values(" + guestId + ","
                        + customerAccountId + ",N'Bản nháp',N'Không yêu cầu',N'Tại khách sạn')");
                long reservationId;
                try (var result = statement.executeQuery("select cast(scope_identity() as bigint)")) {
                    assertThat(result.next()).isTrue();
                    reservationId = result.getLong(1);
                }
                statement.executeUpdate("insert into ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,"
                        + "thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai) values(" + reservationId
                        + ",N'AUDPHR','2035-02-10 14:00:00','2035-02-11 12:00:00',"
                        + "'2035-02-11 12:00:00',N'Đã giữ phòng')");

                assertThat(reservationOverlap.overlap("AUDPHR", from, to, LocalDateTime.now(overlapClock))).isFalse();
                statement.executeUpdate("update PhieuDatPhong set trangThai=N'Đã xác nhận' "
                        + "where maPhieuDatPhong=" + reservationId);
                assertThat(reservationOverlap.overlap("AUDPHR", from, to, LocalDateTime.now(overlapClock))).isTrue();
            } finally {
                statement.executeUpdate("delete from PhieuDatPhong where maKhachLuuTru in "
                        + "(select maKhachLuuTru from KhachLuuTru where soDienThoai='0999999997')");
                statement.executeUpdate("delete from TaiKhoanKhachHang where soDienThoai='0999999997'");
                statement.executeUpdate("delete from KhachLuuTru where soDienThoai='0999999997'");
                statement.executeUpdate("delete from Phong where maPhong=N'AUDPHR'");
                statement.executeUpdate("delete from LoaiPhong where maLoaiPhong=N'AUDPHRT'");
            }
        }
    }

    private void assertConstraintCount(java.sql.Statement statement, String type, int expected) throws Exception {
        String sql = "UNIQUE".equals(type)
                ? "select count(*) from sys.indexes i join sys.tables t on t.object_id=i.object_id "
                    + "join sys.schemas s on s.schema_id=t.schema_id where s.name='dbo' "
                    + "and t.name <> 'flyway_schema_history' and i.is_unique=1 and i.is_primary_key=0"
                : "select count(*) from information_schema.table_constraints "
                    + "where table_schema='dbo' and constraint_type='" + type + "'";
        try (var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).as("%s constraint count", type).isEqualTo(expected);
        }
    }

    private void assertColumnCount(java.sql.Statement statement, int expected) throws Exception {
        try (var result = statement.executeQuery("select count(*) from information_schema.columns c "
                + "join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name "
                + "where c.table_schema='dbo' and t.table_type='BASE TABLE' "
                + "and c.table_name <> 'flyway_schema_history'")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).as("physical business column count").isEqualTo(expected);
        }
    }

    /** Kiểm tra metadata column/index theo table được truyền, không sửa schema trong test. */
    private void assertPhoneConstraint(String tableName) {
        try (var connection = getConnection()) {
            try (var columns = connection.prepareStatement(
                    "select is_nullable from information_schema.columns "
                            + "where table_schema = 'dbo' and table_name = ? and column_name = 'soDienThoai'")) {
                columns.setString(1, tableName);
                try (var result = columns.executeQuery()) {
                    assertThat(result.next()).as("soDienThoai column in %s", tableName).isTrue();
                    assertThat(result.getString("is_nullable")).isEqualTo("NO");
                }
            }
            try (var indexes = connection.prepareStatement(
                    "select count(*) from sys.indexes i "
                            + "join sys.index_columns ic on ic.object_id=i.object_id and ic.index_id=i.index_id "
                            + "join sys.columns c on c.object_id=ic.object_id and c.column_id=ic.column_id "
                            + "join sys.tables t on t.object_id=i.object_id "
                            + "join sys.schemas s on s.schema_id=t.schema_id "
                            + "where s.name = 'dbo' and t.name = ? "
                            + "and c.name = 'soDienThoai' and i.is_unique = 1")) {
                indexes.setString(1, tableName);
                try (var result = indexes.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getInt(1)).as("unique index on %s.soDienThoai", tableName).isGreaterThan(0);
                }
            }
        } catch (Exception e) {
            throw new AssertionError("Cannot inspect SQL constraints for " + tableName, e);
        }
    }

    /** Mở connection từ DataSource cho các assertion metadata SQL. */
    private java.sql.Connection getConnection() throws java.sql.SQLException {
        return dataSource.getConnection();
    }

    /** Đọc các cột miền giá trị từ CSV làm nguồn đối chiếu cho kiểm thử SQL Server. */
    private Set<String> valueDictionaryColumns() throws Exception {
        Path dictionary = Stream.of(Path.of("docs/doi-chieu-gia-tri-database.csv"),
                        Path.of("../docs/doi-chieu-gia-tri-database.csv"))
                .filter(Files::isRegularFile).findFirst()
                .orElseThrow(() -> new IllegalStateException("Cannot locate docs/doi-chieu-gia-tri-database.csv"));
        try (var lines = Files.lines(dictionary)) {
            return lines.skip(1).map(line -> line.split(",", -1))
                    .filter(parts -> parts.length >= 4)
                    .map(parts -> parts[3].trim())
                    .filter(value -> !value.isEmpty())
                    .collect(Collectors.toSet());
        }
    }
}
