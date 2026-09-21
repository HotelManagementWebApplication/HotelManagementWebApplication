package com.hospitality.mis.operations;

import com.hospitality.mis.dao.operations.MaintenanceWorkOrderRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.entity.operations.MaintenanceStatus;
import com.hospitality.mis.entity.operations.MaintenanceWorkOrder;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.dto.operations.MaintenanceDtos;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.operations.MaintenanceService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.LocalDate;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/** Bảo vệ state machine maintenance và việc giải phóng phòng khi hoàn tất. */
class MaintenanceServiceCorrectnessTest {
    /** Ba port mock giữ test ở state transition, room release và audit outcome. */
    @Mock MaintenanceWorkOrderRepository orders;
    @Mock RoomRepository rooms;
    @Mock AuditService audit;

    @org.junit.jupiter.api.BeforeEach
    void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("tech", "", "ROLE_TECHNICAL"));
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    /** Given state chưa xử lý, When skip/reverse, Then transition bị từ chối không audit. */
    @Test void maintenanceCannotSkipOrReverseStates() {
        MaintenanceWorkOrder order = order(MaintenanceStatus.CHUA_XU_LY);
        when(orders.findForUpdateById("M1")).thenReturn(Optional.of(order));
        MaintenanceService service = new MaintenanceService(orders, rooms, audit);
        assertThatThrownBy(() -> service.updateStatus("M1", new MaintenanceDtos.StatusRequest("DA_HOAN_THANH"), "tech"))
                .extracting("code").isEqualTo("INVALID_MAINTENANCE_TRANSITION");
        order.setStatus(MaintenanceStatus.DANG_BAO_TRI);
        assertThatThrownBy(() -> service.updateStatus("M1", new MaintenanceDtos.StatusRequest("CHUA_XU_LY"), "tech"))
                .extracting("code").isEqualTo("INVALID_MAINTENANCE_TRANSITION");
        verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
    }

    /** Given order đang bảo trì, When complete, Then order hoàn tất và room trở lại READY. */
    @Test void completionReleasesRoomAndOnlyValidPathIsAccepted() {
        MaintenanceWorkOrder order = order(MaintenanceStatus.DANG_BAO_TRI);
        when(orders.findForUpdateById("M1")).thenReturn(Optional.of(order));
        when(rooms.findForUpdate("101")).thenReturn(Optional.of(order.getRoom()));
        new MaintenanceService(orders, rooms, audit).updateStatus("M1",
                new MaintenanceDtos.StatusRequest("DA_HOAN_THANH"), "tech");
        org.assertj.core.api.Assertions.assertThat(order.getStatus()).isEqualTo(MaintenanceStatus.DA_HOAN_THANH);
        org.assertj.core.api.Assertions.assertThat(order.getRoom().getStatus()).isEqualTo(RoomStatus.READY);
        verify(audit).record(eq("tech"), eq("MAINTENANCE_STATUS_CHANGED"), any(), eq("M1"),
                eq("DANG_BAO_TRI"), eq("DA_HOAN_THANH"), isNull());
    }

    /** Dựng work order gắn room MAINTENANCE với ngày cố định cho expected audit. */
    private MaintenanceWorkOrder order(MaintenanceStatus status) {
        Room room = new Room(); room.setId("101"); room.setStatus(RoomStatus.MAINTENANCE);
        MaintenanceWorkOrder order = new MaintenanceWorkOrder(); order.setId("M1"); order.setRoom(room); order.setMaintenanceType("repair");
        order.setScheduledDate(LocalDate.of(2031, 1, 1)); order.setStatus(status); return order;
    }
}
