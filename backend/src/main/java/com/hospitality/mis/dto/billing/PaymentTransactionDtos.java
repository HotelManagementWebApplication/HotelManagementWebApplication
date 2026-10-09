package com.hospitality.mis.dto.billing;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** DTO cho giao dịch thu/hoàn tiền; khóa retry đi qua HTTP header Idempotency-Key. */
public final class PaymentTransactionDtos {
    /** Namespace của request và response thanh toán. */
    private PaymentTransactionDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Dữ liệu tạo giao dịch; amount dương và các enum bắt buộc do bean validation kiểm tra. */
    public record CreateRequest(
            /** Số tiền giao dịch, phải lớn hơn 0. */
            @NotNull @Positive BigDecimal amount,
            /** Phương thức thu tiền. */
            @NotNull PaymentMethod method,
            /** Loại nghiệp vụ, ví dụ thanh toán hoặc hoàn tiền. */
            @NotNull PaymentTransaction.TransactionType type,
            /** Mã tham chiếu từ hệ thống thanh toán bên ngoài hoặc giao dịch hoàn tiền gốc, có thể bỏ trống. */
            String reference) {
        /** Tạo payload ổn định để xin phê duyệt đúng giao dịch và đúng khóa retry. */
        public String approvalPayload(Long invoiceId, String idempotencyKey) {
            return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode()
                    .put("invoice_id", invoiceId).put("idempotency_key", idempotencyKey.trim())
                    .put("method", method.name()).put("type", type.name())
                    .put("reference", reference == null ? "" : reference).toString();
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    /** Biểu diễn giao dịch đã ghi nhận, gồm tác nhân và thời điểm để đối soát. */
    public record Response(
                           /** Khóa chính giao dịch. */
                           Long id,
                           /** Hóa đơn được giao dịch tác động. */
                           Long invoiceId,
                           /** Số tiền đã ghi nhận. */
                           BigDecimal amount,
                           /** Phương thức thanh toán. */
                           PaymentMethod method,
                           /** Loại giao dịch. */
                           PaymentTransaction.TransactionType type,
                           /** Trạng thái xử lý giao dịch. */
                           PaymentTransaction.TransactionStatus status,
                           /** Mã tham chiếu đối soát. */
                           String reference,
                           /** Thời điểm ghi nhận. */
                           LocalDateTime occurredAt,
                           /** Tác nhân thực hiện thao tác. */
                           String actorId) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PageResponse(java.util.List<Response> items, int page, int size, long totalElements, int totalPages) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LedgerResponse(Long id, Long invoiceId, BigDecimal amount, PaymentMethod method,
                                 PaymentTransaction.TransactionType type, PaymentTransaction.TransactionStatus status,
                                 String reference, LocalDateTime occurredAt, String actorId,
                                 Long reservationId, BigDecimal serviceTotal) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LedgerPageResponse(java.util.List<LedgerResponse> items, int page, int size,
                                     long totalElements, int totalPages, java.util.Map<String, Long> methodCounts) {}
}
