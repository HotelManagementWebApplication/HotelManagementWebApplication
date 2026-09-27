package com.hospitality.mis.persistence;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentStatus;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.finance.Expense;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.entity.finance.PartnerDebt;
import com.hospitality.mis.entity.governance.IdempotencyRecord;
import com.hospitality.mis.entity.governance.NotificationOutbox;
import com.hospitality.mis.entity.guest.MembershipTier;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeLoginEvent;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.identity.EmployeeShift;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.operations.InventoryMovement;
import com.hospitality.mis.entity.operations.MaintenanceStatus;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.entity.reservation.CancellationOutcome;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA-only translations for coded values stored in QLKS.
 * Enum names remain the stable Java/API contract; only persisted text is Vietnamese.
 */
public final class VietnameseEnumConverters {
    private VietnameseEnumConverters() {}

    private static <T extends Enum<T>> Map.Entry<T, String> value(T key, String text) {
        return Map.entry(key, text);
    }

    private static class EnumMapping<E extends Enum<E>> {
        private final Map<E, String> toDatabase;
        private final Map<String, E> fromDatabase;

        @SafeVarargs
        protected EnumMapping(Class<E> type, Map.Entry<E, String>... entries) {
            Map<E, String> forward = new LinkedHashMap<>();
            Map<String, E> reverse = new LinkedHashMap<>();
            for (Map.Entry<E, String> entry : entries) {
                if (forward.put(entry.getKey(), entry.getValue()) != null
                        || reverse.put(entry.getValue(), entry.getKey()) != null) {
                    throw new IllegalArgumentException("Duplicate enum persistence mapping for " + type.getSimpleName());
                }
            }
            if (forward.size() != type.getEnumConstants().length) {
                throw new IllegalArgumentException("Incomplete enum persistence mapping for " + type.getSimpleName());
            }
            toDatabase = Collections.unmodifiableMap(forward);
            fromDatabase = Collections.unmodifiableMap(reverse);
        }
        public String convertToDatabaseColumn(E value) {
            if (value == null) return null;
            String translated = toDatabase.get(value);
            if (translated == null) throw new IllegalArgumentException("Unsupported enum value: " + value);
            return translated;
        }
        public E convertToEntityAttribute(String value) {
            if (value == null) return null;
            E translated = fromDatabase.get(value);
            if (translated == null) throw new IllegalArgumentException("Unknown Vietnamese database value: " + value);
            return translated;
        }

    }

