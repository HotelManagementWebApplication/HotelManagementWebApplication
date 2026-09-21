package com.hospitality.mis.service.governance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.entity.governance.IdempotencyRecord;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Persists idempotency state and the response in the same transaction as the
 * command. The lock order is always unique idempotency claim, row lock, then
 * business command. A duplicate-key claim waits for the winner's transaction;
 * it is never converted into a retry or swallowed exception.
 */
@Service
public class DurableIdempotencyService {
    private final IdempotencyRecordRepository records;
    private final ObjectMapper objectMapper;
    private final Clock businessClock;

    public DurableIdempotencyService(IdempotencyRecordRepository records,
                                     ObjectMapper objectMapper, Clock businessClock) {
        this.records = records;
        this.objectMapper = objectMapper;
        this.businessClock = businessClock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T execute(String scope, String key, String actor, String requestHash,
                         Class<T> responseType, Supplier<T> command) {
        String normalizedKey = IdempotencySupport.requireKey(key);
        requireMetadata(scope, actor, requestHash, responseType, command);
        boolean existedBeforeClaim = records.existsByScopeAndKey(scope, normalizedKey);
        claim(scope, normalizedKey, actor, requestHash);
        IdempotencyRecord record = records.findForUpdate(scope, normalizedKey)
                .orElseThrow(() -> new IllegalStateException("Idempotency claim không tạo hoặc đọc được bản ghi"));
        if (existedBeforeClaim || record.getStatus() == IdempotencyRecord.Status.COMPLETED) {
            return replay(record, actor, requestHash, responseType);
        }
        T result = command.get();
        try {
            record.complete(responseType.getName(), objectMapper.writeValueAsString(result),
                    LocalDateTime.now(businessClock));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể lưu kết quả idempotency", exception);
        }
        // A command may execute a bulk update with clearAutomatically=true. That
        // operation clears this transaction's persistence context and detaches
        // the record loaded before the command. Reattach and flush so completion
        // is durable for both managed and detached records.
        records.saveAndFlush(record);
        return result;
    }

    /** Variant for JPA aggregates: persist a completion marker and reload the aggregate on retries. */
    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T executeWithReplay(String scope, String key, String actor, String requestHash,
                                   Supplier<T> command, Supplier<T> replayLoader) {
        String normalizedKey = IdempotencySupport.requireKey(key);
        requireMetadata(scope, actor, requestHash, Object.class, command);
        Objects.requireNonNull(replayLoader, "replayLoader");
        boolean existedBeforeClaim = records.existsByScopeAndKey(scope, normalizedKey);
        claim(scope, normalizedKey, actor, requestHash);
        IdempotencyRecord record = records.findForUpdate(scope, normalizedKey)
                .orElseThrow(() -> new IllegalStateException("Idempotency claim không tạo hoặc đọc được bản ghi"));
        if (existedBeforeClaim || record.getStatus() == IdempotencyRecord.Status.COMPLETED) {
            validateExisting(record, actor, requestHash);
            return replayLoader.get();
        }
        T result = command.get();
        record.complete("DB_REPLAY", "{}", LocalDateTime.now(businessClock));
        records.saveAndFlush(record);
        return result;
    }

    private <T> T replay(IdempotencyRecord record, String actor, String requestHash, Class<T> responseType) {
        validateExisting(record, actor, requestHash);
        if (!responseType.getName().equals(record.getResponseType())) {
            throw new DomainException("IDEMPOTENCY_KEY_CONFLICT", "Kiểu kết quả của Idempotency-Key không khớp");
        }
        try {
            return objectMapper.readValue(record.getResponseJson(), responseType);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể đọc kết quả idempotency đã lưu", exception);
        }
    }

    private void validateExisting(IdempotencyRecord record, String actor, String requestHash) {
        if (!record.getActor().equals(actor) || !record.getRequestHash().equals(requestHash)) {
            throw new DomainException("IDEMPOTENCY_KEY_CONFLICT",
                    "Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác");
        }
        if (record.getStatus() != IdempotencyRecord.Status.COMPLETED || record.getResponseJson() == null) {
            throw new DomainException("IDEMPOTENCY_REQUEST_IN_PROGRESS", "Yêu cầu cùng Idempotency-Key đang được xử lý");
        }
    }

    private void requireMetadata(String scope, String actor, String requestHash, Class<?> responseType,
                                 Supplier<?> command) {
        if (scope == null || scope.isBlank() || scope.length() > 100) {
            throw new DomainException("INVALID_IDEMPOTENCY_SCOPE", "Idempotency scope không hợp lệ");
        }
        Objects.requireNonNull(actor, "actor");
        Objects.requireNonNull(requestHash, "requestHash");
        Objects.requireNonNull(responseType, "responseType");
        Objects.requireNonNull(command, "command");
    }

    private void claim(String scope, String key, String actor, String requestHash) {
        records.claim(scope, key, actor, requestHash, LocalDateTime.now(businessClock));
    }
}
