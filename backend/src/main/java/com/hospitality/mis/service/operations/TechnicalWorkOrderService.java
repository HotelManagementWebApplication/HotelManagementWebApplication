package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.TechnicalWorkOrderRepository;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.ReservationOverlapPort;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.TechnicalWorkOrder;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;

@Service
public class TechnicalWorkOrderService {
    private final TechnicalWorkOrderRepository orders; private final RoomRepository rooms;
    private final RoomEquipmentRepository equipment; private final AuditService audit;
    private final HousekeepingTaskRepository housekeepingTasks;
    private final ReservationOverlapPort overlaps;
    private final EquipmentIncidentRepository incidents;
    private final Clock clock;
    private final DurableIdempotencyService durableIdempotency;
    public TechnicalWorkOrderService(TechnicalWorkOrderRepository orders, RoomRepository rooms,
                                     RoomEquipmentRepository equipment, AuditService audit,
                                     HousekeepingTaskRepository housekeepingTasks,
                                     ReservationOverlapPort overlaps, EquipmentIncidentRepository incidents, Clock clock,
                                     DurableIdempotencyService durableIdempotency) {
        this.orders = orders; this.rooms = rooms; this.equipment = equipment; this.audit = audit;
        this.housekeepingTasks = housekeepingTasks; this.overlaps = overlaps; this.incidents = incidents; this.clock = clock;
        this.durableIdempotency = durableIdempotency;
    }
    @Transactional
    public TechnicalWorkOrderDtos.Response create(TechnicalWorkOrderDtos.CreateRequest request, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("TECHNICAL_CREATE|" + request);
        return executeIdempotent("technical-work-order-create", key, boundActor, fingerprint, () -> createOnce(request, boundActor));
    }
    private TechnicalWorkOrderDtos.Response createOnce(TechnicalWorkOrderDtos.CreateRequest request, String actor) {
        var room = rooms.findForUpdate(request.roomId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
        if (room.getStatus() == RoomStatus.OCCUPIED)
            throw new DomainException("ROOM_OCCUPIED", "Không thể tạo work order cho phòng đang có khách");
        if (room.getStatus() == RoomStatus.OUT_OF_SERVICE)
            throw new DomainException("ROOM_OUT_OF_SERVICE", "Không thể tạo work order cho phòng ngừng sử dụng");
        TechnicalWorkOrder order = new TechnicalWorkOrder(); order.setRoom(room); order.setCreatedBy(actor);
        order.setCreatedAt(LocalDateTime.now(clock)); order.setUpdatedAt(LocalDateTime.now(clock));
        if (request.equipmentId() != null) order.setEquipment(equipment.findByIdAndRoomIdAndActiveTrue(request.equipmentId(), request.roomId())
                .orElseThrow(() -> new DomainException("EQUIPMENT_NOT_FOUND", "Thiết bị active không thuộc phòng")));
        String assignee = request.assignee() == null || request.assignee().isBlank() ? actor : request.assignee().trim();
        if (!hasManagementRole() && !actor.equals(assignee))
            throw new DomainException("TECHNICAL_ASSIGNMENT_FORBIDDEN", "Technical chỉ được tự nhận work order của mình");
        order.setAssignee(assignee); order.setPriority(normalizePriority(request.priority())); order.setSlaDueAt(request.slaDueAt());
        order.setMaterials(request.materials()); room.setStatus(RoomStatus.MAINTENANCE); orders.save(order);
        audit.record(actor, "TECHNICAL_WORK_ORDER_CREATED", "TECHNICAL_WORK_ORDER", "new", null, request.roomId(), null);
        return toResponse(order);
    }
    @Transactional
    public TechnicalWorkOrderDtos.Response update(Long id, TechnicalWorkOrderDtos.UpdateRequest request, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("TECHNICAL_UPDATE|" + id + "|" + request);
        return executeIdempotent("technical-work-order-update", key, boundActor, fingerprint, () -> updateOnce(id, request, boundActor));
    }
    private TechnicalWorkOrderDtos.Response updateOnce(Long id, TechnicalWorkOrderDtos.UpdateRequest request, String actor) {
        TechnicalWorkOrder order = orders.findForUpdateById(id).orElseThrow(() -> new DomainException("TECHNICAL_WORK_ORDER_NOT_FOUND", "Không tìm thấy work order"));
        requireAssigneeScope(order, actor);
        if (order.getStatus() == TechnicalWorkOrderStatus.COMPLETED
                || order.getStatus() == TechnicalWorkOrderStatus.ROOM_RELEASED)
            throw new DomainException("TECHNICAL_WORK_ORDER_CLOSED", "Work order đã nghiệm thu hoặc release không thể sửa bằng PATCH");
        TechnicalWorkOrderStatus next;
        try { next = TechnicalWorkOrderStatus.valueOf(request.status().trim().toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new DomainException("INVALID_TECHNICAL_STATUS", "Trạng thái work order không hợp lệ"); }
        if (!order.getStatus().canTransitionTo(next)) throw new DomainException("INVALID_TECHNICAL_TRANSITION", "Chuyển trạng thái work order không hợp lệ");
        if (next == TechnicalWorkOrderStatus.COMPLETED || next == TechnicalWorkOrderStatus.ROOM_RELEASED)
            throw new DomainException("TECHNICAL_ACCEPTANCE_COMMAND_REQUIRED", "Nghiệm thu và release phải dùng command riêng");
        if (request.assignee() != null && !request.assignee().trim().equals(order.getAssignee())) {
            if (!hasManagementRole())
                throw new DomainException("TECHNICAL_ASSIGNMENT_FORBIDDEN", "Chỉ Manager mới được đổi người phụ trách work order");
            if (request.assignee().isBlank())
                throw new DomainException("TECHNICAL_ASSIGNEE_REQUIRED", "Work order phải có nhân viên kỹ thuật được phân công");
            order.setAssignee(request.assignee().trim());
        }
        if (request.materials() != null) order.setMaterials(request.materials());
        if (request.resultNote() != null) order.setResultNote(request.resultNote());
        String resultNote = request.resultNote() == null ? order.getResultNote() : request.resultNote();
        if (next == TechnicalWorkOrderStatus.WAITING_ACCEPTANCE
                && (resultNote == null || resultNote.isBlank()))
            throw new DomainException("TECHNICAL_RESULT_REQUIRED", "Phải ghi kết quả sửa trước khi chờ nghiệm thu");
        var before = order.getStatus(); order.setStatus(next); order.setUpdatedAt(LocalDateTime.now(clock));
        audit.record(actor, "TECHNICAL_WORK_ORDER_STATUS_CHANGED", "TECHNICAL_WORK_ORDER", id.toString(), before.name(), next.name(), null);
        return toResponse(order);
    }
    @Transactional
    public TechnicalWorkOrderDtos.Response accept(Long id, TechnicalWorkOrderDtos.AcceptanceRequest request, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("TECHNICAL_ACCEPT|" + id + "|" + request);
        return executeIdempotent("technical-work-order-accept", key, boundActor, fingerprint, () -> acceptOnce(id, request, boundActor));
    }
    private TechnicalWorkOrderDtos.Response acceptOnce(Long id, TechnicalWorkOrderDtos.AcceptanceRequest request, String actor) {
        TechnicalWorkOrder order = orders.findForUpdateById(id).orElseThrow(() -> new DomainException("TECHNICAL_WORK_ORDER_NOT_FOUND", "Không tìm thấy work order"));
        if (!hasManagementRole())
            throw new DomainException("TECHNICAL_ACCEPTANCE_FORBIDDEN", "Chỉ Manager, Director hoặc Admin được nghiệm thu");
        if (actor.equals(order.getCreatedBy()) || actor.equals(order.getAssignee()))
            throw new DomainException("TECHNICAL_SELF_ACCEPTANCE_FORBIDDEN", "Người tạo hoặc người được giao không được tự nghiệm thu");
        if (order.getStatus() != TechnicalWorkOrderStatus.WAITING_ACCEPTANCE)
            throw new DomainException("INVALID_TECHNICAL_TRANSITION", "Chỉ work order chờ nghiệm thu mới được duyệt");
        if (request == null || request.acceptanceNote() == null || request.acceptanceNote().isBlank())
            throw new DomainException("TECHNICAL_ACCEPTANCE_NOTE_REQUIRED", "Phải ghi nhận xét nghiệm thu");
        order.setAcceptanceNote(request.acceptanceNote().trim());
        order.setAcceptedBy(actor);
        order.setAcceptedAt(LocalDateTime.now(clock));
        order.setUpdatedAt(LocalDateTime.now(clock));
        order.setStatus(TechnicalWorkOrderStatus.COMPLETED);
        audit.record(actor, "TECHNICAL_WORK_ORDER_ACCEPTED", "TECHNICAL_WORK_ORDER", id.toString(),
                TechnicalWorkOrderStatus.WAITING_ACCEPTANCE.name(), TechnicalWorkOrderStatus.COMPLETED.name(), request.acceptanceNote());
        return toResponse(order);
    }
    @Transactional
    public TechnicalWorkOrderDtos.Response release(Long id, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("TECHNICAL_RELEASE|" + id);
        return executeIdempotent("technical-work-order-release", key, boundActor, fingerprint, () -> releaseOnce(id, boundActor));
    }
    private TechnicalWorkOrderDtos.Response releaseOnce(Long id, String actor) {
        TechnicalWorkOrder order = orders.findForUpdateById(id).orElseThrow(() -> new DomainException("TECHNICAL_WORK_ORDER_NOT_FOUND", "Không tìm thấy work order"));
        requireTechnicalReleaseScope(order, actor);
        if (order.getStatus() != TechnicalWorkOrderStatus.COMPLETED || order.getAcceptedBy() == null)
            throw new DomainException("TECHNICAL_ACCEPTANCE_REQUIRED", "Work order chưa được Manager nghiệm thu");
        var room = rooms.findForUpdate(order.getRoom().getId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
        if (orders.existsByRoomIdAndStatusInAndIdNot(room.getId(),
                List.of(TechnicalWorkOrderStatus.NEW, TechnicalWorkOrderStatus.ACKNOWLEDGED,
                        TechnicalWorkOrderStatus.IN_PROGRESS, TechnicalWorkOrderStatus.WAITING_ACCEPTANCE,
                        TechnicalWorkOrderStatus.COMPLETED), order.getId()))
            throw new DomainException("TECHNICAL_WORK_ORDER_NOT_READY", "Phòng còn work order kỹ thuật chưa hoàn tất");
        if (room.getStatus() == RoomStatus.OCCUPIED) throw new DomainException("ROOM_OCCUPIED", "Không thể release phòng đang có khách");
        LocalDateTime now = LocalDateTime.now(clock);
        if (overlaps.hasOverlap(room.getId(), now, now.plusNanos(1)))
            throw new DomainException("ROOM_NOT_AVAILABLE", "Phòng đang có booking hoặc lưu trú hoạt động");
        var housekeeping = housekeepingTasks.findFirstByRoomIdOrderByUpdatedAtDesc(room.getId())
                .orElseThrow(() -> new DomainException("HOUSEKEEPING_NOT_READY", "Phòng chưa có xác nhận housekeeping readiness"));
        boolean unresolvedIncident = incidents.existsByRoomIdAndSeverityInAndHandoffStatusNot(room.getId(),
                List.of(com.hospitality.mis.entity.operations.IncidentSeverity.HIGH,
                        com.hospitality.mis.entity.operations.IncidentSeverity.CRITICAL),
                com.hospitality.mis.entity.operations.IncidentHandoffStatus.RESOLVED);
        boolean housekeepingStateReady = housekeeping.getStatus() == com.hospitality.mis.entity.operations.HousekeepingTaskStatus.CLEANED
                || housekeeping.getStatus() == com.hospitality.mis.entity.operations.HousekeepingTaskStatus.WAITING_TECHNICAL
                || housekeeping.getStatus() == com.hospitality.mis.entity.operations.HousekeepingTaskStatus.READY;
        if (!housekeepingStateReady || !housekeeping.isChecklistComplete() || housekeeping.isBlockingIncident() || unresolvedIncident)
            throw new DomainException("HOUSEKEEPING_NOT_READY", "Checklist housekeeping chưa hoàn tất hoặc còn incident blocking");
        order.setStatus(TechnicalWorkOrderStatus.ROOM_RELEASED); order.setUpdatedAt(now); room.setStatus(RoomStatus.READY);
        audit.record(actor, "TECHNICAL_ROOM_RELEASED", "TECHNICAL_WORK_ORDER", id.toString(), "COMPLETED", "ROOM_RELEASED", null);
        return toResponse(order);
    }

    private TechnicalWorkOrderDtos.Response executeIdempotent(String scope, String key, String actor, String fingerprint,
                                                               java.util.function.Supplier<TechnicalWorkOrderDtos.Response> command) {
        return durableIdempotency.execute(scope, key, actor, fingerprint, TechnicalWorkOrderDtos.Response.class, command);
    }
    @Transactional(readOnly = true)
    public List<TechnicalWorkOrderDtos.Response> list(String roomId, TechnicalWorkOrderStatus status) {
        return list(roomId, status, SecurityActor.currentActor());
    }

    @Transactional(readOnly = true)
    public List<TechnicalWorkOrderDtos.Response> list(String roomId, TechnicalWorkOrderStatus status, String suppliedActor) {
        String actor = authenticatedActor(suppliedActor);
        List<TechnicalWorkOrder> data = roomId != null ? orders.findByRoomIdOrderByUpdatedAtDesc(roomId)
                : status != null ? orders.findByStatusOrderByUpdatedAtDesc(status) : orders.findAll();
        return data.stream().filter(x -> status == null || x.getStatus() == status)
                .filter(x -> hasManagementRole() || actor.equals(x.getAssignee())).map(this::toResponse).toList();
    }
    private String normalizePriority(String value) {
        String p = value.trim().toUpperCase();
        if (!List.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(p)) throw new DomainException("INVALID_TECHNICAL_PRIORITY", "Priority không hợp lệ");
        return p;
    }
    private TechnicalWorkOrderDtos.Response toResponse(TechnicalWorkOrder x) {
        return new TechnicalWorkOrderDtos.Response(x.getId(), x.getRoom().getId(), x.getEquipment() == null ? null : x.getEquipment().getId(),
                x.getAssignee(), x.getPriority(), x.getSlaDueAt(), x.getMaterials(), x.getResultNote(), x.getAcceptanceNote(),
                x.getAcceptedBy(), x.getAcceptedAt(), x.getStatus().name(), x.getCreatedBy(), x.getCreatedAt(), x.getUpdatedAt());
    }
    private void requireAssigneeScope(TechnicalWorkOrder order, String actor) {
        if (order.getAssignee() != null && (actor.equals(order.getAssignee()) || hasManagementRole())) return;
        throw new DomainException("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN", "Chỉ kỹ thuật viên được phân công mới được cập nhật work order");
    }

    private void requireTechnicalReleaseScope(TechnicalWorkOrder order, String actor) {
        if (!hasTechnicalRole() || order.getAssignee() == null || !actor.equals(order.getAssignee()))
            throw new DomainException("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN",
                    "Chỉ kỹ thuật viên được phân công mới được release phòng");
    }

    private boolean hasTechnicalRole() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_TECHNICAL"));
    }
    private boolean hasManagementRole() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a ->
            a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_DIRECTOR") || a.getAuthority().equals("ROLE_MANAGER"));
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
