package com.hospitality.mis.controller.governance;

import com.hospitality.mis.dto.governance.NotificationDtos;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/governance/notifications")
public class NotificationController {
    private final NotificationOutboxService service;
    public NotificationController(NotificationOutboxService service) { this.service = service; }
    @GetMapping("/outbox")
    @PreAuthorize("@departmentAccess.allows(authentication, 'NOTIFICATION_READ')")
    public List<NotificationDtos.Response> poll(@RequestParam(name = "role", required = false) String role,
                                                org.springframework.security.core.Authentication authentication) {
        java.util.Set<String> allowed = authentication.getAuthorities().stream()
                .map(a -> a.getAuthority().startsWith("ROLE_") ? a.getAuthority().substring(5) : a.getAuthority())
                .collect(java.util.stream.Collectors.toSet());
        return service.pollForRoles(allowed, role);
    }
    @PostMapping("/outbox/{id}/delivered")
    @PreAuthorize("@departmentAccess.allows(authentication, 'NOTIFICATION_WRITE')")
    public NotificationDtos.Response delivered(@PathVariable Long id) { return service.markDelivered(id); }
}
