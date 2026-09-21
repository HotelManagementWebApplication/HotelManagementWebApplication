CREATE TABLE commercial_partners (
    id VARCHAR(20) NOT NULL,
    legal_name VARCHAR(200) NOT NULL,
    brand_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(20),
    floor_from INT NOT NULL,
    floor_to INT NOT NULL,
    fixed_rent DECIMAL(14,2) NOT NULL DEFAULT 0,
    service_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    commission_floor DECIMAL(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_commercial_partners PRIMARY KEY (id),
    CONSTRAINT chk_commercial_partner_floor CHECK (floor_from >= 0 AND floor_to >= floor_from),
    CONSTRAINT chk_commercial_partner_money CHECK (fixed_rent >= 0 AND service_fee >= 0 AND commission_floor >= 0),
    CONSTRAINT chk_commercial_partner_rate CHECK (commission_rate >= 0 AND commission_rate <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE commercial_spaces (
    id VARCHAR(20) NOT NULL,
    partner_id VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    floor INT NOT NULL,
    zone VARCHAR(100) NOT NULL,
    access_policy VARCHAR(30) NOT NULL DEFAULT 'PUBLIC',
    service_id VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT pk_commercial_spaces PRIMARY KEY (id),
    CONSTRAINT fk_commercial_space_partner FOREIGN KEY (partner_id) REFERENCES commercial_partners (id),
    CONSTRAINT fk_commercial_space_service FOREIGN KEY (service_id) REFERENCES services (id),
    CONSTRAINT chk_commercial_space_access CHECK (access_policy IN ('PUBLIC', 'GUEST_ONLY', 'DAY_PASS'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_commercial_spaces_floor ON commercial_spaces (floor, status);
CREATE INDEX idx_commercial_spaces_partner ON commercial_spaces (partner_id, status);

CREATE TABLE partner_monthly_settlements (
    id BIGINT NOT NULL AUTO_INCREMENT,
    partner_id VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    fixed_rent DECIMAL(14,2) NOT NULL,
    service_fee DECIMAL(14,2) NOT NULL,
    actual_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_floor DECIMAL(14,2) NOT NULL,
    commission_due DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_due DECIMAL(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    exported_at DATETIME,
    CONSTRAINT pk_partner_monthly_settlements PRIMARY KEY (id),
    CONSTRAINT uk_partner_month_period UNIQUE (partner_id, period_start, period_end),
    CONSTRAINT fk_partner_settlement_partner FOREIGN KEY (partner_id) REFERENCES commercial_partners (id),
    CONSTRAINT chk_partner_settlement_period CHECK (period_end >= period_start),
    CONSTRAINT chk_partner_settlement_amounts CHECK (fixed_rent >= 0 AND service_fee >= 0 AND actual_revenue >= 0 AND commission_due >= 0 AND total_due >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_vouchers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    voucher_code VARCHAR(40) NOT NULL,
    guest_id BIGINT NOT NULL,
    space_id VARCHAR(20) NOT NULL,
    reservation_id BIGINT,
    membership_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    visit_at DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_customer_vouchers PRIMARY KEY (id),
    CONSTRAINT uk_customer_vouchers_code UNIQUE (voucher_code),
    CONSTRAINT fk_customer_voucher_guest FOREIGN KEY (guest_id) REFERENCES guests (id),
    CONSTRAINT fk_customer_voucher_space FOREIGN KEY (space_id) REFERENCES commercial_spaces (id),
    CONSTRAINT fk_customer_voucher_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_customer_vouchers_guest ON customer_vouchers (guest_id, created_at);
