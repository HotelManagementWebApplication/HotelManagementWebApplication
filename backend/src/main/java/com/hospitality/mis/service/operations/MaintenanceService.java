/* Service này điều phối việc khóa phòng, đổi trạng thái và ghi audit cho bảo trì. */
package com.hospitality.mis.service.operations;



import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.dao.operations.MaintenanceWorkOrderRepository;
import com.hospitality.mis.dto.operations.MaintenanceDtos;
import com.hospitality.mis.entity.operations.MaintenanceStatus;
import com.hospitality.mis.entity.operations.MaintenanceWorkOrder;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MaintenanceService {
        // Kho phiếu bảo trì; mọi thao tác lưu trữ đều đi qua DAO này.
    private final MaintenanceWorkOrderRepository orders;
        // Kho phòng; khóa dòng bảo vệ các thay đổi trạng thái phòng đồng thời.
    private final RoomRepository rooms;
        // Ghi nhận người thực hiện cùng các giá trị trước và sau vào nhật ký audit.
    private final AuditService audit;

    public MaintenanceService(MaintenanceWorkOrderRepository orders, RoomRepository rooms, AuditService audit) {
        this.orders = orders; this.rooms = rooms; this.audit = audit;
    }

    /** Tạo phiếu, khóa phòng và chuyển phòng sang MAINTENANCE trong cùng giao dịch. */
    @Transactional
    public MaintenanceDtos.Response create(MaintenanceDtos.CreateRequest request, String actor) {
        String boundActor = authenticatedActor(actor);
        // Không được tạo trùng mã phiếu bảo trì.
        if (orders.existsById(request.id())) throw new DomainException("MAINTENANCE_EXISTS", "Mã phiếu bảo trì đã tồn tại");
        // Khóa phòng trong giao dịch này để các thao tác đồng thời không thể thay đổi phòng cùng lúc.
        var room = rooms.findForUpdate(request.roomId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
        // Phòng đang có khách không thể chuyển sang trạng thái bảo trì.
        if (room.getStatus() == com.hospitality.mis.entity.room.RoomStatus.OCCUPIED)
            throw new DomainException("ROOM_OCCUPIED", "Không thể đưa phòng đang có khách vào bảo trì");
        var order = new MaintenanceWorkOrder(); order.setId(request.id()); order.setRoom(room);
        order.setMaintenanceType(request.type()); order.setScheduledDate(request.scheduledDate()); order.setDescription(request.description());
        // Mở phiếu bảo trì sẽ khóa phòng, không cho phép đặt phòng mới cho đến khi hoàn tất.
        order.setStatus(MaintenanceStatus.CHUA_XU_LY); room.setStatus(com.hospitality.mis.entity.room.RoomStatus.MAINTENANCE); rooms.save(room); orders.save(order);
        audit.record(boundActor, "MAINTENANCE_CREATED", "MAINTENANCE_WORK_ORDER", request.id(), null, request.roomId(), null);
        return toResponse(order);
    }

    /** Kiểm tra transition tuần tự, khóa phòng và đồng bộ trạng thái phòng với phiếu. */
    @Transactional
    public MaintenanceDtos.Response updateStatus(String id, MaintenanceDtos.StatusRequest request, String actor) {
        String boundActor = authenticatedActor(actor);
        // Cập nhật phiếu bảo trì hiện có và trả lỗi nghiệp vụ theo các mã chuẩn.
        var order = orders.findForUpdateById(id).orElseThrow(() -> new DomainException("MAINTENANCE_NOT_FOUND", "Không tìm thấy phiếu bảo trì"));
        MaintenanceStatus next;
        try { next = MaintenanceStatus.valueOf(request.status().trim().toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new DomainException("INVALID_MAINTENANCE_STATUS", "Trạng thái bảo trì không hợp lệ"); }
        // Trạng thái chỉ được chuyển theo thứ tự CHUA_XU_LY -> DANG_BAO_TRI -> DA_HOAN_THANH.
        if (!allowedTransition(order.getStatus(), next))
            throw new DomainException("INVALID_MAINTENANCE_TRANSITION",
                    "Cannot move maintenance from " + order.getStatus() + " to " + next);
        if (order.getStatus() == next) return toResponse(order);
        var before = order.getStatus().name(); order.setStatus(next);
        var room = rooms.findForUpdate(order.getRoom().getId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Room not found"));
        // Hoàn tất sẽ đưa phòng về trạng thái SẴN SÀNG; các trạng thái khác giữ phòng ở trạng thái BẢO TRÌ.
        room.setStatus(next == MaintenanceStatus.DA_HOAN_THANH
                ? com.hospitality.mis.entity.room.RoomStatus.READY
                : com.hospitality.mis.entity.room.RoomStatus.MAINTENANCE);
        audit.record(boundActor, "MAINTENANCE_STATUS_CHANGED", "MAINTENANCE_WORK_ORDER", id, before, next.name(), null);
        return toResponse(order);
    }

    /** Liệt kê lịch sử phiếu bảo trì của phòng theo lịch giảm dần. */
    @Transactional(readOnly = true)
    public List<MaintenanceDtos.Response> byRoom(String roomId) { return orders.findByRoomIdOrderByScheduledDateDesc(roomId).stream().map(this::toResponse).toList(); }

    /** Chuyển phiếu bảo trì thành DTO cho API. */
    private MaintenanceDtos.Response toResponse(MaintenanceWorkOrder o) { return new MaintenanceDtos.Response(o.getId(), o.getRoom().getId(), o.getMaintenanceType(), o.getScheduledDate(), o.getStatus().name(), o.getDescription()); }

    /** Cho phép giữ nguyên hoặc chỉ tiến qua chuỗi trạng thái đã định nghĩa. */
    private boolean allowedTransition(MaintenanceStatus current, MaintenanceStatus next) {
        // Cho phép giữ nguyên trạng thái để việc thử lại không gây tác động ngoài ý muốn.
        if (current == next) return true;
        return (current == MaintenanceStatus.CHUA_XU_LY && next == MaintenanceStatus.DANG_BAO_TRI)
                || (current == MaintenanceStatus.DANG_BAO_TRI && next == MaintenanceStatus.DA_HOAN_THANH);
    }

    private String authenticatedActor(String supplied) {
        try {
            return SecurityActor.requireBoundActor(supplied);
        } catch (AuthenticationCredentialsNotFoundException exception) {
            throw new DomainException("ACTOR_REQUIRED", "Thiếu actor đã xác thực");
        } catch (AccessDeniedException exception) {
            throw new DomainException("ACTOR_MISMATCH", "Actor không khớp principal hiện tại");
        }
    }
}
