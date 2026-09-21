package com.hospitality.mis.entity.governance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Fixed rows retained by the existing schema. Runtime claims use the unique
 * idempotency record key directly, so missing bucket rows cannot participate in
 * a command transaction or create an insert deadlock.
 */
@Entity
@Table(name = "idempotency_lock_buckets")
public class IdempotencyLockBucket {
    @Id
    @Column(name = "bucket_id")
    private short id;

    protected IdempotencyLockBucket() {}
    public IdempotencyLockBucket(short id) { this.id = id; }
    public short getId() { return id; }
}
