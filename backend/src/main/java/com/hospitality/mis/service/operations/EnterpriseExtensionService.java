package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EnterpriseDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.sql.PreparedStatement;
import java.sql.Statement;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

/** Các use case mở rộng phục vụ màn hình kế toán, HR, kho và kỹ thuật. */
@Service
public class EnterpriseExtensionService {
    private static final BigDecimal VAT_RATE = new BigDecimal("8.00");
    private static final VietnameseCodeConverters.OtaReconciliationStatusConverter OTA_STATUS = new VietnameseCodeConverters.OtaReconciliationStatusConverter();
    private static final VietnameseCodeConverters.VatCustomerTypeConverter VAT_CUSTOMER_TYPE = new VietnameseCodeConverters.VatCustomerTypeConverter();
    private static final VietnameseCodeConverters.VatInvoiceStatusConverter VAT_STATUS = new VietnameseCodeConverters.VatInvoiceStatusConverter();
    private static final VietnameseCodeConverters.VatXmlStatusConverter VAT_XML_STATUS = new VietnameseCodeConverters.VatXmlStatusConverter();
    private static final VietnameseCodeConverters.AttendanceStatusConverter ATTENDANCE_STATUS = new VietnameseCodeConverters.AttendanceStatusConverter();
    private static final VietnameseCodeConverters.AttendanceSourceConverter ATTENDANCE_SOURCE = new VietnameseCodeConverters.AttendanceSourceConverter();
    private static final VietnameseCodeConverters.LeaveTypeConverter LEAVE_TYPE = new VietnameseCodeConverters.LeaveTypeConverter();
    private static final VietnameseCodeConverters.LeaveStatusConverter LEAVE_STATUS = new VietnameseCodeConverters.LeaveStatusConverter();
    private static final VietnameseCodeConverters.StockCategoryConverter STOCK_CATEGORY = new VietnameseCodeConverters.StockCategoryConverter();
    private static final VietnameseCodeConverters.StockMovementTypeConverter STOCK_MOVEMENT = new VietnameseCodeConverters.StockMovementTypeConverter();
    private static final VietnameseCodeConverters.TechnicalAssetStatusConverter ASSET_STATUS = new VietnameseCodeConverters.TechnicalAssetStatusConverter();
    private static final VietnameseCodeConverters.TechnicalAssetLocationTypeConverter ASSET_LOCATION_TYPE = new VietnameseCodeConverters.TechnicalAssetLocationTypeConverter();
    private final JdbcTemplate jdbc;

