package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dao.operations.HousekeepingChecklistResultRepository;
import com.hospitality.mis.dao.operations.HousekeepingChecklistTemplateRepository;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.operations.TechnicalWorkOrderRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.operations.HousekeepingTask;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;

@Service
public class HousekeepingService {
    private final HousekeepingTaskRepository tasks;
    private final RoomRepository rooms;
    private final AuditService audit;
    private final HousekeepingChecklistTemplateRepository templates;
    private final HousekeepingChecklistResultRepository results;
    private final EquipmentIncidentRepository incidents;
    private final TechnicalWorkOrderRepository workOrders;
    private final Clock clock;
    private final DurableIdempotencyService durableIdempotency;

    public HousekeepingService(HousekeepingTaskRepository tasks, RoomRepository rooms, AuditService audit,
                               HousekeepingChecklistTemplateRepository templates,
                               HousekeepingChecklistResultRepository results,
                               EquipmentIncidentRepository incidents, TechnicalWorkOrderRepository workOrders, Clock clock,
                               DurableIdempotencyService durableIdempotency) {
        this.tasks = tasks; this.rooms = rooms; this.audit = audit; this.templates = templates;
        this.results = results; this.incidents = incidents; this.workOrders = workOrders; this.clock = clock;
        this.durableIdempotency = durableIdempotency;
    }

