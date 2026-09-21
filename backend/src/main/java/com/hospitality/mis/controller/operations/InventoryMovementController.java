package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.operations.InventoryMovementService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Tra cứu và ghi nhận các biến động tồn kho của một dịch vụ.
 */
@RestController
@RequestMapping("/api/services/{serviceId}/inventory-movements")
public class InventoryMovementController {
    /** Dịch vụ đọc và tạo biến động tồn kho, bao gồm kiểm tra liên kết serviceId trong URL và body. */
    private final InventoryMovementService service;
    public InventoryMovementController(InventoryMovementService service) { this.service = service; }
    /**
     * Liệt kê biến động tồn kho qua GET /api/services/{serviceId}/inventory-movements; serviceId là path parameter.
     * Trả danh sách biến động, chỉ INVENTORY_READ được phép; lỗi dịch vụ không tồn tại/truy vấn do service xử lý.
     * Đây là thao tác đọc, không có idempotency concern.
     */
    @GetMapping 
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_READ')")
    public List<InventoryMovementDtos.Response> list(@PathVariable String serviceId) { return service.list(serviceId); }
    @GetMapping("/inventory-report")
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_READ')")
    public InventoryMovementDtos.ReportResponse report(@PathVariable String serviceId,
            @RequestParam(name = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(name = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) { return service.report(serviceId, from, to); }
    /**
     * Ghi nhận biến động tồn kho qua POST /api/services/{serviceId}/inventory-movements.
     * serviceId là path parameter, body được {@code @Valid} kiểm tra và phải có service_id trùng path; sai khác bị từ chối
     * trước khi gọi service. Chỉ INVENTORY_WRITE được phép, actor hiện tại được ghi nhận; Idempotency-Key là bắt buộc
     * để replay cùng một movement không tạo thêm bút toán.
     */
    @PostMapping 
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_WRITE')")
    public InventoryMovementDtos.Response record(@PathVariable String serviceId,
            @Valid @RequestBody InventoryMovementDtos.CreateRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey) { if (!serviceId.equals(request.serviceId())) {
        throw new com.hospitality.mis.common.exception.DomainException("SERVICE_PATH_MISMATCH", "service_id must match the URL");
    }
    return service.record(request, SecurityActor.currentActor(), idempotencyKey); }
}
