package com.hospitality.mis.controller.room;

import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.room.RoomTypeCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** API quản trị loại phòng theo draft và approval exact payload. */
@RestController
@RequestMapping("/api/room-types")
public class RoomTypeCatalogController {
    private final RoomTypeCatalogService service;

    public RoomTypeCatalogController(RoomTypeCatalogService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomTypeAdminDtos.Response create(@RequestBody @Valid RoomTypeAdminDtos.Request request,
                                             @RequestHeader("Idempotency-Key") String key) {
        return service.create(request, SecurityActor.currentActor(), key);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomTypeAdminDtos.Response update(@PathVariable String id,
                                             @RequestBody @Valid RoomTypeAdminDtos.Request request,
                                             @RequestHeader("Idempotency-Key") String key) {
        return service.update(id, request, SecurityActor.currentActor(), key);
    }

    @PostMapping("/{id}/revision")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomTypeAdminDtos.Response revision(@PathVariable String id,
                                               @RequestBody @Valid RoomTypeAdminDtos.Request request,
                                               @RequestHeader("Idempotency-Key") String key) {
        return service.createRevision(id, request, SecurityActor.currentActor(), key);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_READ')")
    public RoomTypeAdminDtos.Response get(@PathVariable String id) { return service.get(id); }

    @GetMapping("/{id}/price-history")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_READ')")
    public List<RoomTypeAdminDtos.PriceHistoryResponse> priceHistory(@PathVariable String id) {
        return service.priceHistory(id);
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public ApprovalDtos.Response submit(@PathVariable String id,
                                        @RequestHeader("Idempotency-Key") String key) {
        return service.submit(id, SecurityActor.currentActor(), key);
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE') && hasAnyRole('ADMIN','DIRECTOR','MANAGER')")
    public RoomTypeAdminDtos.Response activate(@PathVariable String id,
                                               @RequestHeader("Idempotency-Key") String key) {
        return service.activate(id, SecurityActor.currentActor(), key);
    }
}
