package com.hospitality.mis.dto.billing;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.*;
public final class ServiceAvailabilityDtos {
 @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
 public record Response(String serviceId,String unit,int capacity,long booked,long available,int durationMinutes,boolean resource,String resourceSourceId) {}
 public record CapacityRequest(@Min(1) int capacity,@Min(1) @Max(10080) int minutes,@NotBlank @Size(max=255) String reason) {}
}
