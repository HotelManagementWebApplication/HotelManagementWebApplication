package com.hospitality.mis.identity;

import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.identity.Permission;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Bảo vệ ma trận permission và trần quản trị employee của từng role. */
class RolePermissionTest {
    @Test
    /** Given role canonical, When đọc permissions, Then quyền nghiệp vụ đúng và không dư quyền. */
    void canonicalRolesExposeTheirPermissionPolicy() {
        assertThat(EmployeeRole.MANAGER.permissions())
                .contains(Permission.EMPLOYEE_PROVISION, Permission.EMPLOYEE_PASSWORD_RESET,
                        Permission.APPROVAL_APPROVE);
        assertThat(EmployeeRole.FRONT_DESK.permissions())
                .contains(Permission.RESERVATION_WRITE, Permission.PAYMENT_WRITE, Permission.CASH_HANDOVER_WRITE)
                .doesNotContain(Permission.EMPLOYEE_PROVISION, Permission.APPROVAL_APPROVE,
                        Permission.FINANCE_READ, Permission.FINANCE_WRITE);
        assertThat(EmployeeRole.STAFF.permissions()).contains(Permission.RESERVATION_READ);
        assertThat(EmployeeRole.KITCHEN.permissions())
                .contains(Permission.SERVICE_READ, Permission.SERVICE_WRITE,
                        Permission.INVENTORY_READ, Permission.INVENTORY_WRITE,
                        Permission.RESTAURANT_ORDER_READ, Permission.RESTAURANT_ORDER_WRITE)
                .doesNotContain(Permission.RESERVATION_WRITE, Permission.PAYMENT_WRITE,
                        Permission.FINANCE_WRITE);
        assertThat(EmployeeRole.HR.permissions())
                .containsExactlyInAnyOrder(Permission.EMPLOYEE_READ, Permission.SHIFT_READ, Permission.SHIFT_WRITE)
                .doesNotContain(Permission.EMPLOYEE_PROVISION, Permission.EMPLOYEE_PASSWORD_RESET,
                        Permission.BILLING_READ, Permission.BILLING_WRITE, Permission.PAYMENT_WRITE,
                        Permission.FINANCE_READ, Permission.FINANCE_WRITE);
    }

    @Test
    /** Given các role quản trị, When canManage, Then ceiling owner policy được áp dụng chính xác. */
    void employeeAdministrationCeilingFollowsTheOwnerPolicy() {
        assertThat(EmployeeRole.DIRECTOR.canManage(EmployeeRole.ADMIN)).isTrue();
        assertThat(EmployeeRole.ADMIN.canManage(EmployeeRole.ADMIN)).isTrue();
        assertThat(EmployeeRole.ADMIN.canManage(EmployeeRole.DIRECTOR)).isFalse();
        assertThat(EmployeeRole.MANAGER.canManage(EmployeeRole.HR)).isTrue();
        assertThat(EmployeeRole.MANAGER.canManage(EmployeeRole.ACCOUNTING)).isTrue();
        assertThat(EmployeeRole.MANAGER.canManage(EmployeeRole.ADMIN)).isFalse();
        assertThat(EmployeeRole.MANAGER.canManage(EmployeeRole.DIRECTOR)).isFalse();
        assertThat(EmployeeRole.HR.canManage(EmployeeRole.STAFF)).isFalse();
    }
}
