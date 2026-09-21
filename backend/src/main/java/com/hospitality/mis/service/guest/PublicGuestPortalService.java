package com.hospitality.mis.service.guest;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.room.ReservationOverlapPort;
import com.hospitality.mis.dao.room.RoomStore;
import com.hospitality.mis.dao.room.AmenityRepository;
import com.hospitality.mis.dao.room.RoomImageRepository;
import com.hospitality.mis.dto.guest.PublicGuestDtos;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomAvailabilityPolicy;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/** Read model public cho khách; chỉ truy vấn dữ liệu đã được allow-list. */
@Service
public class PublicGuestPortalService {
    private final RoomStore rooms;
    private final ReservationOverlapPort overlaps;
    private final ServiceRepository services;
    private final RoomImageRepository images;
    private final AmenityRepository amenities;
    private final RoomAvailabilityPolicy availabilityPolicy = new RoomAvailabilityPolicy();

    public PublicGuestPortalService(RoomStore rooms, ReservationOverlapPort overlaps, ServiceRepository services,
                                    RoomImageRepository images, AmenityRepository amenities) {
        this.rooms = rooms;
        this.overlaps = overlaps;
        this.services = services;
        this.images = images;
        this.amenities = amenities;
    }

    /** Danh sách phòng công khai, lọc theo mã loại phòng nếu có. */
    @Transactional(readOnly = true)
    public List<PublicGuestDtos.RoomSummary> rooms(String type) {
        return publicRooms(type).stream().map(this::toSummary).toList();
    }

