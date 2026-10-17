package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.CatalogProposalDtos;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.CatalogProposalService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/services/catalog-proposals")
@PreAuthorize("hasRole('KITCHEN') and @departmentAccess.allows(authentication, 'SERVICE_PRICE_REQUEST')")
public class CatalogProposalController {
    private final CatalogProposalService service;
    public CatalogProposalController(CatalogProposalService service){this.service=service;}
    @PostMapping public ApprovalDtos.Response submit(@Valid @RequestBody CatalogProposalDtos.Request request,@RequestHeader("Idempotency-Key") String key){return service.submit(request,SecurityActor.currentActor(),key);}
    @GetMapping public List<ApprovalDtos.Response> mine(){return service.mine(SecurityActor.currentActor());}
}
