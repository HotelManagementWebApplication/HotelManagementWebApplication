package com.hospitality.mis.dto.finance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.finance.Expense;
import com.hospitality.mis.entity.finance.PartnerDebt;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.Map;
import java.util.List;

/** DTO cho bàn giao tiền mặt, chi phí và công nợ đối tác của vận hành. */
public final class FinanceDtos {
    /** Namespace không trạng thái cho các payload tài chính. */
    private FinanceDtos() {}
    /** Request bàn giao ca; mã ca và hai tác nhân bắt buộc để truy vết. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CashHandoverRequest(
                                      /** Mã ca cần bàn giao. */
                                      @NotBlank String shiftCode,
                                      /** Tác nhân giao tiền. */
                                      @NotBlank String fromActor,
                                      /** Tác nhân nhận tiền. */
                                      @NotBlank String toActor,
                                      /** Số tiền thực tế kiểm đếm. */
                                      @NotNull BigDecimal actualAmount,
                                      /** Ghi chú về bàn giao hoặc chênh lệch. */
                                      String note,
                                      List<DenominationLine> denominations) {
        public CashHandoverRequest(String shiftCode, String fromActor, String toActor,
                                   BigDecimal actualAmount, String note) {
            this(shiftCode, fromActor, toActor, actualAmount, note, List.of());
        }
    }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DenominationLine(@NotNull BigDecimal denomination, int quantity) {}
    /** Kết quả bàn giao gồm số kỳ vọng, số thực tế và chênh lệch. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CashHandoverResponse(
                                       /** Khóa bản ghi bàn giao. */
                                       Long id,
                                       /** Mã ca. */
                                       String shiftCode,
                                       /** Tác nhân giao. */
                                       String fromActor,
                                       /** Tác nhân nhận. */
                                       String toActor,
                                       /** Số tiền hệ thống kỳ vọng. */
                                       BigDecimal expectedAmount,
                                       /** Số tiền thực tế. */
                                       BigDecimal actualAmount,
                                       /** Chênh lệch giữa thực tế và kỳ vọng. */
                                       BigDecimal variance,
                                       /** Thời điểm bàn giao. */
                                       LocalDateTime handedOverAt,
                                       /** Ghi chú. */
                                       String note,
                                       List<DenominationLine> denominations) {
        public CashHandoverResponse(Long id, String shiftCode, String fromActor, String toActor,
                                    BigDecimal expectedAmount, BigDecimal actualAmount, BigDecimal variance,
                                    LocalDateTime handedOverAt, String note) {
            this(id, shiftCode, fromActor, toActor, expectedAmount, actualAmount, variance, handedOverAt, note, List.of());
        }
    }
    /** Request ghi nhận một khoản chi phí dương theo nhóm và mô tả. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ExpenseRequest(
                                 /** Nhóm chi phí để báo cáo. */
                                 @NotBlank String category,
                                 /** Mô tả khoản chi. */
                                 @NotBlank String description,
                                 /** Số tiền chi dương. */
                                 @NotNull @Positive BigDecimal amount) {}
    /** Khoản chi đã ghi nhận cùng tác nhân, thời điểm và trạng thái. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ExpenseResponse(
                                  /** Khóa khoản chi. */
                                  Long id,
                                  /** Nhóm chi phí. */
                                  String category,
                                  /** Mô tả khoản chi. */
                                  String description,
                                  /** Số tiền. */
                                  BigDecimal amount,
                                  /** Tác nhân đã trả tiền. */
                                  String paidBy,
                                  /** Thời điểm trả. */
                                  LocalDateTime paidAt,
                                  /** Trạng thái khoản chi. */
                                  Expense.ExpenseStatus status) {}
    /** Request ghi nhận công nợ phải trả cho một đối tác. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PartnerDebtRequest(
                                     /** Tên đối tác. */
                                     @NotBlank String partnerName,
                                     /** Mã hợp đồng hoặc chứng từ. */
                                     @NotBlank String referenceCode,
                                     /** Số tiền nợ ban đầu dương. */
                                     @NotNull @Positive BigDecimal amount) {}
    /** Công nợ đối tác với số đã tất toán và trạng thái hiện tại. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PartnerDebtResponse(
                                      /** Khóa công nợ. */
                                      Long id,
                                      /** Tên đối tác. */
                                      String partnerName,
                                      /** Mã tham chiếu. */
                                      String referenceCode,
                                      /** Tổng số tiền phải trả. */
                                      BigDecimal amount,
                                      /** Số tiền đã tất toán. */
                                      BigDecimal settledAmount,
                                      /** Trạng thái công nợ. */
                                      PartnerDebt.DebtStatus status,
                                      /** Thời điểm ghi nhận. */
                                      LocalDateTime recordedAt) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DebtSettlementRequest(@NotNull @Positive BigDecimal amount, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DebtSettlementResponse(Long id, Long partnerDebtId, BigDecimal amount, String settledBy,
                                         LocalDateTime settledAt, String note) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LedgerEntryResponse(Long id, String entryType, String sourceType, String sourceId,
                                      String direction, BigDecimal amount, String actorId,
                                      LocalDateTime occurredAt, String note, boolean finalized) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReconciliationResponse(LocalDate fromDate, LocalDate toDate, Map<String, BigDecimal> totalsByMethod,
                                         BigDecimal totalPayments, BigDecimal totalRefunds, BigDecimal netTotal,
                                         BigDecimal recognizedRevenue, BigDecimal outstandingPartnerDebt,
                                         BigDecimal cashVariance) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PageResponse<T>(java.util.List<T> items, int page, int size, long totalElements, int totalPages) {}
}
