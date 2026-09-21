package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.EnterpriseDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.operations.EnterpriseExtensionService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** API đồng bộ các tab mở rộng với database thật. */
@RestController
public class EnterpriseExtensionController {
    private final EnterpriseExtensionService service;
    public EnterpriseExtensionController(EnterpriseExtensionService service) { this.service = service; }

    @GetMapping("/api/finance/ota-reconciliation")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public java.util.List<EnterpriseDtos.OtaReconciliationResponse> ota() { return service.ota(); }

    @PatchMapping("/api/finance/ota-reconciliation/{reservationId}")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')")
    public EnterpriseDtos.OtaReconciliationResponse otaStatus(@PathVariable long reservationId,
                                                               @Valid @RequestBody EnterpriseDtos.OtaStatusRequest request) {
        return service.updateOtaStatus(reservationId, request.status());
    }

    @GetMapping("/api/finance/vat-invoices")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public java.util.List<EnterpriseDtos.VatInvoiceResponse> vat() { return service.vatInvoices(); }

    @PostMapping("/api/finance/vat-invoices")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')")
    public EnterpriseDtos.VatInvoiceResponse createVat(@Valid @RequestBody EnterpriseDtos.VatInvoiceRequest request) {
        return service.createVat(request, SecurityActor.currentActor());
    }

    @GetMapping(value = "/api/finance/vat-invoices/{id}/xml", produces = MediaType.APPLICATION_XML_VALUE)
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public ResponseEntity<String> vatXml(@PathVariable long id) { return ResponseEntity.ok(service.exportVatXml(id)); }

    @GetMapping("/api/hr/attendance")
    @PreAuthorize("@departmentAccess.allows(authentication, 'EMPLOYEE_READ')")
    public java.util.List<EnterpriseDtos.AttendanceResponse> attendance(@RequestParam(required = false) LocalDate date) { return service.attendance(date); }

    @PostMapping("/api/hr/attendance/import")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_WRITE')")
    public java.util.List<EnterpriseDtos.AttendanceResponse> importAttendance(@Valid @RequestBody EnterpriseDtos.AttendanceImportRequest request) {
        return service.importAttendance(request, SecurityActor.currentActor());
    }

    @GetMapping("/api/hr/leave-requests")
    @PreAuthorize("@departmentAccess.allows(authentication, 'EMPLOYEE_READ')")
    public java.util.List<EnterpriseDtos.LeaveResponse> leaves(@RequestParam(required = false) String status) { return service.leaves(status); }

    @PostMapping("/api/hr/leave-requests")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_WRITE')")
    public EnterpriseDtos.LeaveResponse createLeave(@Valid @RequestBody EnterpriseDtos.LeaveRequest request) {
        return service.createLeave(request, SecurityActor.currentActor());
    }

    @PostMapping("/api/hr/leave-requests/{id}/approve")
    @PreAuthorize("hasAnyRole('MANAGER','DIRECTOR','ADMIN')")
    public EnterpriseDtos.LeaveResponse approveLeave(@PathVariable long id) { return service.decideLeave(id, true, SecurityActor.currentActor()); }

    @PostMapping("/api/hr/leave-requests/{id}/reject")
    @PreAuthorize("hasAnyRole('MANAGER','DIRECTOR','ADMIN')")
    public EnterpriseDtos.LeaveResponse rejectLeave(@PathVariable long id) { return service.decideLeave(id, false, SecurityActor.currentActor()); }

    @GetMapping("/api/operations/linen")
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_READ')")
    public java.util.List<EnterpriseDtos.StockItemResponse> linen() { return service.linen(); }

    @PostMapping("/api/operations/linen/movements")
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_WRITE')")
    public EnterpriseDtos.StockItemResponse moveLinen(@Valid @RequestBody EnterpriseDtos.StockMovementRequest request) {
        return service.moveStock(request, SecurityActor.currentActor());
    }

    @GetMapping("/api/operations/assets")
    @PreAuthorize("@departmentAccess.allows(authentication, 'EQUIPMENT_READ')")
    public java.util.List<EnterpriseDtos.TechnicalAssetResponse> assets() { return service.assets(); }

    @PostMapping("/api/operations/assets")
    @PreAuthorize("@departmentAccess.allows(authentication, 'EQUIPMENT_WRITE')")
    public EnterpriseDtos.TechnicalAssetResponse createAsset(@Valid @RequestBody EnterpriseDtos.TechnicalAssetRequest request) { return service.createAsset(request); }

    @PatchMapping("/api/operations/assets/{id}/status")
    @PreAuthorize("@departmentAccess.allows(authentication, 'EQUIPMENT_WRITE')")
    public EnterpriseDtos.TechnicalAssetResponse updateAsset(@PathVariable String id, @Valid @RequestBody EnterpriseDtos.TechnicalAssetStatusRequest request) { return service.updateAssetStatus(id, request.status()); }
}