    @Transactional
    public HousekeepingDtos.Response create(HousekeepingDtos.CreateRequest request, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        requireManagementRole();
        if (request == null || request.roomId() == null || request.roomId().isBlank()
                || request.assignee() == null || request.assignee().isBlank())
            throw new DomainException("HOUSEKEEPING_ASSIGNEE_REQUIRED", "Task phải có nhân viên housekeeping được phân công");
        String fingerprint = IdempotencySupport.fingerprint("HOUSEKEEPING_CREATE|" + request);
        return executeIdempotent("housekeeping-task-create", key, boundActor, fingerprint, () -> {
            var room = rooms.findForUpdate(request.roomId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
            if (room.getStatus() == RoomStatus.OCCUPIED)
                throw new DomainException("ROOM_OCCUPIED", "Không thể tạo task dọn phòng khi phòng đang có khách");
            boolean postRepairCleaning = room.getStatus() == RoomStatus.MAINTENANCE && hasAcceptedRepairs(request.roomId());
            if ((room.getStatus() == RoomStatus.MAINTENANCE && !postRepairCleaning)
                    || room.getStatus() == RoomStatus.OUT_OF_SERVICE)
                throw new DomainException("ROOM_MAINTENANCE_LOCKED", "Không thể tạo task dọn phòng khi phòng đang bị khóa kỹ thuật");
            var task = new HousekeepingTask(); task.setRoom(room); task.setAssignee(request.assignee().trim());
            task.setAssignedBy(boundActor); task.setNote(request.note()); task.setStatus(HousekeepingTaskStatus.NEEDS_CLEANING);
            task.setUpdatedAt(LocalDateTime.now(clock)); room.setStatus(RoomStatus.CLEANING);
            tasks.save(task); audit.record(boundActor, "HOUSEKEEPING_TASK_CREATED", "HOUSEKEEPING_TASK", "new", null, request.roomId(), null);
            return toResponse(task);
        });
    }

    @Transactional
    public HousekeepingDtos.Response update(Long id, HousekeepingDtos.UpdateRequest request, String actor, String key) {
        final String boundActor = authenticatedActor(actor);
        String fingerprint = IdempotencySupport.fingerprint("HOUSEKEEPING_UPDATE|" + id + "|" + request);
        return executeIdempotent("housekeeping-task-update", key, boundActor, fingerprint, () -> updateOnce(id, request, boundActor));
    }

    private HousekeepingDtos.Response updateOnce(Long id, HousekeepingDtos.UpdateRequest request, String actor) {
        var task = tasks.findForUpdateById(id).orElseThrow(() -> new DomainException("HOUSEKEEPING_TASK_NOT_FOUND", "Không tìm thấy task dọn phòng"));
        if (request == null || request.status() == null || request.status().isBlank())
            throw new DomainException("INVALID_HOUSEKEEPING_STATUS", "Trạng thái dọn phòng là bắt buộc");
        if (!hasManagementRole() && !actor.equals(task.getAssignee()))
            throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN", "Chỉ người được phân công mới được cập nhật task");
        HousekeepingTaskStatus next;
        try { next = HousekeepingTaskStatus.valueOf(request.status().trim().toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new DomainException("INVALID_HOUSEKEEPING_STATUS", "Trạng thái dọn phòng không hợp lệ"); }
        if (!task.getStatus().canTransitionTo(next)) throw new DomainException("INVALID_HOUSEKEEPING_TRANSITION", "Chuyển trạng thái dọn phòng không hợp lệ");
        if (request.assignee() != null && !request.assignee().trim().equals(task.getAssignee())) {
            if (!hasManagementRole())
                throw new DomainException("HOUSEKEEPING_ASSIGNMENT_FORBIDDEN", "Chỉ Manager mới được đổi người phụ trách task");
            if (request.assignee().isBlank())
                throw new DomainException("HOUSEKEEPING_ASSIGNEE_REQUIRED", "Task phải có nhân viên housekeeping được phân công");
            task.setAssignee(request.assignee().trim());
        }
        if (request.note() != null) task.setNote(request.note());
        var room = rooms.findForUpdate(task.getRoom().getId()).orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
        boolean blocking = hasBlockingIncident(room.getId());
        task.setBlockingIncident(blocking);
        if (next == HousekeepingTaskStatus.READY) {
            boolean checklistComplete = hasPassedEveryActiveChecklist(task.getId());
            task.setChecklistComplete(checklistComplete);
            if (!checklistComplete || blocking)
                throw new DomainException("HOUSEKEEPING_CHECKLIST_REQUIRED", "Phòng chỉ READY sau khi hoàn thành checklist và không còn incident blocking");
            if (room.getStatus() == RoomStatus.MAINTENANCE)
                throw new DomainException("ROOM_MAINTENANCE_LOCKED", "Phòng đang bị maintenance khóa");
        }
        var before = task.getStatus(); task.setStatus(next); task.setUpdatedAt(LocalDateTime.now(clock));
        boolean pendingTechnicalRelease = next == HousekeepingTaskStatus.READY
                && workOrders.findByRoomIdOrderByUpdatedAtDesc(room.getId()).stream()
                .anyMatch(order -> order.getStatus() == com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus.COMPLETED);
        room.setStatus(next == HousekeepingTaskStatus.READY
                ? pendingTechnicalRelease ? RoomStatus.MAINTENANCE : RoomStatus.READY
                : next == HousekeepingTaskStatus.WAITING_TECHNICAL ? RoomStatus.MAINTENANCE : RoomStatus.CLEANING);
        audit.record(actor, "HOUSEKEEPING_TASK_STATUS_CHANGED", "HOUSEKEEPING_TASK", id.toString(), before.name(), next.name(), null);
        return toResponse(task);
    }

    private boolean hasBlockingIncident(String roomId) {
        return incidents.existsByRoomIdAndSeverityInAndHandoffStatusNot(
                roomId, List.of(IncidentSeverity.HIGH, IncidentSeverity.CRITICAL), IncidentHandoffStatus.RESOLVED);
    }

    private boolean hasAcceptedRepairs(String roomId) {
        var repairs = workOrders.findByRoomIdOrderByUpdatedAtDesc(roomId);
        return !repairs.isEmpty()
                && repairs.stream().anyMatch(order -> order.getStatus() == com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus.COMPLETED)
                && repairs.stream().allMatch(order -> order.getStatus() == com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus.COMPLETED
                || order.getStatus() == com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus.ROOM_RELEASED);
    }

    private HousekeepingDtos.Response executeIdempotent(String scope, String key, String actor, String fingerprint,
                                                        java.util.function.Supplier<HousekeepingDtos.Response> command) {
        return durableIdempotency.execute(scope, key, actor, fingerprint, HousekeepingDtos.Response.class, command);
    }

    private void requireManagementRole() {
        if (!hasManagementRole())
            throw new DomainException("HOUSEKEEPING_ASSIGNMENT_FORBIDDEN", "Chỉ Manager mới được phân công task housekeeping");
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

    private boolean hasPassedEveryActiveChecklist(Long taskId) {
        var active = templates.findByActiveTrueOrderByNameAsc();
        if (active.isEmpty()) return false;
        var latest = new HashMap<String, Boolean>();
        results.findByTaskIdOrderByIdAsc(taskId).forEach(result -> latest.put(result.getItem(), result.isPassed()));
        return active.stream().allMatch(template -> Boolean.TRUE.equals(latest.get(template.getName())));
    }

    @Transactional(readOnly = true)
    public List<HousekeepingDtos.Response> list(String roomId, String assignee, HousekeepingTaskStatus status) {
        return list(roomId, assignee, status, SecurityActor.currentActor());
    }

    @Transactional(readOnly = true)
    public List<HousekeepingDtos.Response> list(String roomId, String assignee, HousekeepingTaskStatus status, String suppliedActor) {
        String actor = authenticatedActor(suppliedActor);
        if (!hasManagementRole() && assignee != null && !actor.equals(assignee))
            throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN", "Không được xem task của nhân viên khác");
        final String filterAssignee = hasManagementRole() ? assignee : actor;
        return tasks.findAll().stream()
                .filter(x -> roomId == null || roomId.equals(x.getRoom().getId()))
                .filter(x -> filterAssignee == null || filterAssignee.equals(x.getAssignee()))
                .filter(x -> status == null || x.getStatus() == status)
                .sorted(java.util.Comparator.comparing(HousekeepingTask::getUpdatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(this::toResponse).toList();
    }

    private HousekeepingDtos.Response toResponse(HousekeepingTask t) {
        return new HousekeepingDtos.Response(t.getId(), t.getRoom().getId(), t.getAssignee(), t.getStatus().name(),
                t.isChecklistComplete(), t.isBlockingIncident(), t.getNote(), t.getAssignedBy(), t.getUpdatedAt());
    }

    private boolean hasManagementRole() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_DIRECTOR") || a.getAuthority().equals("ROLE_MANAGER"));
    }
}
