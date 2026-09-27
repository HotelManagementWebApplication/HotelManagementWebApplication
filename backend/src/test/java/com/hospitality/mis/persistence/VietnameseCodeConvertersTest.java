package com.hospitality.mis.persistence;

import org.junit.jupiter.api.Test;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.lang.reflect.ParameterizedType;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VietnameseCodeConvertersTest {
    @Test
    void enterpriseCodesRoundTripBetweenVietnameseDatabaseValuesAndStableApiCodes() {
        var rentalType = new VietnameseCodeConverters.RentalTypeConverter();
        var bookingSource = new VietnameseCodeConverters.BookingSourceConverter();
        var otaStatus = new VietnameseCodeConverters.OtaReconciliationStatusConverter();
        var attendance = new VietnameseCodeConverters.AttendanceStatusConverter();
        var attendanceSource = new VietnameseCodeConverters.AttendanceSourceConverter();
        var leaveType = new VietnameseCodeConverters.LeaveTypeConverter();
        var leaveStatus = new VietnameseCodeConverters.LeaveStatusConverter();
        var vatCustomer = new VietnameseCodeConverters.VatCustomerTypeConverter();
        var vatStatus = new VietnameseCodeConverters.VatInvoiceStatusConverter();
        var vatXmlStatus = new VietnameseCodeConverters.VatXmlStatusConverter();
        var stockCategory = new VietnameseCodeConverters.StockCategoryConverter();
        var stockMovement = new VietnameseCodeConverters.StockMovementTypeConverter();
        var assetStatus = new VietnameseCodeConverters.TechnicalAssetStatusConverter();
        var assetLocation = new VietnameseCodeConverters.TechnicalAssetLocationTypeConverter();
        var priority = new VietnameseCodeConverters.PriorityConverter();
        var employeeRole = new VietnameseCodeConverters.EmployeeRoleCodeConverter();
        var serviceCategory = new VietnameseCodeConverters.ServiceCategoryConverter();
        var serviceUnit = new VietnameseCodeConverters.ServiceUnitConverter();
        var shiftCode = new VietnameseCodeConverters.ShiftCodeConverter();
        var approvalAction = new VietnameseCodeConverters.ApprovalActionConverter();

        assertRoundTrip(rentalType, "PACKAGE", "Theo gói");
        assertRoundTrip(bookingSource, "DIRECT", "Trực tiếp");
        assertRoundTrip(otaStatus, "PENDING", "Chờ đối soát");
        assertRoundTrip(attendance, "LATE", "Đi muộn");
        assertRoundTrip(attendanceSource, "BIOMETRIC_IMPORT", "Nhập từ máy chấm công");
        assertRoundTrip(leaveType, "SHIFT_CHANGE", "Đổi ca trực");
        assertRoundTrip(leaveStatus, "PENDING", "Chờ phê duyệt");
        assertRoundTrip(vatCustomer, "COMPANY", "Doanh nghiệp");
        assertRoundTrip(vatStatus, "ISSUED", "Đã phát hành");
        assertRoundTrip(vatXmlStatus, "EXPORTED", "Đã xuất");
        assertRoundTrip(stockCategory, "LINEN", "Đồ vải");
        assertRoundTrip(stockMovement, "RECEIVE", "Nhập kho");
        assertRoundTrip(assetStatus, "MAINTENANCE_NEEDED", "Cần bảo trì");
        assertRoundTrip(assetLocation, "BUILDING", "Tòa nhà");
        assertRoundTrip(priority, "HIGH", "Cao");
        assertRoundTrip(employeeRole, "FRONT_DESK", "Lễ tân");
        assertRoundTrip(serviceCategory, "fine-dining", "Nhà hàng cao cấp");
        assertRoundTrip(serviceCategory, "laundry", "Giặt ủi");
        assertThat(serviceUnit.convertToDatabaseColumn("BOTTLE")).isEqualTo("chai");
        assertThat(serviceUnit.convertToDatabaseColumn("CHAI")).isEqualTo("chai");
        assertThat(serviceUnit.convertToDatabaseColumn("UNIT")).isEqualTo("đơn vị");
        assertThat(serviceUnit.convertToDatabaseColumn("TIME")).isEqualTo("lần");
        assertThat(serviceUnit.convertToDatabaseColumn("set")).isEqualTo("bộ");
        assertThat(serviceUnit.convertToEntityAttribute("chai")).isEqualTo("chai");
        assertRoundTrip(shiftCode, "MORNING", "Ca sáng");
        assertRoundTrip(shiftCode, "AFTERNOON", "Ca chiều");
        assertRoundTrip(shiftCode, "NIGHT", "Ca đêm");
        assertRoundTrip(shiftCode, "AM", "AM");
        assertRoundTrip(shiftCode, "SHIFT-REAL", "SHIFT-REAL");
        assertRoundTrip(approvalAction, "PAYMENT_REFUND", "Hoàn tiền thanh toán");
        assertRoundTrip(approvalAction, "DEPOSIT_REFUND", "Hoàn tiền đặt cọc");
        assertRoundTrip(approvalAction, "INVOICE_DELETE", "Xóa hóa đơn");
        assertRoundTrip(approvalAction, "BILLING_ADJUSTMENT", "Điều chỉnh thanh toán");
    }

    @Test
    void unknownCodesAreRejectedInsteadOfBeingPersistedAsMixedLanguageValues() {
        var converters = java.util.List.<jakarta.persistence.AttributeConverter<String, String>>of(
                new VietnameseCodeConverters.RentalTypeConverter(),
                new VietnameseCodeConverters.BookingSourceConverter(),
                new VietnameseCodeConverters.OtaReconciliationStatusConverter(),
                new VietnameseCodeConverters.VatCustomerTypeConverter(),
                new VietnameseCodeConverters.VatInvoiceStatusConverter(),
                new VietnameseCodeConverters.VatXmlStatusConverter(),
                new VietnameseCodeConverters.AttendanceStatusConverter(),
                new VietnameseCodeConverters.AttendanceSourceConverter(),
                new VietnameseCodeConverters.LeaveTypeConverter(),
                new VietnameseCodeConverters.ApprovalStatusConverter(),
                new VietnameseCodeConverters.LeaveStatusConverter(),
                new VietnameseCodeConverters.StockCategoryConverter(),
                new VietnameseCodeConverters.StockMovementTypeConverter(),
                new VietnameseCodeConverters.TechnicalAssetStatusConverter(),
                new VietnameseCodeConverters.TechnicalAssetLocationTypeConverter(),
                new VietnameseCodeConverters.PriorityConverter(),
                new VietnameseCodeConverters.EmployeeRoleCodeConverter(),
                new VietnameseCodeConverters.ServiceCategoryConverter(),
                new VietnameseCodeConverters.ServiceUnitConverter(),
                new VietnameseCodeConverters.ApprovalActionConverter());

        for (var converter : converters) {
            assertThatThrownBy(() -> converter.convertToDatabaseColumn("UNKNOWN"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> converter.convertToEntityAttribute("UNKNOWN"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> new VietnameseCodeConverters.ShiftCodeConverter()
                .convertToDatabaseColumn("unsupported shift"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new VietnameseCodeConverters.ShiftCodeConverter()
                .convertToEntityAttribute("Ca ngoài quy ước"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void everyJpaEnumConverterRoundTripsEveryEnumAndRejectsUnknownDatabaseText() throws Exception {
        var converterTypes = Arrays.stream(VietnameseEnumConverters.class.getDeclaredClasses())
                .filter(type -> type.isAnnotationPresent(Converter.class))
                .filter(AttributeConverter.class::isAssignableFrom)
                .toList();

        assertThat(converterTypes).isNotEmpty();
        for (Class<?> converterType : converterTypes) {
            var converter = (AttributeConverter<Object, String>) converterType.getConstructor().newInstance();
            var converterInterface = (ParameterizedType) Arrays.stream(converterType.getGenericInterfaces())
                    .filter(ParameterizedType.class::isInstance)
                    .map(ParameterizedType.class::cast)
                    .filter(type -> type.getRawType() == AttributeConverter.class)
                    .findFirst().orElseThrow();
            var enumType = (Class<?>) converterInterface.getActualTypeArguments()[0];

            for (Object enumValue : enumType.getEnumConstants()) {
                String databaseValue = converter.convertToDatabaseColumn(enumValue);
                assertThat(databaseValue).as("Vietnamese value for %s.%s", enumType.getSimpleName(), enumValue)
                        .isNotEqualTo(((Enum<?>) enumValue).name());
                assertThat(converter.convertToEntityAttribute(databaseValue)).isEqualTo(enumValue);
            }
            assertThatThrownBy(() -> converter.convertToEntityAttribute("__UNKNOWN_DATABASE_VALUE__"))
                    .as("unknown value rejected by %s", converterType.getSimpleName())
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    private static void assertRoundTrip(jakarta.persistence.AttributeConverter<String, String> converter,
                                        String apiValue, String databaseValue) {
        assertThat(converter.convertToDatabaseColumn(apiValue)).isEqualTo(databaseValue);
        assertThat(converter.convertToEntityAttribute(databaseValue)).isEqualTo(apiValue);
    }
}