    public EnterpriseExtensionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.OtaReconciliationResponse> ota() {
        return jdbc.query("""
                SELECT r.maPhieuDatPhong, g.hoVaTen, COALESCE(MIN(rr.maPhong), ''), r.nguonDatPhong,
                       CASE WHEN r.doanhThuGopOta > 0 THEN r.doanhThuGopOta ELSE COALESCE(i.soTienPhaiTra, 0) END,
                       r.hoaHongOta,
                       GREATEST(CASE WHEN r.doanhThuGopOta > 0 THEN r.doanhThuGopOta ELSE COALESCE(i.soTienPhaiTra, 0) END - r.hoaHongOta, 0),
                       r.trangThaiDoiSoatOta, r.thoiDiemDat
                FROM PhieuDatPhong r JOIN KhachLuuTru g ON g.maKhachLuuTru=r.maKhachLuuTru
                LEFT JOIN ChiTietDatPhong rr ON rr.maPhieuDatPhong=r.maPhieuDatPhong
                LEFT JOIN HoaDon i ON i.maPhieuDatPhong=r.maPhieuDatPhong
                WHERE r.nguonDatPhong <> N'Trực tiếp'
                GROUP BY r.maPhieuDatPhong, g.hoVaTen, r.nguonDatPhong, r.doanhThuGopOta, r.hoaHongOta,
                         r.trangThaiDoiSoatOta, r.thoiDiemDat, i.soTienPhaiTra
                ORDER BY r.thoiDiemDat DESC
                """, (rs, n) -> new EnterpriseDtos.OtaReconciliationResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getBigDecimal(7), OTA_STATUS.convertToEntityAttribute(rs.getString(8)),
                rs.getTimestamp(9).toLocalDateTime()));
    }

    @Transactional
    public EnterpriseDtos.OtaReconciliationResponse updateOtaStatus(long reservationId, String status) {
        int changed = jdbc.update("UPDATE PhieuDatPhong SET trangThaiDoiSoatOta=? WHERE maPhieuDatPhong=? AND nguonDatPhong<>N'Trực tiếp'",
                OTA_STATUS.convertToDatabaseColumn(code(status)), reservationId);
        if (changed == 0) throw new DomainException("OTA_RESERVATION_NOT_FOUND", "Không tìm thấy booking OTA");
        return ota().stream().filter(row -> row.reservationId().equals(reservationId)).findFirst()
                .orElseThrow(() -> new DomainException("OTA_RESERVATION_NOT_FOUND", "Không tìm thấy booking OTA"));
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.VatInvoiceResponse> vatInvoices() {
        return jdbc.query("SELECT maHoaDonGiaTriGiaTang, maHoaDon, soHoaDonGiaTriGiaTang, thueSuat, soTienChiuThue, loaiKhachHang, tenKhachHang, maSoThue, tenCongTy, diaChiCongTy, trangThai, trangThaiXml, thoiDiemPhatHanh, nguoiTao FROM HoaDonGiaTriGiaTang ORDER BY thoiDiemPhatHanh DESC",
                (rs, n) -> vat(rs));
    }

    @Transactional
    public EnterpriseDtos.VatInvoiceResponse createVat(EnterpriseDtos.VatInvoiceRequest request, String actor) {
        BigDecimal taxable = request.taxableAmount();
        if (taxable == null) taxable = jdbc.query("SELECT soTienPhaiTra FROM HoaDon WHERE maHoaDon=?", rs -> rs.next() ? rs.getBigDecimal(1) : null, request.invoiceId());
        if (taxable == null) throw new DomainException("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn thanh toán");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM HoaDonGiaTriGiaTang WHERE maHoaDon=?", Integer.class, request.invoiceId()) > 0)
            throw new DomainException("VAT_EXISTS", "Hóa đơn VAT cho folio này đã tồn tại");
        String number = "VAT-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        long id = insertAndGetKey("INSERT INTO HoaDonGiaTriGiaTang (maHoaDon, soHoaDonGiaTriGiaTang, thueSuat, soTienChiuThue, loaiKhachHang, tenKhachHang, maSoThue, tenCongTy, diaChiCongTy, trangThai, trangThaiXml, nguoiTao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                request.invoiceId(), number, VAT_RATE, taxable, VAT_CUSTOMER_TYPE.convertToDatabaseColumn(code(request.customerType())),
                request.customerName().trim(), request.taxCode(), request.companyName(), request.companyAddress(),
                VAT_STATUS.convertToDatabaseColumn("ISSUED"), VAT_XML_STATUS.convertToDatabaseColumn("NOT_EXPORTED"), actor);
        return vatInvoices().stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional
    public String exportVatXml(long id) {
        var row = jdbc.query("SELECT maHoaDonGiaTriGiaTang, maHoaDon, soHoaDonGiaTriGiaTang, thueSuat, soTienChiuThue, loaiKhachHang, tenKhachHang, maSoThue, tenCongTy, diaChiCongTy, trangThai, trangThaiXml, thoiDiemPhatHanh, nguoiTao FROM HoaDonGiaTriGiaTang WHERE maHoaDonGiaTriGiaTang=?",
                rs -> rs.next() ? vat(rs) : null, id);
        if (row == null) throw new DomainException("VAT_NOT_FOUND", "Không tìm thấy hóa đơn VAT");
        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<Invoice><InvoiceNumber>" + esc(row.vatInvoiceNumber()) + "</InvoiceNumber>" +
                "<TaxRate>" + row.taxRate() + "</TaxRate><TaxableAmount>" + row.taxableAmount() + "</TaxableAmount>" +
                "<TaxAmount>" + row.taxAmount() + "</TaxAmount><TotalAmount>" + row.totalAmount() + "</TotalAmount>" +
                "<Customer><Type>" + esc(row.customerType()) + "</Type><Name>" + esc(row.customerName()) + "</Name>" +
                "<TaxCode>" + esc(row.taxCode()) + "</TaxCode><CompanyName>" + esc(row.companyName()) + "</CompanyName><Address>" + esc(row.companyAddress()) + "</Address></Customer></Invoice>";
        jdbc.update("UPDATE HoaDonGiaTriGiaTang SET trangThaiXml=?, noiDungXml=? WHERE maHoaDonGiaTriGiaTang=?",
                VAT_XML_STATUS.convertToDatabaseColumn("EXPORTED"), xml, id);
        return xml;
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.AttendanceResponse> attendance(LocalDate date) {
        String sql = "SELECT maChamCong, maNhanVien, ngayLamViec, thoiDiemVaoCa, thoiDiemRaCa, trangThai, nguonDuLieu, maSuKienThietBi, ghiChu FROM ChamCong " +
                (date == null ? "" : "WHERE ngayLamViec=? ") + "ORDER BY ngayLamViec DESC, maNhanVien";
        return date == null ? jdbc.query(sql, this::attendanceRow) : jdbc.query(sql, this::attendanceRow, date);
    }

    @Transactional
    public List<EnterpriseDtos.AttendanceResponse> importAttendance(EnterpriseDtos.AttendanceImportRequest request, String actor) {
        for (var row : request.records()) {
            String status = ATTENDANCE_STATUS.convertToDatabaseColumn(code(row.status()));
            String source = ATTENDANCE_SOURCE.convertToDatabaseColumn(row.source() == null ? "MANUAL" : code(row.source()));
            int changed = jdbc.update("UPDATE ChamCong WITH (UPDLOCK, HOLDLOCK) SET thoiDiemVaoCa=?, thoiDiemRaCa=?, trangThai=?, nguonDuLieu=?, maSuKienThietBi=?, ghiChu=?, nguoiNhap=?, thoiDiemNhap=CURRENT_TIMESTAMP WHERE maNhanVien=? AND ngayLamViec=?",
                    row.clockIn(), row.clockOut(), status, source, row.deviceEventId(), row.note(), actor, row.employeeId(), row.workDate());
            if (changed == 0) {
                jdbc.update("INSERT INTO ChamCong (maNhanVien, ngayLamViec, thoiDiemVaoCa, thoiDiemRaCa, trangThai, nguonDuLieu, maSuKienThietBi, ghiChu, nguoiNhap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        row.employeeId(), row.workDate(), row.clockIn(), row.clockOut(), status, source, row.deviceEventId(), row.note(), actor);
            }
        }
        return attendance(null);
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.LeaveResponse> leaves(String status) {
        String sql = "SELECT maDonNghiPhep, maNhanVien, loaiNghiPhep, ngayBatDau, ngayKetThuc, lyDo, maNhanVienDoiCa, trangThai, nguoiYeuCau, nguoiPheDuyet, thoiDiemQuyetDinh, thoiDiemTao FROM DonNghiPhep " + (status == null || status.isBlank() ? "" : "WHERE trangThai=? ") + "ORDER BY thoiDiemTao DESC";
        return status == null || status.isBlank() ? jdbc.query(sql, this::leaveRow)
                : jdbc.query(sql, this::leaveRow, LEAVE_STATUS.convertToDatabaseColumn(code(status)));
    }

    @Transactional
    public EnterpriseDtos.LeaveResponse createLeave(EnterpriseDtos.LeaveRequest request, String actor) {
        if (request.endDate().isBefore(request.startDate())) throw new DomainException("INVALID_LEAVE_PERIOD", "Khoảng nghỉ không hợp lệ");
        long id = insertAndGetKey("INSERT INTO DonNghiPhep (maNhanVien, loaiNghiPhep, ngayBatDau, ngayKetThuc, lyDo, maNhanVienDoiCa, nguoiYeuCau) VALUES (?, ?, ?, ?, ?, ?, ?)",
                request.employeeId(), LEAVE_TYPE.convertToDatabaseColumn(code(request.leaveType())), request.startDate(), request.endDate(), request.reason().trim(), request.shiftSwapWith(), actor);
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional
    public EnterpriseDtos.LeaveResponse decideLeave(long id, boolean approve, String actor) {
        int changed = jdbc.update("UPDATE DonNghiPhep SET trangThai=?, nguoiPheDuyet=?, thoiDiemQuyetDinh=CURRENT_TIMESTAMP WHERE maDonNghiPhep=? AND trangThai=?",
                LEAVE_STATUS.convertToDatabaseColumn(approve ? "APPROVED" : "REJECTED"), actor, id,
                LEAVE_STATUS.convertToDatabaseColumn("PENDING"));
        if (changed == 0) throw new DomainException("LEAVE_NOT_PENDING", "Đơn nghỉ không còn chờ duyệt");
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.StockItemResponse> linen() {
        return jdbc.query("SELECT maMatHang, ten, danhMuc, donViTinh, soLuongHienTai, nguongAnToan, maDichVu, dangHoatDong FROM MatHangTonKho WHERE danhMuc IN (N'Đồ vải', N'Khăn', N'Đồ dùng', N'Minibar') AND dangHoatDong=1 ORDER BY ten", this::stockRow);
    }

    @Transactional
    public EnterpriseDtos.StockItemResponse moveStock(EnterpriseDtos.StockMovementRequest request, String actor) {
        String stockLockSql = "SELECT soLuongHienTai FROM MatHangTonKho WITH (UPDLOCK, ROWLOCK) WHERE maMatHang=? AND dangHoatDong=1";
        var current = jdbc.query(stockLockSql, rs -> rs.next() ? rs.getInt(1) : null, request.itemId());
        if (current == null) throw new DomainException("STOCK_ITEM_NOT_FOUND", "Không tìm thấy mặt hàng tồn kho");
        String type = request.movementType().trim().toUpperCase();
        int next = switch (type) { case "RECEIVE", "RETURN" -> current + request.quantity(); case "ISSUE", "WASTE" -> current - request.quantity(); case "ADJUST" -> request.quantity(); default -> throw new DomainException("INVALID_STOCK_MOVEMENT", "Loại biến động tồn kho không hợp lệ"); };
        if (next < 0) throw new DomainException("INSUFFICIENT_STOCK", "Tồn kho đồ vải không đủ");
        jdbc.update("UPDATE MatHangTonKho SET soLuongHienTai=? WHERE maMatHang=?", next, request.itemId());
        jdbc.update("INSERT INTO BienDongTonKho (maMatHang, loaiBienDong, soLuong, maNguoiThucHien, lyDo) VALUES (?, ?, ?, ?, ?)", request.itemId(), STOCK_MOVEMENT.convertToDatabaseColumn(type), request.quantity(), actor, request.reason());
        return jdbc.query("SELECT maMatHang, ten, danhMuc, donViTinh, soLuongHienTai, nguongAnToan, maDichVu, dangHoatDong FROM MatHangTonKho WHERE maMatHang=?", rs -> rs.next() ? stockRow(rs, 0) : null, request.itemId());
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.TechnicalAssetResponse> assets() {
        return jdbc.query("SELECT maTaiSanKyThuat, ten, danhMuc, loaiViTri, maPhong, tang, viTri, thuongHieuMau, ngayLapDat, ngayBaoTriTiepTheo, trangThai, giaTriBanDau, ghiChu, dangHoatDong FROM TaiSanKyThuat WHERE dangHoatDong=1 ORDER BY COALESCE(tang, 0), ten", this::assetRow);
    }

    @Transactional
    public EnterpriseDtos.TechnicalAssetResponse createAsset(EnterpriseDtos.TechnicalAssetRequest request) {
        jdbc.update("INSERT INTO TaiSanKyThuat (maTaiSanKyThuat, ten, danhMuc, loaiViTri, maPhong, tang, viTri, thuongHieuMau, ngayLapDat, ngayBaoTriTiepTheo, trangThai, giaTriBanDau, ghiChu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", request.id(), request.name(), request.category(), ASSET_LOCATION_TYPE.convertToDatabaseColumn(code(request.locationType())), request.roomId(), request.floor(), request.location(), request.brandModel(), request.installedOn(), request.nextMaintenance(), ASSET_STATUS.convertToDatabaseColumn(request.status() == null ? "GOOD" : code(request.status())), request.originalValue() == null ? BigDecimal.ZERO : request.originalValue(), request.note());
        return assets().stream().filter(row -> row.id().equals(request.id())).findFirst().orElseThrow();
    }

    @Transactional
    public EnterpriseDtos.TechnicalAssetResponse updateAssetStatus(String id, String status) {
        if (jdbc.update("UPDATE TaiSanKyThuat SET trangThai=? WHERE maTaiSanKyThuat=?", ASSET_STATUS.convertToDatabaseColumn(code(status)), id) == 0)
            throw new DomainException("ASSET_NOT_FOUND", "Không tìm thấy tài sản kỹ thuật");
        return assets().stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    private EnterpriseDtos.VatInvoiceResponse vat(java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal rate = rs.getBigDecimal(4);
        BigDecimal taxable = rs.getBigDecimal(5);
        BigDecimal tax = taxable.multiply(rate).divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        return new EnterpriseDtos.VatInvoiceResponse(rs.getLong(1), rs.getLong(2), rs.getString(3), rate, taxable, tax,
                taxable.add(tax), VAT_CUSTOMER_TYPE.convertToEntityAttribute(rs.getString(6)), rs.getString(7),
                rs.getString(8), rs.getString(9), rs.getString(10), VAT_STATUS.convertToEntityAttribute(rs.getString(11)),
                VAT_XML_STATUS.convertToEntityAttribute(rs.getString(12)), rs.getTimestamp(13).toLocalDateTime(), rs.getString(14));
    }
    private EnterpriseDtos.AttendanceResponse attendanceRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.AttendanceResponse(rs.getLong(1), rs.getString(2), rs.getDate(3).toLocalDate(), ts(rs, 4), ts(rs, 5), ATTENDANCE_STATUS.convertToEntityAttribute(rs.getString(6)), ATTENDANCE_SOURCE.convertToEntityAttribute(rs.getString(7)), rs.getString(8), rs.getString(9)); }
    private EnterpriseDtos.LeaveResponse leaveRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.LeaveResponse(rs.getLong(1), rs.getString(2), LEAVE_TYPE.convertToEntityAttribute(rs.getString(3)), rs.getDate(4).toLocalDate(), rs.getDate(5).toLocalDate(), rs.getString(6), rs.getString(7), LEAVE_STATUS.convertToEntityAttribute(rs.getString(8)), rs.getString(9), rs.getString(10), ts(rs, 11), ts(rs, 12)); }
    private EnterpriseDtos.StockItemResponse stockRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.StockItemResponse(rs.getString(1), rs.getString(2), STOCK_CATEGORY.convertToEntityAttribute(rs.getString(3)), rs.getString(4), rs.getInt(5), rs.getInt(6), rs.getString(7), rs.getBoolean(8)); }
    private EnterpriseDtos.TechnicalAssetResponse assetRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.TechnicalAssetResponse(rs.getString(1), rs.getString(2), rs.getString(3), ASSET_LOCATION_TYPE.convertToEntityAttribute(rs.getString(4)), rs.getString(5), (Integer) rs.getObject(6), rs.getString(7), rs.getString(8), date(rs, 9), date(rs, 10), ASSET_STATUS.convertToEntityAttribute(rs.getString(11)), rs.getBigDecimal(12), rs.getString(13), rs.getBoolean(14)); }
    private static String code(String value) { return value == null ? null : value.trim().toUpperCase(java.util.Locale.ROOT); }
    private static LocalDateTime ts(java.sql.ResultSet rs, int index) throws java.sql.SQLException { var value = rs.getTimestamp(index); return value == null ? null : value.toLocalDateTime(); }
    private static LocalDate date(java.sql.ResultSet rs, int index) throws java.sql.SQLException { var value = rs.getDate(index); return value == null ? null : value.toLocalDate(); }
    private static String esc(String value) { if (value == null) return ""; return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;"); }

    private long insertAndGetKey(String sql, Object... args) {
        KeyHolder holder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, holder);
        Number key = holder.getKey();
        if (key == null) throw new IllegalStateException("SQL Server did not return the generated identity key");
        return key.longValue();
    }

}
