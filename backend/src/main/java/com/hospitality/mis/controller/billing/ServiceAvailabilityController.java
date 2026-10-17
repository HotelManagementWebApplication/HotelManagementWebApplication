package com.hospitality.mis.controller.billing;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos.*;
import com.hospitality.mis.service.billing.ServiceAvailabilityService;
import jakarta.validation.Valid;import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;import java.time.LocalDateTime;import java.util.List;
@RestController public class ServiceAvailabilityController {
 private final ServiceAvailabilityService service;
 public ServiceAvailabilityController(ServiceAvailabilityService service){this.service=service;}
 @GetMapping("/api/services/availability")
 @PreAuthorize("hasRole('CUSTOMER') or @departmentAccess.allows(authentication, 'SERVICE_READ')")
 public List<Response> list(@RequestParam(required=false) LocalDateTime from,@RequestParam(required=false) LocalDateTime to){return service.list(from,to);}
 @PutMapping("/api/services/{id}/capacity") @PreAuthorize("hasRole('KITCHEN')")
 public void configure(@PathVariable String id,@Valid @RequestBody CapacityRequest request){service.configure(id,request);}
}
