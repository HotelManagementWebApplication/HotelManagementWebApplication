ALTER TABLE customer_vouchers
    ADD COLUMN revenue_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN scanned_at DATETIME,
    ADD COLUMN scanned_by VARCHAR(50),
    ADD CONSTRAINT chk_customer_voucher_revenue CHECK (revenue_amount >= 0);
