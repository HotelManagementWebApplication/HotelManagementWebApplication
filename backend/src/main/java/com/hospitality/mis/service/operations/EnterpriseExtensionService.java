package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EnterpriseDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Các use case mở rộng phục vụ màn hình kế toán, HR, kho và kỹ thuật. */
@Service
public class EnterpriseExtensionService {
    private static final BigDecimal VAT_RATE = new BigDecimal("8.00");
    private final JdbcTemplate jdbc;

    public EnterpriseExtensionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.OtaReconciliationResponse> ota() {
        return jdbc.query("""
                SELECT r.id, g.full_name, COALESCE(MIN(rr.room_id), ''), r.booking_source,
                       CASE WHEN r.ota_gross_revenue > 0 THEN r.ota_gross_revenue ELSE COALESCE(i.amount_due, 0) END,
                       r.ota_commission,
                       CASE WHEN r.ota_net_revenue > 0 THEN r.ota_net_revenue
                            ELSE (CASE WHEN r.ota_gross_revenue > 0 THEN r.ota_gross_revenue ELSE COALESCE(i.amount_due, 0) END) - r.ota_commission END,
                       r.ota_reconciliation_status, r.booked_at
                FROM reservations r JOIN guests g ON g.id=r.guest_id
                LEFT JOIN reservation_rooms rr ON rr.reservation_id=r.id
                LEFT JOIN invoices i ON i.reservation_id=r.id
                WHERE r.booking_source <> 'DIRECT'
                GROUP BY r.id, g.full_name, r.booking_source, r.ota_gross_revenue, r.ota_commission,
                         r.ota_net_revenue, r.ota_reconciliation_status, r.booked_at, i.amount_due
                ORDER BY r.booked_at DESC
                """, (rs, n) -> new EnterpriseDtos.OtaReconciliationResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getBigDecimal(7), rs.getString(8),
                rs.getTimestamp(9).toLocalDateTime()));
    }

    @Transactional
    public EnterpriseDtos.OtaReconciliationResponse updateOtaStatus(long reservationId, String status) {
        int changed = jdbc.update("UPDATE reservations SET ota_reconciliation_status=? WHERE id=? AND booking_source<>'DIRECT'",
                status.trim().toUpperCase(), reservationId);
        if (changed == 0) throw new DomainException("OTA_RESERVATION_NOT_FOUND", "Không tìm thấy booking OTA");
        return ota().stream().filter(row -> row.reservationId().equals(reservationId)).findFirst()
                .orElseThrow(() -> new DomainException("OTA_RESERVATION_NOT_FOUND", "Không tìm thấy booking OTA"));
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.VatInvoiceResponse> vatInvoices() {
        return jdbc.query("SELECT id, invoice_id, vat_invoice_number, tax_rate, taxable_amount, tax_amount, total_amount, customer_type, customer_name, tax_code, company_name, company_address, status, xml_status, issued_at, created_by FROM vat_invoices ORDER BY issued_at DESC",
                (rs, n) -> vat(rs));
    }

    @Transactional
    public EnterpriseDtos.VatInvoiceResponse createVat(EnterpriseDtos.VatInvoiceRequest request, String actor) {
        BigDecimal taxable = request.taxableAmount();
        if (taxable == null) taxable = jdbc.query("SELECT amount_due FROM invoices WHERE id=?", rs -> rs.next() ? rs.getBigDecimal(1) : null, request.invoiceId());
        if (taxable == null) throw new DomainException("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn thanh toán");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM vat_invoices WHERE invoice_id=?", Integer.class, request.invoiceId()) > 0)
            throw new DomainException("VAT_EXISTS", "Hóa đơn VAT cho folio này đã tồn tại");
        BigDecimal tax = taxable.multiply(VAT_RATE).divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        String number = "VAT-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        jdbc.update("INSERT INTO vat_invoices (invoice_id, vat_invoice_number, tax_rate, taxable_amount, tax_amount, total_amount, customer_type, customer_name, tax_code, company_name, company_address, status, xml_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', 'NOT_EXPORTED', ?)",
                request.invoiceId(), number, VAT_RATE, taxable, tax, taxable.add(tax), request.customerType().trim().toUpperCase(),
                request.customerName().trim(), request.taxCode(), request.companyName(), request.companyAddress(), actor);
        long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return vatInvoices().stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional
    public String exportVatXml(long id) {
        var row = jdbc.query("SELECT id, invoice_id, vat_invoice_number, tax_rate, taxable_amount, tax_amount, total_amount, customer_type, customer_name, tax_code, company_name, company_address, status, xml_status, issued_at, created_by FROM vat_invoices WHERE id=?",
                rs -> rs.next() ? vat(rs) : null, id);
        if (row == null) throw new DomainException("VAT_NOT_FOUND", "Không tìm thấy hóa đơn VAT");
        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<Invoice><InvoiceNumber>" + esc(row.vatInvoiceNumber()) + "</InvoiceNumber>" +
                "<TaxRate>" + row.taxRate() + "</TaxRate><TaxableAmount>" + row.taxableAmount() + "</TaxableAmount>" +
                "<TaxAmount>" + row.taxAmount() + "</TaxAmount><TotalAmount>" + row.totalAmount() + "</TotalAmount>" +
                "<Customer><Type>" + esc(row.customerType()) + "</Type><Name>" + esc(row.customerName()) + "</Name>" +
                "<TaxCode>" + esc(row.taxCode()) + "</TaxCode><CompanyName>" + esc(row.companyName()) + "</CompanyName><Address>" + esc(row.companyAddress()) + "</Address></Customer></Invoice>";
        jdbc.update("UPDATE vat_invoices SET xml_status='EXPORTED', xml_content=? WHERE id=?", xml, id);
        return xml;
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.AttendanceResponse> attendance(LocalDate date) {
        String sql = "SELECT id, employee_id, work_date, clock_in, clock_out, status, source, device_event_id, note FROM attendance_records " +
                (date == null ? "" : "WHERE work_date=? ") + "ORDER BY work_date DESC, employee_id";
        return date == null ? jdbc.query(sql, this::attendanceRow) : jdbc.query(sql, this::attendanceRow, date);
    }

    @Transactional
    public List<EnterpriseDtos.AttendanceResponse> importAttendance(EnterpriseDtos.AttendanceImportRequest request, String actor) {
        for (var row : request.records()) {
            jdbc.update("INSERT INTO attendance_records (employee_id, work_date, clock_in, clock_out, status, source, device_event_id, note, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE clock_in=VALUES(clock_in), clock_out=VALUES(clock_out), status=VALUES(status), source=VALUES(source), device_event_id=VALUES(device_event_id), note=VALUES(note), imported_by=VALUES(imported_by), imported_at=CURRENT_TIMESTAMP",
                    row.employeeId(), row.workDate(), row.clockIn(), row.clockOut(), row.status().trim().toUpperCase(), row.source() == null ? "MANUAL" : row.source().trim().toUpperCase(), row.deviceEventId(), row.note(), actor);
        }
        return attendance(null);
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.LeaveResponse> leaves(String status) {
        String sql = "SELECT id, employee_id, leave_type, start_date, end_date, reason, shift_swap_with, status, requested_by, approver, decided_at, created_at FROM leave_requests " + (status == null || status.isBlank() ? "" : "WHERE status=? ") + "ORDER BY created_at DESC";
        return status == null || status.isBlank() ? jdbc.query(sql, this::leaveRow) : jdbc.query(sql, this::leaveRow, status.trim().toUpperCase());
    }

    @Transactional
    public EnterpriseDtos.LeaveResponse createLeave(EnterpriseDtos.LeaveRequest request, String actor) {
        if (request.endDate().isBefore(request.startDate())) throw new DomainException("INVALID_LEAVE_PERIOD", "Khoảng nghỉ không hợp lệ");
        jdbc.update("INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, shift_swap_with, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)", request.employeeId(), request.leaveType().trim().toUpperCase(), request.startDate(), request.endDate(), request.reason().trim(), request.shiftSwapWith(), actor);
        long id = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional
    public EnterpriseDtos.LeaveResponse decideLeave(long id, boolean approve, String actor) {
        int changed = jdbc.update("UPDATE leave_requests SET status=?, approver=?, decided_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'", approve ? "APPROVED" : "REJECTED", actor, id);
        if (changed == 0) throw new DomainException("LEAVE_NOT_PENDING", "Đơn nghỉ không còn chờ duyệt");
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.StockItemResponse> linen() {
        return jdbc.query("SELECT id, name, category, unit, current_quantity, safety_threshold, service_id, active FROM stock_items WHERE (UPPER(category) IN ('LINEN', 'TOWELS', 'AMENITIES', 'MINIBAR') OR category='LINEN') AND active=TRUE ORDER BY name", this::stockRow);
    }

    @Transactional
    public EnterpriseDtos.StockItemResponse moveStock(EnterpriseDtos.StockMovementRequest request, String actor) {
        var current = jdbc.query("SELECT current_quantity FROM stock_items WHERE id=? AND active=TRUE FOR UPDATE", rs -> rs.next() ? rs.getInt(1) : null, request.itemId());
        if (current == null) throw new DomainException("STOCK_ITEM_NOT_FOUND", "Không tìm thấy mặt hàng tồn kho");
        String type = request.movementType().trim().toUpperCase();
        int next = switch (type) { case "RECEIVE", "RETURN" -> current + request.quantity(); case "ISSUE", "WASTE" -> current - request.quantity(); case "ADJUST" -> request.quantity(); default -> throw new DomainException("INVALID_STOCK_MOVEMENT", "Loại biến động tồn kho không hợp lệ"); };
        if (next < 0) throw new DomainException("INSUFFICIENT_STOCK", "Tồn kho đồ vải không đủ");
        jdbc.update("UPDATE stock_items SET current_quantity=? WHERE id=?", next, request.itemId());
        jdbc.update("INSERT INTO stock_movements (item_id, movement_type, quantity, actor_id, reason) VALUES (?, ?, ?, ?, ?)", request.itemId(), type, request.quantity(), actor, request.reason());
        return jdbc.query("SELECT id, name, category, unit, current_quantity, safety_threshold, service_id, active FROM stock_items WHERE id=?", rs -> rs.next() ? stockRow(rs, 0) : null, request.itemId());
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.TechnicalAssetResponse> assets() {
        return jdbc.query("SELECT id, name, category, location_type, room_id, floor, location, brand_model, installed_on, next_maintenance, status, original_value, note, active FROM technical_assets WHERE active=TRUE ORDER BY COALESCE(floor, 0), name", this::assetRow);
    }

    @Transactional
    public EnterpriseDtos.TechnicalAssetResponse createAsset(EnterpriseDtos.TechnicalAssetRequest request) {
        jdbc.update("INSERT INTO technical_assets (id, name, category, location_type, room_id, floor, location, brand_model, installed_on, next_maintenance, status, original_value, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", request.id(), request.name(), request.category(), request.locationType(), request.roomId(), request.floor(), request.location(), request.brandModel(), request.installedOn(), request.nextMaintenance(), request.status() == null ? "GOOD" : request.status().toUpperCase(), request.originalValue() == null ? BigDecimal.ZERO : request.originalValue(), request.note());
        return assets().stream().filter(row -> row.id().equals(request.id())).findFirst().orElseThrow();
    }

    @Transactional
    public EnterpriseDtos.TechnicalAssetResponse updateAssetStatus(String id, String status) {
        if (jdbc.update("UPDATE technical_assets SET status=? WHERE id=?", status.trim().toUpperCase(), id) == 0)
            throw new DomainException("ASSET_NOT_FOUND", "Không tìm thấy tài sản kỹ thuật");
        return assets().stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    private EnterpriseDtos.VatInvoiceResponse vat(java.sql.ResultSet rs) throws java.sql.SQLException { return new EnterpriseDtos.VatInvoiceResponse(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getBigDecimal(4), rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getBigDecimal(7), rs.getString(8), rs.getString(9), rs.getString(10), rs.getString(11), rs.getString(12), rs.getString(13), rs.getString(14), rs.getTimestamp(15).toLocalDateTime(), rs.getString(16)); }
    private EnterpriseDtos.AttendanceResponse attendanceRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.AttendanceResponse(rs.getLong(1), rs.getString(2), rs.getDate(3).toLocalDate(), ts(rs, 4), ts(rs, 5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9)); }
    private EnterpriseDtos.LeaveResponse leaveRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.LeaveResponse(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getDate(4).toLocalDate(), rs.getDate(5).toLocalDate(), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9), rs.getString(10), ts(rs, 11), ts(rs, 12)); }
    private EnterpriseDtos.StockItemResponse stockRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.StockItemResponse(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5), rs.getInt(6), rs.getString(7), rs.getBoolean(8)); }
    private EnterpriseDtos.TechnicalAssetResponse assetRow(java.sql.ResultSet rs, int n) throws java.sql.SQLException { return new EnterpriseDtos.TechnicalAssetResponse(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), (Integer) rs.getObject(6), rs.getString(7), rs.getString(8), date(rs, 9), date(rs, 10), rs.getString(11), rs.getBigDecimal(12), rs.getString(13), rs.getBoolean(14)); }
    private static LocalDateTime ts(java.sql.ResultSet rs, int index) throws java.sql.SQLException { var value = rs.getTimestamp(index); return value == null ? null : value.toLocalDateTime(); }
    private static LocalDate date(java.sql.ResultSet rs, int index) throws java.sql.SQLException { var value = rs.getDate(index); return value == null ? null : value.toLocalDate(); }
    private static String esc(String value) { if (value == null) return ""; return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;"); }
}
