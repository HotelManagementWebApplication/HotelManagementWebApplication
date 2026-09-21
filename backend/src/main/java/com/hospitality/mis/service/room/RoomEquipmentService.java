package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.entity.room.RoomEquipment;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

/** Quản lý thiết bị gắn với phòng, có khóa phòng, audit tùy chọn và idempotency. */
@Service
public class RoomEquipmentService {
    /** Kho thiết bị, lưu các thuộc tính và cờ active của thiết bị. */
    private final RoomEquipmentRepository equipment;
    /** Khóa phòng trước khi thêm thiết bị để xác nhận quan hệ hiện hữu. */
    private final RoomRepository rooms;
    /** Ghi audit; có thể null ở constructor tương thích với caller cũ. */
    private final AuditService audit;
    /** Giữ kết quả add theo actor/key/fingerprint trong instance hiện tại. */
    private final IdempotencySupport idempotency = new IdempotencySupport();
    private DurableIdempotencyService durableIdempotency;

    public RoomEquipmentService(RoomEquipmentRepository equipment, RoomRepository rooms) {
        this(equipment, rooms, null);
    }

    @Autowired
    public RoomEquipmentService(RoomEquipmentRepository equipment, RoomRepository rooms, AuditService audit) {
        this.equipment = equipment;
        this.rooms = rooms;
        this.audit = audit;
    }

    @Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) { this.durableIdempotency = durableIdempotency; }

    /** Điểm vào tương thích với controller; tác nhân và khóa được lấy từ ngữ cảnh yêu cầu. */
    /** Đọc actor và Idempotency-Key từ request context rồi ủy quyền cho overload nghiệp vụ. */
    @Transactional
    public RoomEquipmentDtos.Response add(RoomEquipmentDtos.CreateRequest request) {
        return add(request, currentActor(), currentIdempotencyKey());
    }

    /** Khóa phòng, tạo thiết bị và bảo đảm retry không ghi bản ghi trùng. */
    @Transactional
    public RoomEquipmentDtos.Response add(RoomEquipmentDtos.CreateRequest request, String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        String fingerprint = IdempotencySupport.fingerprint("ROOM_EQUIPMENT|" + request.roomId() + "|" + request.name()
                + "|" + request.originalValue() + "|" + request.purchasedOn() + "|" + request.quantity());
        return executeIdempotent("room-equipment", key, actor, fingerprint, RoomEquipmentDtos.Response.class, () -> {
            var room = rooms.findForUpdate(request.roomId())
                    .orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
            RoomEquipment item = new RoomEquipment();
            item.setRoom(room); item.setName(request.name()); item.setOriginalValue(request.originalValue());
            item.setPurchasedOn(request.purchasedOn()); item.setQuantity(request.quantity());
            var saved = equipment.save(item);
            if (audit != null) audit.record(actor, "ROOM_EQUIPMENT_ADDED", "ROOM", room.getId(), null, request.name(), null);
            return toResponse(saved);
        });
    }

    private <T> T executeIdempotent(String scope, String key, String actor, String fingerprint,
                                    Class<T> responseType, java.util.function.Supplier<T> command) {
        return durableIdempotency == null
                ? idempotency.execute(scope, key, actor, fingerprint, command)
                : durableIdempotency.execute(scope, key, actor, fingerprint, responseType, command);
    }

    /** Liệt kê thiết bị active của phòng theo tên. */
    @Transactional(readOnly = true)
    public List<RoomEquipmentDtos.Response> list(String roomId) {
        return equipment.findByRoomIdAndActiveTrueOrderByNameAsc(roomId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public RoomEquipmentDtos.Response update(String roomId, Long equipmentId, RoomEquipmentDtos.UpdateRequest request, String actor) {
        String boundActor = authenticatedActor(actor);
        if (request == null || request.active() == null)
            throw new DomainException("INVALID_REQUEST", "Thiếu nội dung cập nhật thiết bị");
        RoomEquipment item = equipment.findForUpdateByIdAndRoomId(equipmentId, roomId)
                .orElseThrow(() -> new DomainException("EQUIPMENT_NOT_FOUND", "Không tìm thấy thiết bị trong phòng"));
        item.setName(request.name().trim()); item.setOriginalValue(request.originalValue());
        item.setPurchasedOn(request.purchasedOn()); item.setQuantity(request.quantity()); item.setActive(request.active());
        if (audit != null) audit.record(boundActor, "ROOM_EQUIPMENT_UPDATED", "ROOM_EQUIPMENT", String.valueOf(equipmentId), null, roomId, null);
        return toResponse(equipment.save(item));
    }

    /** Lấy actor hiện tại từ security context. */
    private String currentActor() {
        return SecurityActor.currentActor();
    }

    /** Lấy Idempotency-Key từ HTTP request, bắt buộc với điểm vào controller. */
    private String currentIdempotencyKey() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servlet) {
            return servlet.getRequest().getHeader("Idempotency-Key");
        }
        throw new DomainException("IDEMPOTENCY_KEY_REQUIRED", "Thiếu Idempotency-Key");
    }

    /** Ràng buộc actor với principal khi có authentication, hỗ trợ caller test không có context. */
    private String authenticatedActor(String supplied) {
        try {
            return SecurityActor.requireBoundActor(supplied);
        } catch (org.springframework.security.authentication.AuthenticationCredentialsNotFoundException exception) {
            throw new DomainException("ACTOR_REQUIRED", "Thiếu actor đã xác thực");
        } catch (org.springframework.security.access.AccessDeniedException exception) {
            throw new DomainException("ACTOR_MISMATCH", "Actor không khớp principal hiện tại");
        }
    }

    /** Chuyển thiết bị và thông tin phòng thành DTO. */
    private RoomEquipmentDtos.Response toResponse(RoomEquipment e) {
        return new RoomEquipmentDtos.Response(e.getId(), e.getRoom().getId(), e.getName(), e.getOriginalValue(),
                e.getPurchasedOn(), e.getQuantity(), e.isActive());
    }
}
