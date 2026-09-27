package com.hospitality.mis.persistence;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Map;

/** Field-scoped converters for coded String values; never auto-applied to ordinary text. */
public final class VietnameseCodeConverters {
    private VietnameseCodeConverters() {}

    private static class CodeMapping {
        private final Map<String, String> toDatabase;
        private final Map<String, String> fromDatabase;

        protected CodeMapping(Map<String, String> values) {
            toDatabase = Map.copyOf(values);
            fromDatabase = values.entrySet().stream()
                    .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getValue, Map.Entry::getKey));
        }

        public String convertToDatabaseColumn(String value) {
            if (value == null) return null;
            String translated = toDatabase.get(value);
            if (translated == null) throw new IllegalArgumentException("Unsupported coded value: " + value);
            return translated;
        }

        public String convertToEntityAttribute(String value) {
            if (value == null) return null;
            String translated = fromDatabase.get(value);
            if (translated == null) throw new IllegalArgumentException("Unknown Vietnamese coded value: " + value);
            return translated;
        }
    }

    @Converter public static final class RentalTypeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public RentalTypeConverter() { mapping = new CodeMapping(Map.of("PACKAGE", "Theo gói", "HOURLY", "Theo giờ")); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class BookingSourceConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public BookingSourceConverter() { mapping = new CodeMapping(Map.of(
                "DIRECT", "Trực tiếp", "AGODA", "AGODA", "BOOKING_COM", "BOOKING_COM",
                "EXPEDIA", "EXPEDIA", "AIRBNB", "AIRBNB")); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class OtaReconciliationStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public OtaReconciliationStatusConverter() { mapping = new CodeMapping(Map.of(
                "NOT_APPLICABLE", "Không áp dụng", "PENDING", "Chờ đối soát",
                "MATCHED", "Đã khớp", "DISPUTED", "Có tranh chấp")); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class VatCustomerTypeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of("INDIVIDUAL", "Cá nhân", "COMPANY", "Doanh nghiệp"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class VatInvoiceStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of("DRAFT", "Bản nháp", "ISSUED", "Đã phát hành", "CANCELLED", "Đã hủy"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class VatXmlStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of("NOT_EXPORTED", "Chưa xuất", "EXPORTED", "Đã xuất"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class AttendanceStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "PRESENT", "Có mặt", "LATE", "Đi muộn", "ABSENT", "Vắng mặt", "ON_LEAVE", "Nghỉ phép"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class AttendanceSourceConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "MANUAL", "Nhập thủ công", "BIOMETRIC_IMPORT", "Nhập từ máy chấm công"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class LeaveTypeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "ANNUAL", "Nghỉ phép năm", "SICK", "Nghỉ ốm", "SHIFT_CHANGE", "Đổi ca trực", "UNPAID", "Việc riêng"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class StockCategoryConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "LINEN", "Đồ vải", "TOWELS", "Khăn", "AMENITIES", "Đồ dùng", "MINIBAR", "Minibar", "GENERAL", "Khác"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class StockMovementTypeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "RECEIVE", "Nhập kho", "RETURN", "Hoàn kho", "ISSUE", "Xuất kho", "WASTE", "Hao hụt", "ADJUST", "Điều chỉnh"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class TechnicalAssetStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "GOOD", "Tốt", "MAINTENANCE_NEEDED", "Cần bảo trì", "REPAIRING", "Đang sửa chữa", "OUT_OF_SERVICE", "Ngừng sử dụng"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class TechnicalAssetLocationTypeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of("BUILDING", "Tòa nhà", "ROOM", "Phòng"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class PriorityConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public PriorityConverter() { mapping = new CodeMapping(Map.of(
                "LOW", "Thấp", "MEDIUM", "Trung bình", "HIGH", "Cao", "CRITICAL", "Nghiêm trọng")); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class ApprovalStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public ApprovalStatusConverter() { mapping = new CodeMapping(Map.of(
                "PENDING", "Chờ phê duyệt", "APPROVED", "Đã phê duyệt", "REJECTED", "Bị từ chối",
                "EXPIRED", "Đã hết hạn", "CONSUMED", "Đã sử dụng")); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class LeaveStatusConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "PENDING", "Chờ phê duyệt", "APPROVED", "Đã phê duyệt", "REJECTED", "Bị từ chối"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class EmployeeRoleCodeConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping;
        public EmployeeRoleCodeConverter() { mapping = new CodeMapping(Map.ofEntries(
                Map.entry("ADMIN", "Quản trị viên"), Map.entry("DIRECTOR", "Giám đốc"),
                Map.entry("MANAGER", "Quản lý"), Map.entry("FRONT_DESK", "Lễ tân"),
                Map.entry("ACCOUNTING", "Kế toán"), Map.entry("HOUSEKEEPING", "Buồng phòng"),
                Map.entry("TECHNICAL", "Kỹ thuật"), Map.entry("KITCHEN", "Nhà bếp"),
                Map.entry("STAFF", "Nhân viên"), Map.entry("HR", "Nhân sự"))); }
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }

    @Converter public static final class ServiceCategoryConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "business", "Dịch vụ doanh nghiệp",
                "fine-dining", "Nhà hàng cao cấp",
                "inroom", "Dịch vụ tại phòng",
                "laundry", "Giặt ủi",
                "other", "Khác",
                "recreation", "Giải trí",
                "spa", "Spa",
                "transport", "Đưa đón"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }

    /**
     * Đơn vị dịch vụ là nhãn hiển thị dạng chuỗi, không phải một miền mã API ổn định.
     * Các giá trị kỹ thuật từng xuất hiện trong dữ liệu thử được nhận như bí danh đầu vào.
     * Cả dữ liệu đọc từ SQL Server và phản hồi API đều dùng nhãn tiếng Việt chuẩn; converter
     * không cam kết trả lại đúng bí danh mà người gọi đã gửi.
     */
    @Converter public static final class ServiceUnitConverter implements AttributeConverter<String, String> {
        private static final Map<String, String> API_ALIASES = Map.of(
                "BOTTLE", "chai", "CHAI", "chai", "UNIT", "đơn vị",
                "TIME", "lần", "LẦN", "lần", "set", "bộ", "SET", "bộ");
        private static final java.util.Set<String> DATABASE_VALUES = java.util.Set.of(
                "bộ", "lần", "suất", "món", "đêm", "lượt", "chuyến", "khách",
                "khách/ngày", "giờ", "ngày", "chai", "đơn vị");

        @Override public String convertToDatabaseColumn(String value) {
            if (value == null) return null;
            String translated = API_ALIASES.get(value);
            if (translated != null) return translated;
            if (DATABASE_VALUES.contains(value)) return value;
            throw new IllegalArgumentException("Unsupported service unit: " + value);
        }

        @Override public String convertToEntityAttribute(String value) {
            if (value == null) return null;
            if (DATABASE_VALUES.contains(value)) return value;
            throw new IllegalArgumentException("Unknown Vietnamese service unit: " + value);
        }
    }

    @Converter public static final class ShiftCodeConverter implements AttributeConverter<String, String> {
        private static final Map<String, String> TO_DATABASE = Map.of(
                "MORNING", "Ca sáng", "AFTERNOON", "Ca chiều", "NIGHT", "Ca đêm");
        private static final Map<String, String> FROM_DATABASE = TO_DATABASE.entrySet().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getValue, Map.Entry::getKey));

        @Override public String convertToDatabaseColumn(String value) {
            if (value == null) return null;
            String translated = TO_DATABASE.get(value);
            if (translated != null) return translated;
            if (value.matches("[A-Za-z][A-Za-z0-9_-]{0,29}")) return value;
            throw new IllegalArgumentException("Unsupported shift code");
        }

        @Override public String convertToEntityAttribute(String value) {
            if (value == null) return null;
            String translated = FROM_DATABASE.get(value);
            if (translated != null) return translated;
            if (value.matches("[A-Za-z][A-Za-z0-9_-]{0,29}")) return value;
            throw new IllegalArgumentException("Unknown shift code");
        }
    }

    @Converter public static final class ApprovalActionConverter implements AttributeConverter<String, String> {
        private final CodeMapping mapping = new CodeMapping(Map.of(
                "ROOM_TYPE_ACTIVATE", "Kích hoạt loại phòng",
                "SERVICE_PRICE_CHANGE", "Thay đổi giá dịch vụ",
                "PAYMENT_REFUND", "Hoàn tiền thanh toán",
                "DEPOSIT_REFUND", "Hoàn tiền đặt cọc",
                "INVOICE_DELETE", "Xóa hóa đơn",
                "BILLING_ADJUSTMENT", "Điều chỉnh thanh toán",
                "PRICE_OVERRIDE", "Điều chỉnh giá"));
        @Override public String convertToDatabaseColumn(String value) { return mapping.convertToDatabaseColumn(value); }
        @Override public String convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
}