    /** Chi tiết phòng công khai hoặc lỗi ổn định nếu mã phòng không tồn tại. */
    @Transactional(readOnly = true)
    public PublicGuestDtos.RoomDetail room(String id) {
        Room room = rooms.findById(id)
                .orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));
        RoomType type = room.getRoomType();
        if (!isPublicCatalog(room)) throw new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng");
        return new PublicGuestDtos.RoomDetail(
                room.getId(), room.getName(), type.getId(), type.getRoomTypeCode(), type.getName(), type.getMarketingName(), type.getDescription(), type.getMarketingTagline(), type.getMarketingDescription(), room.getDescription(),
                type.getDailyPrice(), type.getHourlyPrice(), type.getArea(), type.getView(), type.getBedType(),
                room.getFloor(), room.getDescription(), publicStatus(room.getStatus()),
                imageUrls(room, type), amenityNames(type), type.getMaxOccupancy());
    }

    /** Kiểm tra khả dụng theo khoảng khách chọn mà không lộ booking nào đang chiếm phòng. */
    @Transactional(readOnly = true)
    public List<PublicGuestDtos.RoomAvailability> availability(LocalDateTime from, LocalDateTime to, String type) {
        try {
            availabilityPolicy.validateInterval(from, to);
        } catch (IllegalArgumentException exception) {
            throw new DomainException("INVALID_INTERVAL", "Thời gian nhận phải trước thời gian trả");
        }
        return publicRooms(type).stream().map(room -> {
            RoomType roomType = room.getRoomType();
            boolean overlap = overlaps.hasOverlap(room.getId(), from, to);
            boolean available = availabilityPolicy.isAvailable(room, overlap);
                return new PublicGuestDtos.RoomAvailability(
                    room.getId(), room.getName(), roomType.getId(), roomType.getRoomTypeCode(), roomType.getName(), roomType.getMarketingName(), roomType.getDescription(), roomType.getMarketingTagline(), roomType.getMarketingDescription(), room.getDescription(),
                    roomType.getDailyPrice(), roomType.getHourlyPrice(), roomType.getArea(), roomType.getView(),
                    roomType.getBedType(), room.getFloor(), publicStatus(room.getStatus()), available,
                    coverImageUrl(room, roomType), amenityNames(roomType), roomType.getMaxOccupancy());
        }).toList();
    }

    /** Chỉ public các dịch vụ active; không để lộ tồn kho hoặc ngưỡng nội bộ. */
    @Transactional(readOnly = true)
    public List<PublicGuestDtos.ServiceSummary> services() {
        return services.findByActiveTrueOrderByNameAsc().stream()
                .map(service -> new PublicGuestDtos.ServiceSummary(
                        service.getId(), service.getName(), service.getPrice(), service.getUnit(),
                        service.getCategory(), service.getDescription(), service.getImageUrl()))
                .toList();
    }

    private PublicGuestDtos.RoomSummary toSummary(Room room) {
        RoomType type = room.getRoomType();
        return new PublicGuestDtos.RoomSummary(room.getId(), room.getName(), type.getId(), type.getRoomTypeCode(), type.getName(), type.getMarketingName(), type.getDescription(), type.getMarketingTagline(), type.getMarketingDescription(), room.getDescription(),
                type.getDailyPrice(), type.getHourlyPrice(), type.getArea(), type.getView(), type.getBedType(),
                room.getFloor(), publicStatus(room.getStatus()), coverImageUrl(room, type), amenityNames(type), type.getMaxOccupancy());
    }

    private List<String> imageUrls(Room room, RoomType type) {
        List<String> roomImages = images.findByRoomIdAndActiveTrueOrderByDisplayOrderAscIdAsc(room.getId()).stream()
                .map(image -> image.getRelativePath().startsWith("http://") || image.getRelativePath().startsWith("https://")
                        ? image.getRelativePath() : "/media/rooms/" + image.getRelativePath()).toList();
        if (!roomImages.isEmpty()) return roomImages;
        List<String> gallery = type.getGalleryImageUrls() == null ? List.of() : java.util.Arrays.stream(type.getGalleryImageUrls().split("\\R"))
                .map(String::trim).filter(value -> !value.isBlank()).toList();
        if (!gallery.isEmpty()) return gallery;
        return type.getCoverImageUrl() != null ? List.of(type.getCoverImageUrl()) : List.of();
    }

    private String coverImageUrl(Room room, RoomType type) {
        return imageUrls(room, type).stream().findFirst().orElse(null);
    }

    private List<String> amenityNames(RoomType type) {
        return amenities.findActiveByRoomTypeId(type.getId()).stream()
                .map(com.hospitality.mis.entity.room.Amenity::getName).toList();
    }

    /** Giữ thứ tự danh mục theo khóa loại phòng trong database, không phụ thuộc tên hardcode ở frontend. */
    private List<Room> publicRooms(String type) {
        return rooms.search(type, null).stream()
                .filter(this::isPublicCatalog)
                .sorted(Comparator.comparing((Room room) -> room.getRoomType().getId())
                        .thenComparing(Room::getId))
                .toList();
    }

    private boolean isPublicCatalog(Room room) {
        return room.getRoomType() != null && room.getRoomType().getCatalogStatus() == RoomTypeCatalogStatus.ACTIVE;
    }

    /** Trạng thái nội bộ không thuộc public contract được ánh xạ fail-closed. */
    private PublicGuestDtos.PublicRoomStatus publicStatus(RoomStatus status) {
        if (status == null) return PublicGuestDtos.PublicRoomStatus.OUT_OF_SERVICE;
        return switch (status) {
            case READY -> PublicGuestDtos.PublicRoomStatus.READY;
            case RESERVED -> PublicGuestDtos.PublicRoomStatus.RESERVED;
            case OCCUPIED -> PublicGuestDtos.PublicRoomStatus.OCCUPIED;
            case CLEANING -> PublicGuestDtos.PublicRoomStatus.CLEANING;
            case MAINTENANCE -> PublicGuestDtos.PublicRoomStatus.MAINTENANCE;
            case OUT_OF_SERVICE -> PublicGuestDtos.PublicRoomStatus.OUT_OF_SERVICE;
            case RETURNED, CANCELLED -> PublicGuestDtos.PublicRoomStatus.OUT_OF_SERVICE;
        };
    }
}
