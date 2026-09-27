package com.hospitality.mis.entity.governance;



import jakarta.persistence.*;

import java.time.Instant;



@Entity

@Table(name = "NhatKyKiemSoat", indexes = {
        @Index(name = "idxNhatKyKiemSoat01", columnList = "nguoiThucHien,thoiDiemTao"),
        @Index(name = "idxNhatKyKiemSoat02", columnList = "hanhDong,thoiDiemTao")
})

/** Bản ghi kiểm toán bất biến về ai đã thực hiện hành động trên đối tượng nào. */
public class AuditLog {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)

    /** ID log do cơ sở dữ liệu sinh. */
    @Column(name = "maNhatKyKiemSoat")
    private Long id;

    /** Chủ thể thực hiện hành động, dùng cho truy vết. */
    @Column(name = "nguoiThucHien", nullable = false, length = 50) private String actor;

    /** Mã hành động nghiệp vụ đã xảy ra. */
    @Column(name = "hanhDong", nullable = false, length = 100) private String action;

    /** Loại đối tượng bị tác động. */
    @Column(name = "loaiDoiTuong", nullable = false, length = 100) private String entityType;

    /** ID đối tượng bị tác động. */
    @Column(name = "maDoiTuong", nullable = false, length = 100) private String entityId;

    /** Ảnh chụp trước thay đổi; có thể null khi đối tượng được tạo mới. */
    @Column(name = "duLieuTruoc", columnDefinition = "NVARCHAR(MAX)") private String beforeData;
    /** Ảnh chụp sau thay đổi; có thể null khi đối tượng bị xóa. */
    @Column(name = "duLieuSau", columnDefinition = "NVARCHAR(MAX)") private String afterData;
    @Column(name = "lyDo", length = 500) private String reason;

    /** Mã liên kết các log thuộc cùng một yêu cầu phân tán. */
    @Column(name = "khoaLienKet", length = 100) private String correlationKey;

    /** Thời điểm log được tạo tại server. */
    @Column(name = "thoiDiemTao", nullable = false) private Instant createdAt = Instant.now();


    /** Constructor rỗng dành cho JPA. */
    protected AuditLog() {}

    /** Tạo log không gắn correlation key. */
    public AuditLog(String actor, String action, String entityType, String entityId, String beforeData,

                    String afterData, String reason) {

        this(actor, action, entityType, entityId, beforeData, afterData, reason, null);
    }

    /** Tạo log đầy đủ cùng ảnh chụp trước/sau và mã liên kết tùy chọn. */
    public AuditLog(String actor, String action, String entityType, String entityId, String beforeData,

                    String afterData, String reason, String correlationKey) {

        this.actor = actor; this.action = action; this.entityType = entityType; this.entityId = entityId;

        this.beforeData = beforeData; this.afterData = afterData; this.reason = reason;
        this.correlationKey = correlationKey;

    }

    public AuditLog(String actor, String action, String entityType, String entityId, String beforeData,
                    String afterData, String reason, String correlationKey, Instant createdAt) {
        this(actor, action, entityType, entityId, beforeData, afterData, reason, correlationKey);
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getBeforeData() { return beforeData; }
    public String getAfterData() { return afterData; }
    public String getReason() { return reason; }
    public String getCorrelationKey() { return correlationKey; }
    public Instant getCreatedAt() { return createdAt; }

}
