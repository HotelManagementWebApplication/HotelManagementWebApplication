package com.hospitality.mis.controller.governance;

import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.room.RoomTypeCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Quản lý yêu cầu phê duyệt và các quyết định chấp thuận hoặc từ chối trong quy trình quản trị.
 */
@RestController
@RequestMapping("/api/governance/approvals")
class ApprovalController {
    /** Dịch vụ tạo, truy vấn và chuyển trạng thái yêu cầu phê duyệt. */
    private final ApprovalService service;
    private final RoomTypeCatalogService roomTypes;

    ApprovalController(ApprovalService service, RoomTypeCatalogService roomTypes) {
        this.service = service;
        this.roomTypes = roomTypes;
    }


    /**
     * Tạo yêu cầu phê duyệt qua POST /api/governance/approvals.
     * Body gồm action, target, payload, amount, reason và idempotencyKey, được {@code @Valid} kiểm tra; trả 201 cùng yêu cầu.
     * Chỉ APPROVAL_REQUEST được phép; khóa idempotency nằm trong DTO để dịch vụ chống tạo trùng, còn lỗi dữ liệu/trạng thái do dịch vụ báo.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@departmentAccess.allows(authentication, 'APPROVAL_REQUEST')")
    public ApprovalDtos.Response request(@RequestBody @Valid ApprovalDtos.Request request) {
        return ApprovalDtos.Response.from(service.request(SecurityActor.currentActor(), request.action(),
                request.targetId(), request.payload(), request.amount(), request.reason(), request.idempotencyKey()));
    }


    /**
     * Phê duyệt yêu cầu qua POST /api/governance/approvals/{id}/approve; id là path parameter, không có body.
     * Chỉ APPROVAL_APPROVE và người được {@code approvalAuthorization.canApprove} cho yêu cầu đó được phép; trả trạng thái mới.
     * Không có header idempotency riêng, còn yêu cầu không tồn tại hoặc đã chuyển trạng thái tạo lỗi nghiệp vụ.
     */
    @PostMapping("/{id}/approve")

    @PreAuthorize("@departmentAccess.allows(authentication, 'APPROVAL_APPROVE') and @approvalAuthorization.canApprove(#id, authentication.name)")
    public ApprovalDtos.Response approve(@PathVariable Long id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        String actor = SecurityActor.currentActor();
        return ApprovalDtos.Response.from(key == null || key.isBlank()
                ? service.approve(id, actor) : service.approve(id, actor, key));
    }


    /**
     * Từ chối yêu cầu qua POST /api/governance/approvals/{id}/reject; id là path parameter và không có body.
     * Quyền là APPROVAL_APPROVE kết hợp kiểm tra canApprove theo yêu cầu; trả trạng thái mới, còn thao tác lặp/trạng thái sai
     * được ApprovalService xử lý thành lỗi nghiệp vụ. Không có idempotency header.
     */
    @PostMapping("/{id}/reject")

    @PreAuthorize("@departmentAccess.allows(authentication, 'APPROVAL_APPROVE') and @approvalAuthorization.canApprove(#id, authentication.name)")
    public ApprovalDtos.Response reject(@PathVariable Long id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        String actor = SecurityActor.currentActor();
        ApprovalDtos.Response response = ApprovalDtos.Response.from(key == null || key.isBlank()
                ? service.reject(id, actor) : service.reject(id, actor, key));
        if (response != null && "ROOM_TYPE_ACTIVATE".equals(response.action())) {
            roomTypes.markRejected(response.targetId(), actor);
        }
        return response;
    }


    /**
     * Lọc danh sách yêu cầu qua GET /api/governance/approvals?status=...
     * status là query parameter tùy chọn; trả danh sách response phê duyệt. Chỉ APPROVAL_APPROVE được phép.
     * Giá trị status không hợp lệ hoặc lỗi truy vấn do dịch vụ báo; thao tác đọc không cần idempotency.
     */
    @GetMapping
    @PreAuthorize("@departmentAccess.allows(authentication, 'APPROVAL_APPROVE')")
    public Object list(@RequestParam(name = "status", required = false) String status, @RequestParam(name = "action", required = false) String action,
                       @RequestParam(name = "target_id", required = false) String targetId,
                       @RequestParam(name = "requester", required = false) String requester,
                       @RequestParam(name = "from", required = false) java.time.Instant from,
                       @RequestParam(name = "to", required = false) java.time.Instant to,
                       @RequestParam(name = "risk", required = false) String risk,
                       @RequestParam(name = "page", required = false) Integer page, @RequestParam(name = "size", required = false) Integer size) {
        if (action == null && targetId == null && requester == null && from == null && to == null && risk == null && page == null && size == null)
            return service.list(status).stream().map(ApprovalDtos.Response::from).collect(Collectors.toList());
        var result = service.page(status, action, targetId, requester, risk, from, to, page == null ? 0 : page, size == null ? 20 : size);
        return new PageResponse(result.getContent().stream().map(ApprovalDtos.Response::from).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public record PageResponse(List<ApprovalDtos.Response> items, int page, int size, long totalElements, int totalPages) {}
}
