package com.hospitality.mis.controller.finance;

import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.service.governance.ApprovalService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/finance/refund-requests")
public class FinanceApprovalController {
    private final ApprovalService approvals;
    public FinanceApprovalController(ApprovalService approvals){this.approvals=approvals;}
    @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'FINANCE_READ')")
    public List<ApprovalDtos.Response> mine(){return approvals.requestedPaymentRefunds();}
}
