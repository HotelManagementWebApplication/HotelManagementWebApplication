package com.hospitality.mis.controller.finance;

import com.hospitality.mis.dto.finance.CommercialDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.finance.CommercialPartnerService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
public class CommercialPartnerController {
    private final CommercialPartnerService service;
    public CommercialPartnerController(CommercialPartnerService service) { this.service = service; }

    @GetMapping("/api/public/commercial-spaces")
    public java.util.List<CommercialDtos.SpaceResponse> spaces() { return service.spaces(); }

    @GetMapping("/api/finance/commercial-partners")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public java.util.List<CommercialDtos.PartnerResponse> partners() { return service.partners(); }

    @GetMapping("/api/finance/partner-settlements")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public java.util.List<CommercialDtos.SettlementResponse> settlements() { return service.settlements(); }

    @PostMapping("/api/finance/partner-settlements/{id}/export")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')")
    public CommercialDtos.SettlementResponse export(@PathVariable long id) { return service.exportSettlement(id); }

    @PostMapping("/api/finance/vouchers/{code}/scan")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_WRITE')")
    public void scan(@PathVariable String code, @Valid @RequestBody CommercialDtos.VoucherScanRequest request) {
        service.scanVoucher(code, request, SecurityActor.currentActor());
    }

    @PostMapping("/api/customer/vouchers")
    public CommercialDtos.VoucherResponse voucher(@Valid @RequestBody CommercialDtos.VoucherRequest request) {
        var principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new org.springframework.security.access.AccessDeniedException("Customer principal required");
        return service.issueVoucher(request, principal.id());
    }
}
