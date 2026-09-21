package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/operations/technical/work-orders")
public class TechnicalWorkOrderController {
    private final TechnicalWorkOrderService service;
    public TechnicalWorkOrderController(TechnicalWorkOrderService service) { this.service = service; }
    @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'TECHNICAL_WORK_ORDER_READ')")
    public List<TechnicalWorkOrderDtos.Response> list(@RequestParam(name = "roomId", required = false) String roomId,
                                                     @RequestParam(name = "status", required = false) TechnicalWorkOrderStatus status) { return service.list(roomId, status, SecurityActor.currentActor()); }
    @PostMapping @PreAuthorize("@departmentAccess.allows(authentication, 'TECHNICAL_WORK_ORDER_WRITE')")
    public TechnicalWorkOrderDtos.Response create(@Valid @RequestBody TechnicalWorkOrderDtos.CreateRequest request,
                                                  @RequestHeader("Idempotency-Key") String idempotencyKey) { return service.create(request, SecurityActor.currentActor(), idempotencyKey); }
    @PatchMapping("/{id}") @PreAuthorize("@departmentAccess.allows(authentication, 'TECHNICAL_WORK_ORDER_WRITE')")
    public TechnicalWorkOrderDtos.Response update(@PathVariable Long id, @Valid @RequestBody TechnicalWorkOrderDtos.UpdateRequest request,
                                                  @RequestHeader("Idempotency-Key") String idempotencyKey) { return service.update(id, request, SecurityActor.currentActor(), idempotencyKey); }
    @PostMapping("/{id}/accept") @PreAuthorize("@departmentAccess.allows(authentication, 'TECHNICAL_WORK_ORDER_ACCEPT')")
    public TechnicalWorkOrderDtos.Response accept(@PathVariable Long id, @Valid @RequestBody TechnicalWorkOrderDtos.AcceptanceRequest request,
                                                  @RequestHeader("Idempotency-Key") String idempotencyKey) { return service.accept(id, request, SecurityActor.currentActor(), idempotencyKey); }
    @PostMapping("/{id}/release") @PreAuthorize("@departmentAccess.allows(authentication, 'TECHNICAL_WORK_ORDER_RELEASE')")
    public TechnicalWorkOrderDtos.Response release(@PathVariable Long id,
                                                   @RequestHeader("Idempotency-Key") String idempotencyKey) { return service.release(id, SecurityActor.currentActor(), idempotencyKey); }
}
