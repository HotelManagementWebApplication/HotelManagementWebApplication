package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** DTO cho các contract mở rộng đã chốt: OTA, VAT, nhân sự, kho vải và tài sản. */
public final class EnterpriseDtos {
    private EnterpriseDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record OtaReconciliationResponse(Long reservationId, String guestName, String roomId,
                                            String bookingSource, BigDecimal grossRevenue,
                                            BigDecimal commission, BigDecimal netRevenue,
                                            String status, LocalDateTime bookedAt) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record OtaStatusRequest(@NotBlank String status) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record VatInvoiceResponse(Long id, Long invoiceId, String vatInvoiceNumber, BigDecimal taxRate,
                                     BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal totalAmount,
                                     String customerType, String customerName, String taxCode,
                                     String companyName, String companyAddress, String status,
                                     String xmlStatus, LocalDateTime issuedAt, String createdBy) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record VatInvoiceRequest(@NotNull Long invoiceId, @NotBlank String customerType,
                                    @NotBlank String customerName, String taxCode,
                                    String companyName, String companyAddress,
                                    BigDecimal taxableAmount) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AttendanceResponse(Long id, String employeeId, LocalDate workDate,
                                     LocalDateTime clockIn, LocalDateTime clockOut,
                                     String status, String source, String deviceEventId, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AttendanceInput(@NotBlank String employeeId, @NotNull LocalDate workDate,
                                  LocalDateTime clockIn, LocalDateTime clockOut,
                                  @NotBlank String status, String source, String deviceEventId, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AttendanceImportRequest(@NotEmpty List<@Valid AttendanceInput> records) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LeaveResponse(Long id, String employeeId, String leaveType, LocalDate startDate,
                                LocalDate endDate, String reason, String shiftSwapWith,
                                String status, String requestedBy, String approver,
                                LocalDateTime decidedAt, LocalDateTime createdAt) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LeaveRequest(@NotBlank String employeeId, @NotBlank String leaveType,
                               @NotNull LocalDate startDate, @NotNull LocalDate endDate,
                               @NotBlank String reason, String shiftSwapWith) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StockItemResponse(String id, String name, String category, String unit,
                                    int currentQuantity, int safetyThreshold, String serviceId,
                                    boolean active) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record StockMovementRequest(@NotBlank String itemId, @NotBlank String movementType,
                                       @Positive int quantity, String reason) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TechnicalAssetResponse(String id, String name, String category, String locationType,
                                         String roomId, Integer floor, String location, String brandModel,
                                         LocalDate installedOn, LocalDate nextMaintenance, String status,
                                         BigDecimal originalValue, String note, boolean active) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TechnicalAssetRequest(@NotBlank String id, @NotBlank String name, @NotBlank String category,
                                        @NotBlank String locationType, String roomId, Integer floor,
                                        @NotBlank String location, String brandModel, LocalDate installedOn,
                                        LocalDate nextMaintenance, String status, @PositiveOrZero BigDecimal originalValue,
                                        String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TechnicalAssetStatusRequest(@NotBlank String status) {}
}
