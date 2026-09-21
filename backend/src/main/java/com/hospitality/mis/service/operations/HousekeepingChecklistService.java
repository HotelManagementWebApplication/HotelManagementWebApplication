package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingChecklistResultRepository;
import com.hospitality.mis.dao.operations.HousekeepingChecklistTemplateRepository;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.entity.operations.HousekeepingChecklistResult;
import com.hospitality.mis.entity.operations.HousekeepingChecklistTemplate;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;

@Service
public class HousekeepingChecklistService {
    private final HousekeepingChecklistTemplateRepository templates;
    private final HousekeepingChecklistResultRepository results;
    private final HousekeepingTaskRepository tasks;
    private final AuditService audit;
    private final Clock clock;

    public HousekeepingChecklistService(HousekeepingChecklistTemplateRepository templates,
                                        HousekeepingChecklistResultRepository results,
                                        HousekeepingTaskRepository tasks, AuditService audit, Clock clock) {
        this.templates = templates;
        this.results = results;
        this.tasks = tasks;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<HousekeepingChecklistDtos.TemplateResponse> templates() {
        return templates.findByActiveTrueOrderByNameAsc().stream()
                .map(x -> new HousekeepingChecklistDtos.TemplateResponse(x.getId(), x.getName(), x.isActive())).toList();
    }

    @Transactional
    public HousekeepingChecklistDtos.TemplateResponse createTemplate(HousekeepingChecklistDtos.TemplateRequest request,
                                                                      String actor) {
        String boundActor = authenticatedActor(actor);
        if (request == null || request.name() == null || request.name().isBlank())
            throw new DomainException("HOUSEKEEPING_CHECKLIST_TEMPLATE_REQUIRED", "Tên checklist template là bắt buộc");
        var template = new HousekeepingChecklistTemplate();
        template.setName(request.name().trim());
        templates.save(template);
        audit.record(boundActor, "HOUSEKEEPING_CHECKLIST_TEMPLATE_CREATED", "HOUSEKEEPING_CHECKLIST_TEMPLATE",
                "new", null, template.getName(), null);
        return new HousekeepingChecklistDtos.TemplateResponse(template.getId(), template.getName(), template.isActive());
    }

    @Transactional
    public HousekeepingChecklistDtos.ResultResponse addResult(Long taskId,
                                                               HousekeepingChecklistDtos.ResultRequest request,
                                                               String actor) {
        String boundActor = authenticatedActor(actor);
        var task = tasks.findForUpdateById(taskId).orElseThrow(() ->
                new DomainException("HOUSEKEEPING_TASK_NOT_FOUND", "Không tìm thấy task dọn phòng"));
        requireTaskAccess(task, boundActor);
        if (task.getStatus() == com.hospitality.mis.entity.operations.HousekeepingTaskStatus.READY)
            throw new DomainException("HOUSEKEEPING_TASK_CLOSED", "Không thể thay đổi checklist của task đã READY");
        if (request == null || request.item() == null || request.item().isBlank() || request.passed() == null)
            throw new DomainException("INVALID_REQUEST", "Checklist result không hợp lệ");
        String item = request.item().trim();
        var activeTemplates = templates.findByActiveTrueOrderByNameAsc();
        if (activeTemplates.stream().noneMatch(template -> template.getName().equals(item)))
            throw new DomainException("HOUSEKEEPING_CHECKLIST_ITEM_NOT_ACTIVE",
                    "Checklist item không tồn tại hoặc đã ngừng dùng");

        var result = new HousekeepingChecklistResult();
        result.setTask(task);
        result.setItem(item);
        result.setPassed(request.passed());
        result.setNote(request.note());
        result.setCompletedBy(boundActor);
        result.setCompletedAt(LocalDateTime.now(clock));
        results.save(result);

        var latest = new HashMap<String, Boolean>();
        results.findByTaskIdOrderByIdAsc(taskId)
                .forEach(existing -> latest.put(existing.getItem(), existing.isPassed()));
        latest.put(item, result.isPassed());
        task.setChecklistComplete(activeTemplates.stream()
                .allMatch(template -> Boolean.TRUE.equals(latest.get(template.getName()))));
        task.setUpdatedAt(LocalDateTime.now(clock));

        audit.record(boundActor, "HOUSEKEEPING_CHECKLIST_RESULT_RECORDED", "HOUSEKEEPING_TASK",
                taskId.toString(), null, item, null);
        return toResponse(result);
    }

    @Transactional(readOnly = true)
    public List<HousekeepingChecklistDtos.ResultResponse> results(Long taskId) {
        return results(taskId, SecurityActor.currentActor());
    }

    @Transactional(readOnly = true)
    public List<HousekeepingChecklistDtos.ResultResponse> results(Long taskId, String actor) {
        String boundActor = authenticatedActor(actor);
        var task = tasks.findById(taskId).orElseThrow(() ->
                new DomainException("HOUSEKEEPING_TASK_NOT_FOUND", "Không tìm thấy task dọn phòng"));
        requireTaskAccess(task, boundActor);
        return results.findByTaskIdOrderByIdAsc(taskId).stream().map(this::toResponse).toList();
    }

    private void requireTaskAccess(com.hospitality.mis.entity.operations.HousekeepingTask task, String actor) {
        if (hasManagementRole() || actor.equals(task.getAssignee())) return;
        throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN",
                "Chỉ người được phân công hoặc quản lý mới được truy cập task");
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

    private HousekeepingChecklistDtos.ResultResponse toResponse(HousekeepingChecklistResult result) {
        return new HousekeepingChecklistDtos.ResultResponse(result.getId(), result.getTask().getId(), result.getItem(),
                result.isPassed(), result.getNote(), result.getCompletedBy(), result.getCompletedAt());
    }
}
