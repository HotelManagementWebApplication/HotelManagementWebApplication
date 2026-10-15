package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.ServiceScheduleDtos;
import com.hospitality.mis.service.billing.ServiceScheduleService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/services/{id}/schedule")
public class ServiceScheduleController {
    private final ServiceScheduleService service;
    public ServiceScheduleController(ServiceScheduleService service) { this.service=service; }
    @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
    public ServiceScheduleDtos.Response get(@PathVariable String id) { return service.get(id); }
    @PutMapping @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','DIRECTOR','ADMIN') and @departmentAccess.allows(authentication, 'INVENTORY_WRITE')")
    public ServiceScheduleDtos.Response save(@PathVariable String id,@Valid @RequestBody ServiceScheduleDtos.Request request) { return service.save(id,request); }
}
