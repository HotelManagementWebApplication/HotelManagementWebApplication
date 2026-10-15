package com.hospitality.mis.controller.billing;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos;
import com.hospitality.mis.service.billing.ServiceAvailabilityService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
@RestController
@RequestMapping("/api/services/availability")
public class ServiceAvailabilityController {
    private final ServiceAvailabilityService service;
    public ServiceAvailabilityController(ServiceAvailabilityService service){this.service=service;}
    @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
    public List<ServiceAvailabilityDtos.Response> list(
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime to){return service.list(from,to);}
}
