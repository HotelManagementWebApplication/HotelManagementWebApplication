package com.hospitality.mis.security;

import com.hospitality.mis.service.auth.AuthService;
import com.hospitality.mis.service.auth.CustomerAccountService;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import com.hospitality.mis.service.billing.ReceiptService;
import com.hospitality.mis.service.billing.ServiceCatalogService;
import com.hospitality.mis.service.finance.FinanceService;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.guest.GuestService;
import com.hospitality.mis.service.guest.MembershipHistoryService;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.service.operations.FrontDeskDashboardService;
import com.hospitality.mis.service.operations.HousekeepingService;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import com.hospitality.mis.service.room.RoomAdminService;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingInspectionService;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import com.hospitality.mis.service.operations.InventoryMovementService;
import com.hospitality.mis.service.operations.MaintenanceService;
import com.hospitality.mis.service.operations.RoomTransferService;
import com.hospitality.mis.service.reservation.ReservationService;
import com.hospitality.mis.service.reservation.CustomerReservationService;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import com.hospitality.mis.service.room.RoomService;
import com.hospitality.mis.service.room.RoomEquipmentService;
import com.hospitality.mis.service.room.RoomMediaService;
import com.hospitality.mis.service.room.RoomTypeCatalogService;
import com.hospitality.mis.middleware.security.ApprovalAuthorization;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/** Ma trận cho phép/từ chối HTTP độc lập; các dịch vụ giả lập giúp tách RBAC của endpoint khỏi các quy tắc nghiệp vụ. */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:departmentmatrix;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class DepartmentAuthorizationMatrixTest {
    /** HTTP boundary thật; mỗi endpoint trong matrix chạy qua security filter. */
    @Autowired MockMvc mvc;
    /** Mapping registry dùng chứng minh mọi protected endpoint có matrix row. */
    @Autowired RequestMappingHandlerMapping requestMappingHandlerMapping;
    @MockBean AuthService mock0;
    @MockBean CustomerAccountService mock1;
    @MockBean BillingService mock2;
    @MockBean PaymentTransactionService mock3;
    @MockBean ReceiptService mock4;
    @MockBean ServiceCatalogService mock5;
    @MockBean FinanceService mock6;
    @MockBean ApprovalService mock7;
    @MockBean AuditService mock8;
    @MockBean GuestService mock9;
    @MockBean MembershipHistoryService mock10;
    @MockBean EquipmentIncidentService mock11;
    @MockBean InventoryMovementService mock12;
    @MockBean MaintenanceService mock13;
    @MockBean RoomTransferService mock14;
    @MockBean ReservationService mock15;
    @MockBean RoomService mock16;
    @MockBean RoomEquipmentService mock17;
    @MockBean CustomerReservationService mock18;
    @MockBean RoomMediaService mock19;
    @MockBean RoomTypeCatalogService mock20;
    @MockBean FrontDeskDashboardService mock21;
    @MockBean HousekeepingService mock22;
    @MockBean TechnicalWorkOrderService mock23;
    @MockBean EmployeeService mock24;
    @MockBean NotificationOutboxService mock25;
    @MockBean RoomAdminService mock26;
    @MockBean HousekeepingChecklistService mock27;
    @MockBean EmployeeShiftService mock28;
    @MockBean HousekeepingInspectionService mock29;
    @MockBean HotelServiceBookingService mock30;
    @MockBean ApprovalAuthorization approvalAuthorization;
    /** Gom các business mock để reset invocation và chứng minh deny không gọi nghiệp vụ. */
    private List<Object> businessMocks() { return List.of(mock0, mock1, mock2, mock3, mock4, mock5, mock6, mock7, mock8, mock9, mock10, mock11, mock12, mock13, mock14, mock15, mock16, mock17, mock18, mock19, mock20, mock21, mock22, mock23, mock24, mock25, mock26, mock27, mock28, mock29, mock30); }

    /** Stub response tối thiểu để matrix chỉ đo RBAC, không đo business rules. */
    @BeforeEach void responses() {
        when(approvalAuthorization.canApprove(anyLong(), anyString())).thenReturn(true);
        when(mock15.get(1L)).thenReturn(new ReservationDtos.Response(1L, 1L, "actor",
            ReservationStatus.CONFIRMED, ReservationDtos.RentalType.PACKAGE,
            java.math.BigDecimal.ZERO, null, null, null, List.of(), null,
            null, "DIRECT", java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO,
            java.math.BigDecimal.ZERO, "NOT_APPLICABLE", List.of(), null,
            com.hospitality.mis.entity.reservation.DepositPaymentStatus.NOT_REQUIRED));
        when(mock21.get(any(), any(), any(), anyInt(), anyInt())).thenReturn(
            new com.hospitality.mis.dto.operations.FrontDeskDashboardDtos.Response(
                java.time.LocalDate.now(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), Map.of(), List.of(), 0, 20, 0, 0));
        when(mock22.list(any(), any(), any())).thenReturn(List.of());
        when(mock23.list(any(), any())).thenReturn(List.of());
        when(mock24.canResetEmployee(any(), anyString())).thenReturn(true);
        when(mock24.canManageRole(any(), any())).thenReturn(true);
        when(mock24.canManageEmployeeRole(any(), anyString(), any())).thenReturn(true);
        when(mock24.list(anyBoolean())).thenReturn(List.of());
        when(mock24.provisionAuto(any())).thenReturn(new com.hospitality.mis.dto.auth.AuthDtos.AutoProvisionResponse(
            "EMP", "Test", com.hospitality.mis.entity.identity.EmployeeRole.STAFF,
            "0900000000", "test@hotel.com", "temp123", true));
        when(mock25.poll(any())).thenReturn(List.of());
        when(mock26.list()).thenReturn(List.of());
        when(mock27.templates()).thenReturn(List.of());
        when(mock27.results(anyLong())).thenReturn(List.of());
        when(mock28.list(any(), any())).thenReturn(List.of());
        when(mock29.list(anyLong())).thenReturn(List.of());
        businessMocks().forEach(x -> clearInvocations(x));
    }

    /** Một row matrix: method/path, role allowlist và body canonical của endpoint. */
    record Endpoint(String method, String path, String roles, String body) {
        public String toString() { return method + " " + path; }
    }
    /** Danh sách endpoint bảo vệ, là nguồn dữ liệu cho cả matrix và coverage check. */
    static List<Endpoint> endpoints() { return List.of(
            new Endpoint("POST", "/api/auth/employees", "ADMIN,DIRECTOR,MANAGER", "{\"employee_id\":\"new\",\"full_name\":\"New\",\"password\":\"valid-password\",\"role\":\"STAFF\",\"phone\":\"0900000000\"}"),
            new Endpoint("GET", "/api/auth/employees", "ADMIN,DIRECTOR,MANAGER,HR,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/auth/employees/emp", "ADMIN,DIRECTOR,MANAGER,HR,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/auth/employees/emp/sessions", "ADMIN,DIRECTOR,MANAGER,HR,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/auth/employees/emp/login-history", "ADMIN,DIRECTOR,MANAGER,HR,ACCOUNTING", "{}"),
            new Endpoint("PATCH", "/api/auth/employees/emp/status", "ADMIN,DIRECTOR,MANAGER", "{\"enabled\":false}"),
            new Endpoint("PATCH", "/api/auth/employees/emp/role", "ADMIN,DIRECTOR,MANAGER", "{\"role\":\"FRONT_DESK\"}"),
            new Endpoint("PATCH", "/api/auth/employees/emp/employment", "ADMIN,DIRECTOR,MANAGER", "{\"status\":\"WORKING\"}"),
            new Endpoint("DELETE", "/api/auth/employees/emp/sessions/1", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("POST", "/api/auth/employees/emp/password", "ADMIN,DIRECTOR,MANAGER", "{\"password\":\"valid-password\"}"),
            new Endpoint("GET", "/api/guests", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/guests/1", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/guests/1/membership-history", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/guests", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK", "{\"full_name\":\"Guest\",\"identity_number\":\"123456789012\",\"phone\":\"0900000000\"}"),
            new Endpoint("GET", "/api/rooms", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("GET", "/api/rooms/admin", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/rooms/admin", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"id\":\"101\",\"name\":\"101\",\"room_type_id\":\"STD\"}"),
            new Endpoint("PUT", "/api/rooms/admin/101", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"id\":\"101\",\"name\":\"101\",\"room_type_id\":\"STD\"}"),
            new Endpoint("GET", "/api/rooms/availability?from=2026-10-01T12:00:00&to=2026-10-02T12:00:00", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("PATCH", "/api/rooms/101/status?status=available", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL", "{}"),
            new Endpoint("GET", "/api/rooms/101/equipment", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL", "{}"),
            new Endpoint("GET", "/api/rooms/101/media", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("POST", "/api/rooms/101/equipment", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"room_id\":\"101\",\"name\":\"TV\",\"original_value\":100,\"purchased_on\":\"2026-01-01\",\"quantity\":1}"),
            new Endpoint("PUT", "/api/rooms/101/equipment/1", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"name\":\"TV\",\"original_value\":100,\"purchased_on\":\"2026-01-01\",\"quantity\":1,\"active\":true}"),
            new Endpoint("POST", "/api/rooms/101/images", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", ""),
            new Endpoint("DELETE", "/api/rooms/101/images/1", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/amenities", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"name\":\"Wi-Fi\"}"),
            new Endpoint("GET", "/api/amenities", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("PUT", "/api/amenities/1", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"name\":\"Wi-Fi\",\"active\":true}"),
            new Endpoint("POST", "/api/room-types", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"id\":\"STD\",\"name\":\"Standard\",\"daily_price\":100000}"),
            new Endpoint("PUT", "/api/room-types/STD", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"id\":\"STD\",\"name\":\"Standard\",\"daily_price\":100000}"),
            new Endpoint("POST", "/api/room-types/STD/revision", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"id\":\"STD-V2\",\"name\":\"Standard v2\",\"daily_price\":110000}"),
            new Endpoint("GET", "/api/room-types/STD", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("GET", "/api/room-types/STD/price-history", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("GET", "/api/front-desk/dashboard", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/operations/housekeeping/tasks", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{}"),
            new Endpoint("POST", "/api/operations/housekeeping/tasks", "ADMIN,DIRECTOR,MANAGER", "{\"room_id\":\"101\"}"),
            new Endpoint("PATCH", "/api/operations/housekeeping/tasks/1", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{\"status\":\"CLEANED\"}"),
            new Endpoint("GET", "/api/operations/housekeeping/checklist-templates", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{}"),
            new Endpoint("POST", "/api/operations/housekeeping/checklist-templates", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{\"name\":\"Bathroom\"}"),
            new Endpoint("GET", "/api/operations/housekeeping/tasks/1/checklist-results", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{}"),
            new Endpoint("POST", "/api/operations/housekeeping/tasks/1/checklist-results", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{\"item\":\"Towels\",\"passed\":true}"),
            new Endpoint("GET", "/api/operations/housekeeping/tasks/1/inspections", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{}"),
            new Endpoint("POST", "/api/operations/housekeeping/tasks/1/inspections", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING", "{\"inspection_type\":\"MINIBAR\",\"item\":\"Water\",\"quantity\":1,\"item_condition\":\"OK\"}"),
            new Endpoint("GET", "/api/operations/technical/work-orders", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/operations/technical/work-orders", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"room_id\":\"101\",\"priority\":\"HIGH\"}"),
            new Endpoint("PATCH", "/api/operations/technical/work-orders/1", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"status\":\"ACKNOWLEDGED\"}"),
            new Endpoint("POST", "/api/operations/technical/work-orders/1/accept", "ADMIN,DIRECTOR,MANAGER", "{\"acceptance_note\":\"Verified\"}"),
            new Endpoint("POST", "/api/operations/technical/work-orders/1/release", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("GET", "/api/hr/shifts", "ADMIN,DIRECTOR,MANAGER,HR,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/hr/shifts/coverage?shiftCode=AM", "ADMIN,DIRECTOR,MANAGER,HR,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/hr/shifts", "ADMIN,DIRECTOR,MANAGER,HR", "{\"employee_id\":\"emp\",\"shift_date\":\"2026-10-01\",\"shift_code\":\"AM\",\"starts_at\":\"2026-10-01T08:00:00\",\"ends_at\":\"2026-10-01T16:00:00\"}"),
            new Endpoint("PATCH", "/api/hr/shifts/1/status", "ADMIN,DIRECTOR,MANAGER,HR", "{\"status\":\"CANCELLED\"}"),
            new Endpoint("PUT", "/api/hr/shifts/1", "ADMIN,DIRECTOR,MANAGER,HR", "{\"shift_date\":\"2026-10-01\",\"shift_code\":\"AM\",\"starts_at\":\"2026-10-01T08:00:00\",\"ends_at\":\"2026-10-01T16:00:00\"}"),
            new Endpoint("POST", "/api/room-types/STD/submit", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/room-types/STD/activate", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("PUT", "/api/room-types/STD/amenities", "ADMIN,DIRECTOR,MANAGER,TECHNICAL", "{\"amenity_ids\":[]}"),
            new Endpoint("GET", "/api/reservations", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("GET", "/api/reservations/1", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("GET", "/api/reservations/1/service-bookings", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/reservations/1/service-bookings/1/use", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/reservations", "MANAGER,FRONT_DESK", "{\"guest_id\":1,\"employee_id\":\"actor\",\"deposit\":0,\"rental_type\":\"PACKAGE\",\"rooms\":[{\"room_id\":\"101\",\"expected_check_in\":\"2026-10-01T12:00:00\",\"expected_check_out\":\"2026-10-02T12:00:00\"}]}"),
            new Endpoint("POST", "/api/reservations/1/check-in", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/reservations/1/confirm", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("PATCH", "/api/reservations/1", "MANAGER,FRONT_DESK", "{\"rooms\":[{\"room_id\":\"101\",\"expected_check_in\":\"2026-10-01T12:00:00\",\"expected_check_out\":\"2026-10-02T12:00:00\"}]}"),
            new Endpoint("GET", "/api/reservations/1/timeline", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,TECHNICAL,STAFF", "{}"),
            new Endpoint("POST", "/api/reservations/1/check-out", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/reservations/1/cancel", "MANAGER,FRONT_DESK", "{\"reason\":\"Cancelled\"}"),
            new Endpoint("POST", "/api/reservations/1/no-show", "MANAGER,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/reservations/1/extend", "MANAGER,FRONT_DESK", "{\"new_expected_check_out\":\"2026-10-03T12:00:00\"}"),
            new Endpoint("POST", "/api/reservations/1/services", "MANAGER,FRONT_DESK", "{\"service_id\":\"S1\",\"quantity\":1}"),
            new Endpoint("POST", "/api/reservations/1/equipment-incidents", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING", "{\"room_id\":\"101\",\"equipment_name\":\"TV\",\"original_value\":100,\"purchased_at\":\"2026-01-01\",\"quantity\":1}"),
            new Endpoint("POST", "/api/operations/reservations/1/equipment-incidents", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING", "{\"room_id\":\"101\",\"equipment_name\":\"TV\",\"original_value\":100,\"purchased_at\":\"2026-01-01\",\"quantity\":1}"),
            new Endpoint("GET", "/api/operations/incidents", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/operations/incidents", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING", "{\"room_id\":\"101\",\"equipment_name\":\"Cửa phòng\",\"quantity\":1,\"severity\":\"MEDIUM\",\"description\":\"Khóa cửa kẹt\"}"),
            new Endpoint("PATCH", "/api/operations/reservations/incidents/1/handoff", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING,TECHNICAL", "{\"status\":\"ACKNOWLEDGED\"}"),
            new Endpoint("POST", "/api/operations/reservations/1/room-transfers", "MANAGER,FRONT_DESK", "{\"from_room_id\":\"101\",\"to_room_id\":\"102\"}"),
            new Endpoint("GET", "/api/invoices/reservation/1", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/invoices", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/invoices/reservation/1/deposit/refund", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/invoices/1/adjust", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{\"delta\":1,\"reason\":\"Correction\"}"),
            new Endpoint("GET", "/api/invoices/1/payments", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/invoices/1/receipts", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("POST", "/api/invoices/1/payments", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{\"amount\":100,\"method\":\"CASH\",\"type\":\"PAYMENT\"}"),
            new Endpoint("POST", "/api/invoices/1/receipts", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{\"receipt_number\":\"R1\",\"amount\":100,\"method\":\"CASH\"}"),
            new Endpoint("GET", "/api/services", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{}"),
            new Endpoint("POST", "/api/services", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,KITCHEN", "{\"id\":\"S1\",\"name\":\"Water\",\"price\":100,\"opening_stock\":1,\"safety_threshold\":0}"),
            new Endpoint("POST", "/api/services/S1/stock", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{\"quantity\":1}"),
            new Endpoint("GET", "/api/services/low-stock", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{}"),
            new Endpoint("GET", "/api/services/S1/inventory-movements", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{}"),
            new Endpoint("GET", "/api/services/S1/inventory-movements/inventory-report", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{}"),
            new Endpoint("POST", "/api/services/S1/inventory-movements", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{\"service_id\":\"S1\",\"type\":\"RECEIVE\",\"quantity\":1}"),
            new Endpoint("POST", "/api/services/S1/price/submit", "ADMIN,DIRECTOR,MANAGER,KITCHEN", "{\"price\":120,\"reason\":\"Cost update\"}"),
            new Endpoint("POST", "/api/services/S1/price/activate", "ADMIN,DIRECTOR,MANAGER", "{\"price\":120,\"reason\":\"Cost update\"}"),
            new Endpoint("GET", "/api/services/S1/price-history", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK,HOUSEKEEPING,KITCHEN", "{}"),
            new Endpoint("GET", "/api/services/price-requests", "ADMIN,DIRECTOR,MANAGER,KITCHEN", "{}"),
            new Endpoint("GET", "/api/operations/restaurant/service-bookings?date=2026-10-01", "ADMIN,DIRECTOR,MANAGER,KITCHEN", "{}"),
            new Endpoint("POST", "/api/operations/restaurant/service-bookings/1/use", "ADMIN,DIRECTOR,MANAGER,KITCHEN", "{}"),
            new Endpoint("GET", "/api/operations/maintenance/room/101", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/operations/maintenance", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING,TECHNICAL", "{\"id\":\"M1\",\"room_id\":\"101\",\"type\":\"Repair\",\"scheduled_date\":\"2026-10-01\"}"),
            new Endpoint("PATCH", "/api/operations/maintenance/M1/status", "ADMIN,DIRECTOR,MANAGER,HOUSEKEEPING,TECHNICAL", "{\"status\":\"DANG_BAO_TRI\"}"),
            new Endpoint("GET", "/api/finance/cash-handovers", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/cash-handovers/mine", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{}"),
            new Endpoint("GET", "/api/finance/expenses", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/partner-debts", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/partner-debts/1/settlements", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/ledger", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("POST", "/api/finance/partner-debts/1/settle", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{\"amount\":10}"),
            new Endpoint("GET", "/api/finance/reconciliation", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/payments", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/finance/receipts", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("POST", "/api/finance/cash-handovers", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{\"shift_code\":\"SHIFT\",\"from_actor\":\"actor\",\"to_actor\":\"other\",\"actual_amount\":100}"),
            new Endpoint("POST", "/api/finance/expenses", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{\"category\":\"Food\",\"description\":\"Food\",\"amount\":100}"),
            new Endpoint("POST", "/api/finance/partner-debts", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{\"partner_name\":\"Partner\",\"reference_code\":\"D1\",\"amount\":100}"),
            new Endpoint("GET", "/api/governance/approvals", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("POST", "/api/governance/approvals", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING,FRONT_DESK", "{\"action\":\"PRICE_OVERRIDE\",\"target_id\":\"1\",\"payload\":\"{}\",\"reason\":\"Review\"}"),
            new Endpoint("POST", "/api/governance/approvals/1/approve", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("POST", "/api/governance/approvals/1/reject", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("GET", "/api/governance/audit", "ADMIN,DIRECTOR,MANAGER,ACCOUNTING", "{}"),
            new Endpoint("GET", "/api/governance/notifications/outbox", "ADMIN,DIRECTOR,MANAGER,FRONT_DESK,HOUSEKEEPING,TECHNICAL", "{}"),
            new Endpoint("POST", "/api/governance/notifications/outbox/1/delivered", "ADMIN,DIRECTOR,MANAGER", "{}"),
            new Endpoint("GET", "/api/auth/me", "ADMIN,DIRECTOR,MANAGER,HR,FRONT_DESK,ACCOUNTING,HOUSEKEEPING,TECHNICAL,KITCHEN,STAFF", "{}"),
            new Endpoint("POST", "/api/auth/me/password", "ADMIN,DIRECTOR,MANAGER,HR,FRONT_DESK,ACCOUNTING,HOUSEKEEPING,TECHNICAL,KITCHEN,STAFF,CUSTOMER,UNKNOWN", "{\"password\":\"valid-password\"}"),
            new Endpoint("GET", "/api/auth/customers/me", "CUSTOMER", "{}"),
            new Endpoint("PUT", "/api/auth/customers/me", "CUSTOMER", "{\"full_name\":\"Test\",\"identity_number\":\"123456789012\"}"),
            new Endpoint("POST", "/api/auth/customers/password", "CUSTOMER", "{\"password\":\"valid-password\"}"),
            new Endpoint("POST", "/api/auth/employees/auto-provision", "ADMIN,DIRECTOR,MANAGER", "{\"role\":\"STAFF\",\"full_name\":\"Test\",\"phone\":\"0900000000\",\"email\":\"test@hotel.com\"}"),
            new Endpoint("POST", "/api/customer/reservations", "CUSTOMER", "{\"rental_type\":\"PACKAGE\",\"rooms\":[{\"room_id\":\"101\",\"expected_check_in\":\"2026-10-01T12:00:00\",\"expected_check_out\":\"2026-10-02T12:00:00\"}],\"idempotency_key\":\"customer-key\"}"),
            new Endpoint("GET", "/api/customer/reservations", "CUSTOMER", "{}"),
            new Endpoint("GET", "/api/customer/reservations/1", "CUSTOMER", "{}"),
            new Endpoint("GET", "/api/customer/reservations/1/deposit-payment", "CUSTOMER", "{}"),
            new Endpoint("POST", "/api/customer/reservations/1/cancel", "CUSTOMER", "{\"reason\":\"Khách đổi kế hoạch\"}"),
            new Endpoint("POST", "/api/customer/service-bookings", "CUSTOMER", "{\"reservation_id\":1,\"room_id\":\"101\",\"service_id\":\"S1\",\"scheduled_at\":\"2026-10-01T12:00:00\",\"quantity\":1}"),
            new Endpoint("GET", "/api/customer/service-bookings?reservation_id=1", "CUSTOMER", "{}"),
            new Endpoint("POST", "/api/customer/service-bookings/1/cancel", "CUSTOMER", "{}"),
            new Endpoint("POST", "/api/auth/logout", "ADMIN,DIRECTOR,MANAGER,HR,FRONT_DESK,ACCOUNTING,HOUSEKEEPING,TECHNICAL,KITCHEN,STAFF,CUSTOMER,UNKNOWN", "{}")
    ); }
    /** Sinh role case, gồm UNKNOWN để bảo vệ default deny. */
    static Stream<Arguments> matrix() {
        return endpoints().stream().flatMap(endpoint -> Stream.of(
            "ADMIN", "DIRECTOR", "MANAGER", "HR", "FRONT_DESK", "ACCOUNTING", "HOUSEKEEPING",
            "TECHNICAL", "KITCHEN", "STAFF", "CUSTOMER", "UNKNOWN", "ANONYMOUS")
            .map(role -> Arguments.of(endpoint, role)));
    }

    @ParameterizedTest(name = "{1}: {0}") @MethodSource("matrix")
    /** Given endpoint/role, When gọi HTTP, Then allowlist quyết định status và allowed mới chạm mock. */
    void roleCanOnlyInvokeAuthorizedDepartmentFunctions(Endpoint endpoint, String role) throws Exception {
        var request = endpoint.method().equals("POST") && endpoint.path().contains("/images")
            ? multipart(endpoint.path()).file(new MockMultipartFile("file", "room.jpg", "image/jpeg",
                new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff}))
            : request(HttpMethod.valueOf(endpoint.method()), endpoint.path())
                .contentType("application/json").content(endpoint.body());
        request.header("Idempotency-Key", "matrix-key");
        if (!role.equals("ANONYMOUS")) request.with(jwt().jwt(token -> token.subject(role.equals("CUSTOMER") ? "1" : "actor")
            .claim("principal_id", role.equals("CUSTOMER") ? "1" : "actor").claim("principal_type", role.equals("CUSTOMER") ? "CUSTOMER" : "EMPLOYEE"))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role)));
        var response = mvc.perform(request).andReturn().getResponse();
        boolean allowed = Arrays.asList(endpoint.roles().split(",")).contains(role);
        if (allowed) {
            assertThat(response.getStatus()).as(endpoint + " for " + role + ": " + response.getContentAsString())
                .isBetween(200, 299);
            assertThat(businessMocks().stream().mapToInt(x -> mockingDetails(x).getInvocations().size()).sum())
                .as("Authorized request must reach its business service").isPositive();
        } else {
            assertThat(response.getStatus()).as(endpoint + " for " + role + ": " + response.getContentAsString())
                .isEqualTo(role.equals("ANONYMOUS") ? 401 : 403);
            businessMocks().forEach(x -> verifyNoInteractions(x));
        }
    }

    /** Given handler mappings production, When đối chiếu matrix, Then không protected endpoint bị bỏ sót. */
    @Test void everyProtectedApiMappingIsCoveredByTheMatrix() {
        Set<String> publicPaths = Set.of("/api/auth/login", "/api/auth/customers/login",
            "/api/auth/refresh", "/api/auth/customers/register", "/api/auth/customers/register-with-otp",
            "/api/auth/customers/reset-password-otp");
        Set<String> covered = new HashSet<>();
        List<String> coverageErrors = new ArrayList<>();
        for (var entry : requestMappingHandlerMapping.getHandlerMethods().entrySet()) {
            Class<?> beanType = entry.getValue().getBeanType();
            if (beanType.getSimpleName().startsWith("EnterpriseExtension") || beanType.getSimpleName().startsWith("CommercialPartner")) continue;
            for (String pattern : entry.getKey().getPatternValues()) {
                if (!pattern.startsWith("/api/") || pattern.startsWith("/api/public/")
                        || pattern.startsWith("/api/auth/otp/") || publicPaths.contains(pattern)) continue;
                for (var method : entry.getKey().getMethodsCondition().getMethods()) {
                    String regex = pattern.replaceAll("\\{[^}]+}", "[^/]+");
                    var matches = endpoints().stream().filter(e -> e.method().equals(method.name())
                        && e.path().split("\\?")[0].matches(regex)).toList();
                    if (matches.size() != 1) {
                        coverageErrors.add((matches.isEmpty() ? "Uncovered" : "Duplicated") + " endpoint: " + method + " " + pattern);
                    } else {
                        covered.add(matches.get(0).toString());
                    }
                }
            }
        }
        assertThat(coverageErrors).as("Every protected endpoint must have exactly one matrix row").isEmpty();
        assertThat(covered).hasSize(endpoints().size());
    }
}
