package com.hospitality.mis.controller.billing;
import com.hospitality.mis.dto.billing.ServiceConsumptionDto;
import com.hospitality.mis.service.billing.ServiceConsumptionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
@RestController
@RequestMapping("/api/services/consumption")
public class ServiceConsumptionController {
    private final ServiceConsumptionService service;
    public ServiceConsumptionController(ServiceConsumptionService service) { this.service=service; }
    @GetMapping @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','DIRECTOR','ADMIN') and @departmentAccess.allows(authentication, 'INVENTORY_READ')")
    public List<ServiceConsumptionDto> list(@RequestParam LocalDate from,@RequestParam LocalDate to) { return service.list(from,to); }
}
