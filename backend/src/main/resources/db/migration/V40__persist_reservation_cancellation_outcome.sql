ALTER TABLE reservations
    ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER actual_check_out,
    ADD COLUMN cancellation_outcome VARCHAR(20) NULL AFTER cancellation_reason;

ALTER TABLE reservations
    ADD CONSTRAINT chk_reservations_cancellation_outcome
        CHECK (cancellation_outcome IS NULL OR cancellation_outcome IN ('REFUND', 'RETAIN', 'FORFEIT'));
