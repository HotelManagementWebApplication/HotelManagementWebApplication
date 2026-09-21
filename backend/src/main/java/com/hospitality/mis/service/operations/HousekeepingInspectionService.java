package com.hospitality.mis.service.operations;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingInspectionRepository;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.List;
@Service
public class HousekeepingInspectionService {
    private final HousekeepingInspectionRepository inspections; private final HousekeepingTaskRepository tasks; private final AuditService audit; private final Clock clock;
    public HousekeepingInspectionService(HousekeepingInspectionRepository inspections, HousekeepingTaskRepository tasks, AuditService audit, Clock clock) { this.inspections = inspections; this.tasks = tasks; this.audit = audit; this.clock = clock; }
    @Transactional public HousekeepingInspectionDtos.Response add(Long taskId, HousekeepingInspectionDtos.Request request, String actor) {
        String boundActor = authenticatedActor(actor);
        var task = tasks.findForUpdateById(taskId).orElseThrow(() -> new DomainException("HOUSEKEEPING_TASK_NOT_FOUND", "Không tìm thấy task dọn phòng"));
        requireTaskAccess(task, boundActor);
        if (task.getStatus() == com.hospitality.mis.entity.operations.HousekeepingTaskStatus.READY)
            throw new DomainException("HOUSEKEEPING_TASK_CLOSED", "Không thể thêm inspection cho task đã READY");
        if (request == null || request.inspectionType() == null || request.item() == null || request.item().isBlank()
                || request.itemCondition() == null || request.quantity() < 0)
            throw new DomainException("INVALID_REQUEST", "Inspection không hợp lệ");
        var inspection = new HousekeepingInspection(); inspection.setTask(task); inspection.setInspectionType(request.inspectionType()); inspection.setItem(request.item().trim()); inspection.setQuantity(request.quantity()); inspection.setItemCondition(request.itemCondition()); inspection.setNote(request.note()); inspection.setCompletedBy(boundActor); inspection.setCompletedAt(LocalDateTime.now(clock));
        inspection = inspections.save(inspection); audit.record(boundActor, "HOUSEKEEPING_INSPECTION_RECORDED", "HOUSEKEEPING_TASK", taskId.toString(), null, request.inspectionType().name() + ":" + request.item().trim(), null); return HousekeepingInspectionDtos.Response.from(inspection);
    }
    @Transactional(readOnly = true) public List<HousekeepingInspectionDtos.Response> list(Long taskId) {
        return list(taskId, SecurityActor.currentActor());
    }
    @Transactional(readOnly = true) public List<HousekeepingInspectionDtos.Response> list(Long taskId, String actor) {
        String boundActor = authenticatedActor(actor);
        var task = tasks.findById(taskId).orElseThrow(() -> new DomainException("HOUSEKEEPING_TASK_NOT_FOUND", "Không tìm thấy task dọn phòng"));
        requireTaskAccess(task, boundActor);
        return inspections.findByTaskIdOrderByCompletedAtDescIdDesc(taskId).stream().map(HousekeepingInspectionDtos.Response::from).toList();
    }

    private void requireTaskAccess(com.hospitality.mis.entity.operations.HousekeepingTask task, String actor) {
        if (hasManagementRole() || actor.equals(task.getAssignee())) return;
        throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN", "Chỉ người được phân công hoặc quản lý mới được truy cập task");
    }

    private boolean hasManagementRole() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_DIRECTOR")
                        || a.getAuthority().equals("ROLE_MANAGER"));
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
