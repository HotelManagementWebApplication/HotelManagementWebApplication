package com.hospitality.mis.dto.room;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

/** DTO cho metadata ảnh và tiện nghi phòng, tách khỏi entity persistence. */
public final class RoomMediaDtos {
    private RoomMediaDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ImageResponse(Long id, String url, int displayOrder, boolean cover,
                                String contentType, long sizeBytes) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoomMediaResponse(String roomId, List<ImageResponse> images, List<String> amenities) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateAmenityRequest(String name) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateAmenityRequest(String name, Boolean active) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AmenityResponse(Long id, String name, boolean active) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AssignAmenitiesRequest(List<Long> amenityIds) {}
}
