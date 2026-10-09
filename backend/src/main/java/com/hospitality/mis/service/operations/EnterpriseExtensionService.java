package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EnterpriseDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters;
import com.hospitality.mis.dao.operations.EnterpriseDatabase;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.LinkedHashMap;
import com.fasterxml.jackson.databind.ObjectMapper;

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
    private final EnterpriseDatabase database;

    public EnterpriseExtensionService(EnterpriseDatabase database) { this.database = database; }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.OtaReconciliationResponse> ota() {
        return database.ota((rs, n) -> new EnterpriseDtos.OtaReconciliationResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getBigDecimal(5), rs.getBigDecimal(6), rs.getBigDecimal(7), OTA_STATUS.convertToEntityAttribute(rs.getString(8)),
                rs.getTimestamp(9).toLocalDateTime()));
    }

    public EnterpriseDtos.OtaReconciliationResponse updateOtaStatus(long reservationId, String status) {
        database.updateOta(reservationId,OTA_STATUS.convertToDatabaseColumn(code(status)));
        return ota().stream().filter(row -> row.reservationId().equals(reservationId)).findFirst()
                .orElseThrow(() -> new DomainException("OTA_RESERVATION_NOT_FOUND", "Không tìm thấy booking OTA"));
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.VatInvoiceResponse> vatInvoices() {
        return database.vatInvoices((rs,n)->vat(rs));
    }

    public EnterpriseDtos.VatInvoiceResponse createVat(EnterpriseDtos.VatInvoiceRequest request, String actor) {
        String number = "VAT-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        long id = database.createVat(request,number,VAT_RATE,VAT_CUSTOMER_TYPE.convertToDatabaseColumn(code(request.customerType())),actor);
        return vatInvoices().stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    public String exportVatXml(long id) {
        var row = database.vatInvoice(id,(rs,n)->vat(rs)).stream().findFirst().orElse(null);
        if (row == null) throw new DomainException("VAT_NOT_FOUND", "Không tìm thấy hóa đơn VAT");
        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                "<Invoice><InvoiceNumber>" + esc(row.vatInvoiceNumber()) + "</InvoiceNumber>" +
                "<TaxRate>" + row.taxRate() + "</TaxRate><TaxableAmount>" + row.taxableAmount() + "</TaxableAmount>" +
                "<TaxAmount>" + row.taxAmount() + "</TaxAmount><TotalAmount>" + row.totalAmount() + "</TotalAmount>" +
                "<Customer><Type>" + esc(row.customerType()) + "</Type><Name>" + esc(row.customerName()) + "</Name>" +
                "<TaxCode>" + esc(row.taxCode()) + "</TaxCode><CompanyName>" + esc(row.companyName()) + "</CompanyName><Address>" + esc(row.companyAddress()) + "</Address></Customer></Invoice>";
        database.saveVatXml(id,xml);
        return xml;
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.AttendanceResponse> attendance(LocalDate date) {
        return database.attendance(date,this::attendanceRow);
    }

    public List<EnterpriseDtos.AttendanceResponse> importAttendance(EnterpriseDtos.AttendanceImportRequest request, String actor) {
        var records=new java.util.ArrayList<LinkedHashMap<String,Object>>();
        for (var row : request.records()) {
            var data=new LinkedHashMap<String,Object>();
            data.put("maNhanVien",row.employeeId()); data.put("ngay",row.workDate().toString());
            data.put("vao",row.clockIn()==null?null:row.clockIn().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            data.put("ra",row.clockOut()==null?null:row.clockOut().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            data.put("trangThai",attendanceStatus(row.status()));data.put("nguon",attendanceSource(row.source()));
            data.put("suKien",row.deviceEventId());data.put("ghiChu",row.note()); records.add(data);
        }
        try { database.importAttendance(new ObjectMapper().writeValueAsString(records),actor); }
        catch(com.fasterxml.jackson.core.JsonProcessingException error) { throw new IllegalStateException("Cannot encode attendance command",error); }
        return attendance(null);
    }

    private static String attendanceStatus(String value) {
        try {
            return ATTENDANCE_STATUS.convertToDatabaseColumn(code(value));
        } catch (IllegalArgumentException exception) {
            throw new DomainException(
                    "INVALID_ATTENDANCE_STATUS",
                    "Trạng thái chấm công không hợp lệ; dùng PRESENT, LATE, ABSENT hoặc ON_LEAVE"
            );
        }
    }

    private static String attendanceSource(String value) {
        try {
            return ATTENDANCE_SOURCE.convertToDatabaseColumn(value == null ? "MANUAL" : code(value));
        } catch (IllegalArgumentException exception) {
            throw new DomainException(
                    "INVALID_ATTENDANCE_SOURCE",
                    "Nguồn chấm công không hợp lệ; dùng MANUAL hoặc BIOMETRIC_IMPORT"
            );
        }
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.LeaveResponse> leaves(String status) {
        return database.leaves(status==null||status.isBlank()?null:LEAVE_STATUS.convertToDatabaseColumn(code(status)),this::leaveRow);
    }

    public EnterpriseDtos.LeaveResponse createLeave(EnterpriseDtos.LeaveRequest request, String actor) {
        if (request.endDate().isBefore(request.startDate())) throw new DomainException("INVALID_LEAVE_PERIOD", "Khoảng nghỉ không hợp lệ");
        long id = database.createLeave(request,LEAVE_TYPE.convertToDatabaseColumn(code(request.leaveType())),actor);
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    public EnterpriseDtos.LeaveResponse decideLeave(long id, boolean approve, String actor) {
        database.decideLeave(id,approve,actor);
        return leaves(null).stream().filter(row -> row.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.StockItemResponse> linen() {
        return database.linen(this::stockRow);
    }

    public EnterpriseDtos.StockItemResponse moveStock(EnterpriseDtos.StockMovementRequest request, String actor) {
        String type = request.movementType().trim().toUpperCase();
        if(!List.of("RECEIVE","RETURN","ISSUE","WASTE","ADJUST").contains(type)) throw new DomainException("INVALID_STOCK_MOVEMENT","Loại biến động tồn kho không hợp lệ");
        database.moveStock(request,STOCK_MOVEMENT.convertToDatabaseColumn(type),actor,LocalDateTime.now());
        return database.stock(request.itemId(),this::stockRow).stream().findFirst().orElse(null);
    }

    @Transactional(readOnly = true)
    public List<EnterpriseDtos.TechnicalAssetResponse> assets() {
        return database.assets(this::assetRow);
    }

    public EnterpriseDtos.TechnicalAssetResponse createAsset(EnterpriseDtos.TechnicalAssetRequest request) {
        database.createAsset(request,ASSET_LOCATION_TYPE.convertToDatabaseColumn(code(request.locationType())),ASSET_STATUS.convertToDatabaseColumn(request.status()==null?"GOOD":code(request.status())));
        return assets().stream().filter(row -> row.id().equals(request.id())).findFirst().orElseThrow();
    }

    public EnterpriseDtos.TechnicalAssetResponse updateAssetStatus(String id, String status) {
        database.updateAsset(id,ASSET_STATUS.convertToDatabaseColumn(code(status)));
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

}