    @Converter public static final class RoomTypeCatalogStatusConverter implements AttributeConverter<RoomTypeCatalogStatus, String> {
        private final EnumMapping<RoomTypeCatalogStatus> mapping;
        public RoomTypeCatalogStatusConverter() { mapping = new EnumMapping<>(RoomTypeCatalogStatus.class,
                value(RoomTypeCatalogStatus.DRAFT, "Bản nháp"), value(RoomTypeCatalogStatus.ACTIVE, "Đang hoạt động"),
                value(RoomTypeCatalogStatus.REJECTED, "Bị từ chối"), value(RoomTypeCatalogStatus.RETIRED, "Ngừng kinh doanh")); }
        @Override public String convertToDatabaseColumn(RoomTypeCatalogStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public RoomTypeCatalogStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class MembershipTierConverter implements AttributeConverter<MembershipTier, String> {
        private final EnumMapping<MembershipTier> mapping;
        public MembershipTierConverter() { mapping = new EnumMapping<>(MembershipTier.class,
                value(MembershipTier.STANDARD, "Tiêu chuẩn"), value(MembershipTier.SILVER, "Bạc"),
                value(MembershipTier.GOLD, "Vàng"), value(MembershipTier.PLATINUM, "Bạch kim")); }
        @Override public String convertToDatabaseColumn(MembershipTier value) { return mapping.convertToDatabaseColumn(value); }
        @Override public MembershipTier convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class EmployeeRoleConverter implements AttributeConverter<EmployeeRole, String> {
        private final EnumMapping<EmployeeRole> mapping;
        public EmployeeRoleConverter() { mapping = new EnumMapping<>(EmployeeRole.class,
                value(EmployeeRole.ADMIN, "Quản trị viên"), value(EmployeeRole.DIRECTOR, "Giám đốc"),
                value(EmployeeRole.MANAGER, "Quản lý"), value(EmployeeRole.FRONT_DESK, "Lễ tân"),
                value(EmployeeRole.ACCOUNTING, "Kế toán"), value(EmployeeRole.HOUSEKEEPING, "Buồng phòng"),
                value(EmployeeRole.TECHNICAL, "Kỹ thuật"), value(EmployeeRole.KITCHEN, "Nhà bếp"),
                value(EmployeeRole.STAFF, "Nhân viên"), value(EmployeeRole.HR, "Nhân sự")); }
        @Override public String convertToDatabaseColumn(EmployeeRole value) { return mapping.convertToDatabaseColumn(value); }
        @Override public EmployeeRole convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class EmploymentStatusConverter implements AttributeConverter<Employee.EmploymentStatus, String> {
        private final EnumMapping<Employee.EmploymentStatus> mapping;
        public EmploymentStatusConverter() { mapping = new EnumMapping<>(Employee.EmploymentStatus.class,
                value(Employee.EmploymentStatus.WORKING, "Đang làm việc"), value(Employee.EmploymentStatus.ON_LEAVE, "Đang nghỉ phép"),
                value(Employee.EmploymentStatus.TERMINATED, "Đã nghỉ việc")); }
        @Override public String convertToDatabaseColumn(Employee.EmploymentStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public Employee.EmploymentStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class ReservationStatusConverter implements AttributeConverter<ReservationStatus, String> {
        private final EnumMapping<ReservationStatus> mapping;
        public ReservationStatusConverter() { mapping = new EnumMapping<>(ReservationStatus.class,
                value(ReservationStatus.DRAFT, "Bản nháp"), value(ReservationStatus.DEPOSIT_PAID, "Đã thanh toán cọc"),
                value(ReservationStatus.CONFIRMED, "Đã xác nhận"), value(ReservationStatus.CHECKED_IN, "Đã nhận phòng"),
                value(ReservationStatus.CHECKED_OUT, "Đã trả phòng"), value(ReservationStatus.CANCELLED, "Đã hủy"),
                value(ReservationStatus.NO_SHOW, "Không đến")); }
        @Override public String convertToDatabaseColumn(ReservationStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public ReservationStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class DepositPaymentStatusConverter implements AttributeConverter<DepositPaymentStatus, String> {
        private final EnumMapping<DepositPaymentStatus> mapping;
        public DepositPaymentStatusConverter() { mapping = new EnumMapping<>(DepositPaymentStatus.class,
                value(DepositPaymentStatus.NOT_REQUIRED, "Không yêu cầu"), value(DepositPaymentStatus.PENDING, "Chờ thanh toán"),
                value(DepositPaymentStatus.PAID, "Đã thanh toán"), value(DepositPaymentStatus.EXPIRED, "Đã hết hạn")); }
        @Override public String convertToDatabaseColumn(DepositPaymentStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public DepositPaymentStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class CancellationOutcomeConverter implements AttributeConverter<CancellationOutcome, String> {
        private final EnumMapping<CancellationOutcome> mapping;
        public CancellationOutcomeConverter() { mapping = new EnumMapping<>(CancellationOutcome.class,
                value(CancellationOutcome.REFUND, "Hoàn tiền"), value(CancellationOutcome.RETAIN, "Không phát sinh hoàn tiền"),
                value(CancellationOutcome.FORFEIT, "Mất quyền hoàn tiền")); }
        @Override public String convertToDatabaseColumn(CancellationOutcome value) { return mapping.convertToDatabaseColumn(value); }
        @Override public CancellationOutcome convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class PaymentMethodConverter implements AttributeConverter<PaymentMethod, String> {
        private final EnumMapping<PaymentMethod> mapping;
        public PaymentMethodConverter() { mapping = new EnumMapping<>(PaymentMethod.class,
                value(PaymentMethod.CASH, "Tiền mặt"), value(PaymentMethod.CARD, "Thẻ"),
                value(PaymentMethod.BANK_TRANSFER, "Chuyển khoản ngân hàng")); }
        @Override public String convertToDatabaseColumn(PaymentMethod value) { return mapping.convertToDatabaseColumn(value); }
        @Override public PaymentMethod convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class PaymentStatusConverter implements AttributeConverter<PaymentStatus, String> {
        private final EnumMapping<PaymentStatus> mapping;
        public PaymentStatusConverter() { mapping = new EnumMapping<>(PaymentStatus.class,
                value(PaymentStatus.DA_THANH_TOAN, "Đã thanh toán"), value(PaymentStatus.CHUA_THANH_TOAN, "Chưa thanh toán"),
                value(PaymentStatus.DU_KIEN, "Dự kiến")); }
        @Override public String convertToDatabaseColumn(PaymentStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public PaymentStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class TransactionTypeConverter implements AttributeConverter<PaymentTransaction.TransactionType, String> {
        private final EnumMapping<PaymentTransaction.TransactionType> mapping;
        public TransactionTypeConverter() { mapping = new EnumMapping<>(PaymentTransaction.TransactionType.class,
                value(PaymentTransaction.TransactionType.PAYMENT, "Thanh toán"), value(PaymentTransaction.TransactionType.REFUND, "Hoàn tiền")); }
        @Override public String convertToDatabaseColumn(PaymentTransaction.TransactionType value) { return mapping.convertToDatabaseColumn(value); }
        @Override public PaymentTransaction.TransactionType convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class TransactionStatusConverter implements AttributeConverter<PaymentTransaction.TransactionStatus, String> {
        private final EnumMapping<PaymentTransaction.TransactionStatus> mapping;
        public TransactionStatusConverter() { mapping = new EnumMapping<>(PaymentTransaction.TransactionStatus.class,
                value(PaymentTransaction.TransactionStatus.COMPLETED, "Đã hoàn tất"), value(PaymentTransaction.TransactionStatus.FAILED, "Thất bại"),
                value(PaymentTransaction.TransactionStatus.VOIDED, "Đã vô hiệu")); }
        @Override public String convertToDatabaseColumn(PaymentTransaction.TransactionStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public PaymentTransaction.TransactionStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class MaintenanceStatusConverter implements AttributeConverter<MaintenanceStatus, String> {
        private final EnumMapping<MaintenanceStatus> mapping;
        public MaintenanceStatusConverter() { mapping = new EnumMapping<>(MaintenanceStatus.class,
                value(MaintenanceStatus.CHUA_XU_LY, "Chưa xử lý"), value(MaintenanceStatus.DANG_BAO_TRI, "Đang bảo trì"),
                value(MaintenanceStatus.DA_HOAN_THANH, "Đã hoàn thành")); }
        @Override public String convertToDatabaseColumn(MaintenanceStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public MaintenanceStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class InventoryMovementTypeConverter implements AttributeConverter<InventoryMovement.MovementType, String> {
        private final EnumMapping<InventoryMovement.MovementType> mapping;
        public InventoryMovementTypeConverter() { mapping = new EnumMapping<>(InventoryMovement.MovementType.class,
                value(InventoryMovement.MovementType.RECEIVE, "Nhập kho"), value(InventoryMovement.MovementType.ISSUE, "Xuất kho"),
                value(InventoryMovement.MovementType.ADJUST, "Điều chỉnh"), value(InventoryMovement.MovementType.WASTE, "Hao hụt"),
                value(InventoryMovement.MovementType.RETURN, "Hoàn kho")); }
        @Override public String convertToDatabaseColumn(InventoryMovement.MovementType value) { return mapping.convertToDatabaseColumn(value); }
        @Override public InventoryMovement.MovementType convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class HousekeepingTaskStatusConverter implements AttributeConverter<HousekeepingTaskStatus, String> {
        private final EnumMapping<HousekeepingTaskStatus> mapping;
        public HousekeepingTaskStatusConverter() { mapping = new EnumMapping<>(HousekeepingTaskStatus.class,
                value(HousekeepingTaskStatus.NEEDS_CLEANING, "Cần dọn phòng"), value(HousekeepingTaskStatus.IN_PROGRESS, "Đang thực hiện"),
                value(HousekeepingTaskStatus.CLEANED, "Đã dọn xong"), value(HousekeepingTaskStatus.READY, "Sẵn sàng"),
                value(HousekeepingTaskStatus.WAITING_TECHNICAL, "Chờ kỹ thuật")); }
        @Override public String convertToDatabaseColumn(HousekeepingTaskStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public HousekeepingTaskStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class TechnicalWorkOrderStatusConverter implements AttributeConverter<TechnicalWorkOrderStatus, String> {
        private final EnumMapping<TechnicalWorkOrderStatus> mapping;
        public TechnicalWorkOrderStatusConverter() { mapping = new EnumMapping<>(TechnicalWorkOrderStatus.class,
                value(TechnicalWorkOrderStatus.NEW, "Mới tạo"), value(TechnicalWorkOrderStatus.ACKNOWLEDGED, "Đã tiếp nhận"),
                value(TechnicalWorkOrderStatus.IN_PROGRESS, "Đang thực hiện"), value(TechnicalWorkOrderStatus.WAITING_ACCEPTANCE, "Chờ nghiệm thu"),
                value(TechnicalWorkOrderStatus.COMPLETED, "Đã hoàn thành"), value(TechnicalWorkOrderStatus.ROOM_RELEASED, "Đã bàn giao phòng")); }
        @Override public String convertToDatabaseColumn(TechnicalWorkOrderStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public TechnicalWorkOrderStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class IncidentSeverityConverter implements AttributeConverter<IncidentSeverity, String> {
        private final EnumMapping<IncidentSeverity> mapping;
        public IncidentSeverityConverter() { mapping = new EnumMapping<>(IncidentSeverity.class,
                value(IncidentSeverity.LOW, "Thấp"), value(IncidentSeverity.MEDIUM, "Trung bình"),
                value(IncidentSeverity.HIGH, "Cao"), value(IncidentSeverity.CRITICAL, "Nghiêm trọng")); }
        @Override public String convertToDatabaseColumn(IncidentSeverity value) { return mapping.convertToDatabaseColumn(value); }
        @Override public IncidentSeverity convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class IncidentHandoffStatusConverter implements AttributeConverter<IncidentHandoffStatus, String> {
        private final EnumMapping<IncidentHandoffStatus> mapping;
        public IncidentHandoffStatusConverter() { mapping = new EnumMapping<>(IncidentHandoffStatus.class,
                value(IncidentHandoffStatus.OPEN, "Đang mở"), value(IncidentHandoffStatus.ACKNOWLEDGED, "Đã tiếp nhận"),
                value(IncidentHandoffStatus.RESOLVED, "Đã xử lý")); }
        @Override public String convertToDatabaseColumn(IncidentHandoffStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public IncidentHandoffStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class InspectionTypeConverter implements AttributeConverter<HousekeepingInspection.InspectionType, String> {
        private final EnumMapping<HousekeepingInspection.InspectionType> mapping;
        public InspectionTypeConverter() { mapping = new EnumMapping<>(HousekeepingInspection.InspectionType.class,
                value(HousekeepingInspection.InspectionType.MINIBAR, "Minibar"), value(HousekeepingInspection.InspectionType.ROOM_ASSET, "Tài sản phòng")); }
        @Override public String convertToDatabaseColumn(HousekeepingInspection.InspectionType value) { return mapping.convertToDatabaseColumn(value); }
        @Override public HousekeepingInspection.InspectionType convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class ItemConditionConverter implements AttributeConverter<HousekeepingInspection.ItemCondition, String> {
        private final EnumMapping<HousekeepingInspection.ItemCondition> mapping;
        public ItemConditionConverter() { mapping = new EnumMapping<>(HousekeepingInspection.ItemCondition.class,
                value(HousekeepingInspection.ItemCondition.OK, "Bình thường"), value(HousekeepingInspection.ItemCondition.DAMAGED, "Hư hỏng"),
                value(HousekeepingInspection.ItemCondition.MISSING, "Thất lạc"), value(HousekeepingInspection.ItemCondition.REFILLED, "Đã bổ sung")); }
        @Override public String convertToDatabaseColumn(HousekeepingInspection.ItemCondition value) { return mapping.convertToDatabaseColumn(value); }
        @Override public HousekeepingInspection.ItemCondition convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class DebtStatusConverter implements AttributeConverter<PartnerDebt.DebtStatus, String> {
        private final EnumMapping<PartnerDebt.DebtStatus> mapping;
        public DebtStatusConverter() { mapping = new EnumMapping<>(PartnerDebt.DebtStatus.class,
                value(PartnerDebt.DebtStatus.OPEN, "Chưa thanh toán"), value(PartnerDebt.DebtStatus.PARTIALLY_SETTLED, "Đã thanh toán một phần"),
                value(PartnerDebt.DebtStatus.SETTLED, "Đã thanh toán"), value(PartnerDebt.DebtStatus.VOIDED, "Đã hủy")); }
        @Override public String convertToDatabaseColumn(PartnerDebt.DebtStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public PartnerDebt.DebtStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class ExpenseStatusConverter implements AttributeConverter<Expense.ExpenseStatus, String> {
        private final EnumMapping<Expense.ExpenseStatus> mapping;
        public ExpenseStatusConverter() { mapping = new EnumMapping<>(Expense.ExpenseStatus.class,
                value(Expense.ExpenseStatus.RECORDED, "Đã ghi nhận"), value(Expense.ExpenseStatus.APPROVED, "Đã phê duyệt"),
                value(Expense.ExpenseStatus.VOIDED, "Đã hủy")); }
        @Override public String convertToDatabaseColumn(Expense.ExpenseStatus value) { return mapping.convertToDatabaseColumn(value); }
        @Override public Expense.ExpenseStatus convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class LedgerDirectionConverter implements AttributeConverter<FinancialLedgerEntry.Direction, String> {
        private final EnumMapping<FinancialLedgerEntry.Direction> mapping;
        public LedgerDirectionConverter() { mapping = new EnumMapping<>(FinancialLedgerEntry.Direction.class,
                value(FinancialLedgerEntry.Direction.DEBIT, "Ghi nợ"), value(FinancialLedgerEntry.Direction.CREDIT, "Ghi có")); }
        @Override public String convertToDatabaseColumn(FinancialLedgerEntry.Direction value) { return mapping.convertToDatabaseColumn(value); }
        @Override public FinancialLedgerEntry.Direction convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class NotificationStatusConverter implements AttributeConverter<NotificationOutbox.Status, String> {
        private final EnumMapping<NotificationOutbox.Status> mapping;
        public NotificationStatusConverter() { mapping = new EnumMapping<>(NotificationOutbox.Status.class,
                value(NotificationOutbox.Status.PENDING, "Chờ gửi"), value(NotificationOutbox.Status.DELIVERED, "Đã gửi"),
                value(NotificationOutbox.Status.FAILED, "Gửi thất bại")); }
        @Override public String convertToDatabaseColumn(NotificationOutbox.Status value) { return mapping.convertToDatabaseColumn(value); }
        @Override public NotificationOutbox.Status convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class IdempotencyStatusConverter implements AttributeConverter<IdempotencyRecord.Status, String> {
        private final EnumMapping<IdempotencyRecord.Status> mapping;
        public IdempotencyStatusConverter() { mapping = new EnumMapping<>(IdempotencyRecord.Status.class,
                value(IdempotencyRecord.Status.PROCESSING, "Đang xử lý"), value(IdempotencyRecord.Status.COMPLETED, "Đã hoàn tất")); }
        @Override public String convertToDatabaseColumn(IdempotencyRecord.Status value) { return mapping.convertToDatabaseColumn(value); }
        @Override public IdempotencyRecord.Status convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class EmployeeShiftStatusConverter implements AttributeConverter<EmployeeShift.Status, String> {
        private final EnumMapping<EmployeeShift.Status> mapping;
        public EmployeeShiftStatusConverter() { mapping = new EnumMapping<>(EmployeeShift.Status.class,
                value(EmployeeShift.Status.ASSIGNED, "Đã phân công"), value(EmployeeShift.Status.STARTED, "Đã bắt đầu"),
                value(EmployeeShift.Status.COMPLETED, "Đã hoàn thành"), value(EmployeeShift.Status.CANCELLED, "Đã hủy")); }
        @Override public String convertToDatabaseColumn(EmployeeShift.Status value) { return mapping.convertToDatabaseColumn(value); }
        @Override public EmployeeShift.Status convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
    @Converter public static final class LoginOutcomeConverter implements AttributeConverter<EmployeeLoginEvent.Outcome, String> {
        private final EnumMapping<EmployeeLoginEvent.Outcome> mapping;
        public LoginOutcomeConverter() { mapping = new EnumMapping<>(EmployeeLoginEvent.Outcome.class,
                value(EmployeeLoginEvent.Outcome.SUCCEEDED, "Thành công"), value(EmployeeLoginEvent.Outcome.FAILED, "Thất bại")); }
        @Override public String convertToDatabaseColumn(EmployeeLoginEvent.Outcome value) { return mapping.convertToDatabaseColumn(value); }
        @Override public EmployeeLoginEvent.Outcome convertToEntityAttribute(String value) { return mapping.convertToEntityAttribute(value); }
    }
}
