package com.hospitality.mis.dto.guest;

import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.math.BigDecimal;
import java.util.List;

/** DTO allow-list cho public portal; không dùng response nội bộ của nhân viên. */
public final class PublicGuestDtos {
    private PublicGuestDtos() {}

    /** Sáu trạng thái được phép công khai trên room board. */
    public enum PublicRoomStatus {
        READY("available"),
        RESERVED("reserved"),
        OCCUPIED("occupied"),
        CLEANING("cleaning"),
        MAINTENANCE("maintenance"),
        OUT_OF_SERVICE("out_of_service");

        private final String canonicalValue;

        PublicRoomStatus(String canonicalValue) {
            this.canonicalValue = canonicalValue;
        }

        @JsonValue
        public String canonicalValue() {
            return canonicalValue;
        }
    }

    /** Thông tin tối thiểu cho danh sách phòng công khai. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomSummary(
            String roomId,
            String roomName,
            String roomTypeId,
            String roomTypeCode,
            String roomTypeName,
            String marketingName,
            String roomTypeDescription,
            String marketingTagline,
            String marketingDescription,
            String roomDescription,
            BigDecimal dailyPrice,
            BigDecimal hourlyPrice,
            BigDecimal area,
            String view,
            String bedType,
            Integer floor,
            PublicRoomStatus status,
            String imageUrl,
            List<String> amenities,
            Integer maxOccupancy) {}

    /** Chi tiết phòng công khai, không chứa dữ liệu đặt phòng hoặc người lưu trú. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomDetail(
            String roomId,
            String roomName,
            String roomTypeId,
            String roomTypeCode,
            String roomTypeName,
            String marketingName,
            String roomTypeDescription,
            String marketingTagline,
            String marketingDescription,
            String roomDescription,
            BigDecimal dailyPrice,
            BigDecimal hourlyPrice,
            BigDecimal area,
            String view,
            String bedType,
            Integer floor,
            String description,
            PublicRoomStatus status,
            List<String> imageUrls,
            List<String> amenities,
            Integer maxOccupancy) {}

    /** Kết quả khả dụng theo khoảng thời gian khách đang tìm. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomAvailability(
            String roomId,
            String roomName,
            String roomTypeId,
            String roomTypeCode,
            String roomTypeName,
            String marketingName,
            String roomTypeDescription,
            String marketingTagline,
            String marketingDescription,
            String roomDescription,
            BigDecimal dailyPrice,
            BigDecimal hourlyPrice,
            BigDecimal area,
            String view,
            String bedType,
            Integer floor,
            PublicRoomStatus currentStatus,
            boolean available,
            String imageUrl,
            List<String> amenities,
            Integer maxOccupancy) {}

    /** Danh mục dịch vụ đang hoạt động; không trả stock, threshold hoặc giá vốn. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ServiceSummary(
            String serviceId,
            String name,
            BigDecimal price,
            String unit,
            String category,
            String description,
            String imageUrl) {}
}
