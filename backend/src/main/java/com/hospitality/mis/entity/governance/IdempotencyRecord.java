package com.hospitality.mis.entity.governance;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDateTime;

/** Durable command result used to make retryable mutations safe across restarts. */
@Entity
@Table(name = "BanGhiChongTrung", uniqueConstraints =
        @UniqueConstraint(name = "ukBanGhiChongTrung01", columnNames = {"phamViLenh", "khoaChongTrung"}))
public class IdempotencyRecord {
    public enum Status { PROCESSING, COMPLETED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "maBanGhiChongTrung")
    private Long id;

    @Column(name = "phamViLenh", nullable = false, length = 100)
    private String scope;

    @Column(name = "khoaChongTrung", nullable = false, length = 100)
    private String key;

    @Column(name = "nguoiThucHien", nullable = false, length = 100)
    private String actor;

    @Column(name = "maBamYeuCau", nullable = false, length = 64)
    private String requestHash;

    @Convert(converter = com.hospitality.mis.persistence.VietnameseEnumConverters.IdempotencyStatusConverter.class)
    @Column(name = "trangThai", nullable = false, length = 20)
    private Status status;

    @Column(name = "loaiPhanHoi", length = 255)
    private String responseType;

    @Column(name = "phanHoiJson", columnDefinition = "NVARCHAR(MAX)")
    private String responseJson;

    @Column(name = "thoiDiemTao", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "thoiDiemHoanThanh")
    private LocalDateTime completedAt;

    @Version
    @Column(name = "phienBan", nullable = false)
    private long version;

    protected IdempotencyRecord() {}

    public IdempotencyRecord(String scope, String key, String actor, String requestHash, LocalDateTime createdAt) {
        this.scope = scope;
        this.key = key;
        this.actor = actor;
        this.requestHash = requestHash;
        this.createdAt = createdAt;
        this.status = Status.PROCESSING;
    }

    public void complete(String responseType, String responseJson, LocalDateTime completedAt) {
        this.responseType = responseType;
        this.responseJson = responseJson;
        this.completedAt = completedAt;
        this.status = Status.COMPLETED;
    }

    public String getActor() { return actor; }
    public String getRequestHash() { return requestHash; }
    public Status getStatus() { return status; }
    public String getResponseType() { return responseType; }
    public String getResponseJson() { return responseJson; }
}
