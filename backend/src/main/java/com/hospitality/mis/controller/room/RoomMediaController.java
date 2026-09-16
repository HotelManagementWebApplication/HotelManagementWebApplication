package com.hospitality.mis.controller.room;

import com.hospitality.mis.dto.room.RoomMediaDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.room.RoomMediaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** API nội bộ cho metadata ảnh và tiện nghi; public chỉ đọc qua DTO guest riêng. */
@RestController
@RequestMapping("/api")
public class RoomMediaController {
    private final RoomMediaService service;

    public RoomMediaController(RoomMediaService service) { this.service = service; }

    @GetMapping("/rooms/{roomId}/media")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_READ')")
    public RoomMediaDtos.RoomMediaResponse get(@PathVariable String roomId) {
        return service.get(roomId);
    }

    @PostMapping(value = "/rooms/{roomId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomMediaDtos.ImageResponse upload(@PathVariable String roomId,
                                              @RequestParam("file") MultipartFile file) {
        return service.upload(roomId, file, SecurityActor.currentActor());
    }

    @DeleteMapping("/rooms/{roomId}/images/{imageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public void delete(@PathVariable String roomId, @PathVariable Long imageId) {
        service.delete(roomId, imageId, SecurityActor.currentActor());
    }

    @PostMapping("/amenities")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomMediaDtos.AmenityResponse createAmenity(@Valid @RequestBody RoomMediaDtos.CreateAmenityRequest request) {
        return service.createAmenity(request, SecurityActor.currentActor());
    }

    @GetMapping("/amenities")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public java.util.List<RoomMediaDtos.AmenityResponse> listAmenities() { return service.listAmenities(); }

    @PutMapping("/amenities/{id}")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public RoomMediaDtos.AmenityResponse updateAmenity(@PathVariable Long id,
                                                       @RequestBody RoomMediaDtos.UpdateAmenityRequest request) {
        return service.updateAmenity(id, request, SecurityActor.currentActor());
    }

    @PutMapping("/room-types/{roomTypeId}/amenities")
    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_CATALOG_WRITE')")
    public java.util.List<RoomMediaDtos.AmenityResponse> assignAmenities(
            @PathVariable String roomTypeId, @RequestBody RoomMediaDtos.AssignAmenitiesRequest request) {
        return service.assignAmenities(roomTypeId, request, SecurityActor.currentActor());
    }
}
