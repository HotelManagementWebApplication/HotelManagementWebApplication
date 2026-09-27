package com.hospitality.mis;



import com.hospitality.mis.dao.room.JpaReservationOverlapAdapter;
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
    @Autowired JpaReservationOverlapAdapter reservationOverlap;


    @Test

    /** Given SQL Server đã chạy baseline demo, When validate/info, Then migration line và JPA validate đều hợp lệ. */
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
        assertThat(appliedVersions).containsExactly("1");
    }

    @Test
    /** Given phone columns production, When đọc metadata, Then NOT NULL và unique được bảo vệ bằng SQL. */
    void employeeAndCustomerPhoneColumnsAreNotNullAndUniqueInSql() {
        assertPhoneConstraint("NhanVien");
        assertPhoneConstraint("TaiKhoanKhachHang");
    }

    @Test
    /** Metadata phải khớp trọn bộ 51 bảng và quy ước PascalCase/camelCase đã chốt. */
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
                "ThanhToanCongNoDoiTac", "ThietBiPhong", "TienNghi", "YeuCauPheDuyet");

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

            assertThat(actualTables).hasSize(51);
            assertColumnCount(statement, 459);
            assertConstraintCount(statement, "FOREIGN KEY", 51);
            assertConstraintCount(statement, "UNIQUE", 25);
            assertConstraintCount(statement, "CHECK", 122);

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

            assertThat(reservationOverlap.hasOverlap("AUDIT-R", from, to)).isFalse();
            statement.executeUpdate("update PhieuDatPhong set trangThai=N'Đã xác nhận' where maPhieuDatPhong=" + reservationId);
            statement.executeUpdate("update ChiTietDatPhong set trangThai=N'Đã giữ phòng' where maPhieuDatPhong=" + reservationId);
            assertThat(reservationOverlap.hasOverlap("AUDIT-R", from, to)).isTrue();

            statement.executeUpdate("delete from PhieuDatPhong where maPhieuDatPhong=" + reservationId);
            statement.executeUpdate("delete from KhachLuuTru where maKhachLuuTru=" + guestId);
            statement.executeUpdate("delete from Phong where maPhong=N'AUDIT-R'");
            statement.executeUpdate("delete from LoaiPhong where maLoaiPhong=N'AUDIT-RT'");
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
        try (var result = statement.executeQuery("select count(*) from information_schema.columns "
                + "where table_schema='dbo' and table_name <> 'flyway_schema_history'")) {
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
