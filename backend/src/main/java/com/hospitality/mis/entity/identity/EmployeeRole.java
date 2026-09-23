package com.hospitality.mis.entity.identity;

import java.util.EnumSet;
import java.util.Set;
import static com.hospitality.mis.entity.identity.Permission.*;

/** Ma trận năng lực duy nhất được sử dụng cho các quyền hạn JWT và việc phân quyền endpoint. */
public enum EmployeeRole {
    /** Toàn quyền theo ma trận hiện hành, trừ các thao tác đặt phòng bị giới hạn đặc biệt. */
    ADMIN(Permission.values()),
    /** Vai trò điều hành cấp cao, dùng cùng tập quyền quản trị. */
    DIRECTOR(Permission.values()),
    /** Quản lý các nhóm nghiệp vụ được liệt kê trong canManage. */
    MANAGER(Permission.values()),
    /** Lễ tân, xử lý nghiệp vụ phòng, khách và đặt phòng tại quầy. */
    FRONT_DESK(ROOM_READ, ROOM_WRITE, EQUIPMENT_READ, GUEST_READ, GUEST_WRITE,
            RESERVATION_READ, RESERVATION_CREATE, RESERVATION_WRITE, RESERVATION_CHECKOUT,
            RESERVATION_SERVICE_WRITE, INCIDENT_WRITE, FRONT_DESK_DASHBOARD, BILLING_READ, PAYMENT_WRITE,
            SERVICE_READ, INVENTORY_READ, INVENTORY_WRITE, MAINTENANCE_READ, CASH_HANDOVER_WRITE,
            APPROVAL_REQUEST, NOTIFICATION_READ, SHIFT_READ),
    /** Kế toán, phụ trách thanh toán, dịch vụ, tồn kho và tài chính. */
    ACCOUNTING(EMPLOYEE_READ, RESERVATION_READ,
            BILLING_READ, BILLING_WRITE, PAYMENT_WRITE, SERVICE_READ, SERVICE_WRITE,
            INVENTORY_READ, INVENTORY_WRITE, CASH_HANDOVER_WRITE, FINANCE_READ, FINANCE_WRITE, APPROVAL_REQUEST, AUDIT_READ),
    /** Buồng phòng, cập nhật trạng thái phòng, sự cố và bảo trì. */
    HOUSEKEEPING(ROOM_READ, ROOM_WRITE, EQUIPMENT_READ, RESERVATION_READ, HOUSEKEEPING_TASK_READ, HOUSEKEEPING_TASK_WRITE,
            INCIDENT_WRITE, SERVICE_READ, INVENTORY_READ, NOTIFICATION_READ,
            INVENTORY_WRITE, MAINTENANCE_READ, MAINTENANCE_WRITE, INCIDENT_HANDOFF),
    /** Kỹ thuật, quản lý thiết bị và phiếu bảo trì. */
    TECHNICAL(ROOM_READ, ROOM_WRITE, ROOM_CATALOG_WRITE, ROOM_ADMIN_READ, ROOM_ADMIN_WRITE, EQUIPMENT_READ, EQUIPMENT_WRITE, RESERVATION_READ,
            MAINTENANCE_READ, MAINTENANCE_WRITE, TECHNICAL_WORK_ORDER_READ, TECHNICAL_WORK_ORDER_WRITE, TECHNICAL_WORK_ORDER_RELEASE, NOTIFICATION_READ, INCIDENT_HANDOFF),
    /** Bếp & F&B, chịu trách nhiệm danh mục, tồn kho và vận hành đơn nhà hàng. */
    KITCHEN(SERVICE_READ, SERVICE_WRITE, INVENTORY_READ, INVENTORY_WRITE, SERVICE_PRICE_REQUEST,
            RESTAURANT_ORDER_READ, RESTAURANT_ORDER_WRITE),
    /** Nhân viên thông thường chỉ xem phòng và đặt phòng. */
    STAFF(ROOM_READ, RESERVATION_READ),
    /** Nhân sự chỉ đọc dữ liệu nhân viên. */
    HR(EMPLOYEE_READ, SHIFT_READ, SHIFT_WRITE);

    /** Tập quyền bất biến được suy ra khi enum khởi tạo. */
    private final Set<Permission> permissions;
    /** Xây dựng tập quyền và áp dụng ngoại lệ quyền của ADMIN/DIRECTOR. */
    EmployeeRole(Permission... permissions) {
        EnumSet<Permission> grants = EnumSet.noneOf(Permission.class);
        for (Permission permission : permissions) grants.add(permission);
        if (name().equals("ADMIN") || name().equals("DIRECTOR")) {
            grants.removeAll(EnumSet.of(RESERVATION_CREATE, RESERVATION_WRITE, RESERVATION_CHECKOUT, RESERVATION_SERVICE_WRITE));
        }
        this.permissions = Set.copyOf(grants);
    }
    public Set<Permission> permissions() { return permissions; }

    /** Kiểm tra vai trò hiện tại có được quản lý vai trò đích hay không. */
    public boolean canManage(EmployeeRole targetRole) {
        if (targetRole == null) return false;
        return switch (this) {
            case DIRECTOR -> true;
            case ADMIN -> targetRole != DIRECTOR;
            case MANAGER -> switch (targetRole) {
                case HR, FRONT_DESK, HOUSEKEEPING, TECHNICAL, KITCHEN, ACCOUNTING, STAFF -> true;
                default -> false;
            };
            default -> false;
        };
    }
}
