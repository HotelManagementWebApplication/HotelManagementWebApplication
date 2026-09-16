package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.AmenityRepository;
import com.hospitality.mis.dao.room.RoomImageRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.room.RoomMediaDtos;
import com.hospitality.mis.entity.room.Amenity;
import com.hospitality.mis.entity.room.RoomImage;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Quản lý metadata ảnh/tiện nghi và giữ file storage tách khỏi persistence. */
@Service
public class RoomMediaService {
    private final RoomRepository rooms;
    private final RoomImageRepository images;
    private final AmenityRepository amenities;
    private final RoomTypeRepository roomTypes;
    private final RoomImageStorage storage;
    private final AuditService audit;

    public RoomMediaService(RoomRepository rooms, RoomImageRepository images, AmenityRepository amenities,
                            RoomTypeRepository roomTypes, RoomImageStorage storage, AuditService audit) {
        this.rooms = rooms;
        this.images = images;
        this.amenities = amenities;
        this.roomTypes = roomTypes;
        this.storage = storage;
        this.audit = audit;
    }

    @Transactional
    public RoomMediaDtos.ImageResponse upload(String roomId, MultipartFile file, String actor) {
        var room = rooms.findByIdWithRoomType(roomId)
                .orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng: " + roomId));
        if (images.countByRoomIdAndActiveTrue(roomId) >= 10)
            throw new DomainException("ROOM_IMAGE_LIMIT", "Mỗi phòng chỉ được tối đa 10 ảnh");
        RoomImageStorage.StoredImage stored = storage.store(roomId, file);
        try {
            RoomImage image = new RoomImage();
            image.setRoom(room);
            image.setRelativePath(stored.relativePath());
            image.setDisplayOrder((int) images.countByRoomIdAndActiveTrue(roomId));
            image.setCover(image.getDisplayOrder() == 0);
            image.setContentType(stored.contentType());
            image.setSizeBytes(stored.sizeBytes());
            RoomImage saved = images.saveAndFlush(image);
            audit.record(actor, "ROOM_IMAGE_UPLOADED", "ROOM_IMAGE", saved.getId().toString(), null,
                    stored.relativePath(), null);
            return toResponse(saved);
        } catch (RuntimeException failure) {
            storage.delete(stored.relativePath());
            throw failure;
        }
    }

    @Transactional
    public void delete(String roomId, Long imageId, String actor) {
        RoomImage image = images.findByIdAndRoomId(imageId, roomId)
                .orElseThrow(() -> new DomainException("ROOM_IMAGE_NOT_FOUND", "Không tìm thấy ảnh của phòng"));
        image.setActive(false);
        audit.record(actor, "ROOM_IMAGE_DELETED", "ROOM_IMAGE", imageId.toString(), image.getRelativePath(), null, null);
        String relativePath = image.getRelativePath();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { storage.delete(relativePath); }
        });
    }

    @Transactional(readOnly = true)
    public RoomMediaDtos.RoomMediaResponse get(String roomId) {
        if (!rooms.existsById(roomId)) throw new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng: " + roomId);
        return new RoomMediaDtos.RoomMediaResponse(roomId,
                images.findByRoomIdAndActiveTrueOrderByDisplayOrderAscIdAsc(roomId).stream().map(this::toResponse).toList(),
                rooms.findByIdWithRoomType(roomId).map(room -> amenities.findActiveByRoomTypeId(room.getRoomType().getId())
                        .stream().map(Amenity::getName).toList()).orElse(List.of()));
    }

    @Transactional
    public RoomMediaDtos.AmenityResponse createAmenity(RoomMediaDtos.CreateAmenityRequest request, String actor) {
        if (request == null || request.name() == null || request.name().isBlank())
            throw new DomainException("AMENITY_NAME_REQUIRED", "Tên tiện nghi là bắt buộc");
        Amenity amenity = new Amenity();
        amenity.setName(request.name().trim());
        try {
            Amenity saved = amenities.saveAndFlush(amenity);
            audit.record(actor, "AMENITY_CREATED", "AMENITY", saved.getId().toString(), null, saved.getName(), null);
            return new RoomMediaDtos.AmenityResponse(saved.getId(), saved.getName(), saved.isActive());
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            throw new DomainException("AMENITY_ALREADY_EXISTS", "Tiện nghi đã tồn tại");
        }
    }

    @Transactional(readOnly = true)
    public List<RoomMediaDtos.AmenityResponse> listAmenities() {
        return amenities.findAllByOrderByNameAscIdAsc().stream()
                .map(a -> new RoomMediaDtos.AmenityResponse(a.getId(), a.getName(), a.isActive())).toList();
    }

    @Transactional
    public RoomMediaDtos.AmenityResponse updateAmenity(Long id, RoomMediaDtos.UpdateAmenityRequest request, String actor) {
        Amenity amenity = amenities.findById(id)
                .orElseThrow(() -> new DomainException("AMENITY_NOT_FOUND", "Không tìm thấy tiện nghi"));
        if (request == null || request.name() == null || request.name().isBlank())
            throw new DomainException("AMENITY_NAME_REQUIRED", "Tên tiện nghi là bắt buộc");
        amenity.setName(request.name().trim());
        if (request.active() != null) amenity.setActive(request.active());
        Amenity saved = amenities.saveAndFlush(amenity);
        audit.record(actor, "AMENITY_UPDATED", "AMENITY", String.valueOf(id), null, saved.getName(), null);
        return new RoomMediaDtos.AmenityResponse(saved.getId(), saved.getName(), saved.isActive());
    }

    @Transactional
    public List<RoomMediaDtos.AmenityResponse> assignAmenities(String roomTypeId,
                                                                RoomMediaDtos.AssignAmenitiesRequest request,
                                                                String actor) {
        RoomType roomType = roomTypes.findById(roomTypeId)
                .orElseThrow(() -> new DomainException("ROOM_TYPE_NOT_FOUND", "Không tìm thấy loại phòng: " + roomTypeId));
        List<Long> ids = request == null || request.amenityIds() == null ? List.of() : request.amenityIds().stream().distinct().toList();
        List<Amenity> selected = ids.isEmpty() ? List.of() : amenities.findAllById(ids);
        if (selected.size() != ids.size()) throw new DomainException("AMENITY_NOT_FOUND", "Có tiện nghi không tồn tại");
        roomType.getAmenities().clear();
        selected.forEach(roomType.getAmenities()::add);
        roomTypes.saveAndFlush(roomType);
        audit.record(actor, "ROOM_TYPE_AMENITIES_REPLACED", "ROOM_TYPE", roomTypeId, null,
                ids.toString(), null);
        return selected.stream().map(a -> new RoomMediaDtos.AmenityResponse(a.getId(), a.getName(), a.isActive())).toList();
    }

    private RoomMediaDtos.ImageResponse toResponse(RoomImage image) {
        return new RoomMediaDtos.ImageResponse(image.getId(), "/media/rooms/" + image.getRelativePath(),
                image.getDisplayOrder(), image.isCover(), image.getContentType(), image.getSizeBytes());
    }
}
