-- Contract extensions selected for the web hotel workflow.

ALTER TABLE reservations
    ADD COLUMN booking_source VARCHAR(30) NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN ota_gross_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN ota_commission DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN ota_net_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN ota_reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'NOT_APPLICABLE';

ALTER TABLE employees
    ADD COLUMN email VARCHAR(150),
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE vat_invoices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT NOT NULL,
    vat_invoice_number VARCHAR(40) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    taxable_amount DECIMAL(14,2) NOT NULL,
    tax_amount DECIMAL(14,2) NOT NULL,
    total_amount DECIMAL(14,2) NOT NULL,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL',
    customer_name VARCHAR(200) NOT NULL,
    tax_code VARCHAR(30),
    company_name VARCHAR(200),
    company_address VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    xml_status VARCHAR(20) NOT NULL DEFAULT 'NOT_EXPORTED',
    xml_content LONGTEXT,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    CONSTRAINT pk_vat_invoices PRIMARY KEY (id),
    CONSTRAINT uk_vat_invoice_invoice UNIQUE (invoice_id),
    CONSTRAINT uk_vat_invoice_number UNIQUE (vat_invoice_number),
    CONSTRAINT fk_vat_invoice_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id),
    CONSTRAINT chk_vat_invoice_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT chk_vat_invoice_amounts CHECK (taxable_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attendance_records (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id VARCHAR(10) NOT NULL,
    work_date DATE NOT NULL,
    clock_in DATETIME,
    clock_out DATETIME,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    device_event_id VARCHAR(100),
    note VARCHAR(500),
    imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_by VARCHAR(50) NOT NULL,
    CONSTRAINT pk_attendance_records PRIMARY KEY (id),
    CONSTRAINT uk_attendance_employee_date UNIQUE (employee_id, work_date),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT chk_attendance_source CHECK (source IN ('MANUAL', 'BIOMETRIC_IMPORT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE leave_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id VARCHAR(10) NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(500) NOT NULL,
    shift_swap_with VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by VARCHAR(50) NOT NULL,
    approver VARCHAR(50),
    decided_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_leave_requests PRIMARY KEY (id),
    CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_leave_swap_employee FOREIGN KEY (shift_swap_with) REFERENCES employees (id),
    CONSTRAINT chk_leave_period CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_leave_requests_status ON leave_requests (status, start_date);

CREATE TABLE stock_items (
    id VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    current_quantity INT NOT NULL DEFAULT 0,
    safety_threshold INT NOT NULL DEFAULT 0,
    service_id VARCHAR(10),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_stock_items PRIMARY KEY (id),
    CONSTRAINT fk_stock_item_service FOREIGN KEY (service_id) REFERENCES services (id),
    CONSTRAINT chk_stock_item_qty CHECK (current_quantity >= 0 AND safety_threshold >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_movements (
    id BIGINT NOT NULL AUTO_INCREMENT,
    item_id VARCHAR(30) NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    actor_id VARCHAR(50) NOT NULL,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    CONSTRAINT pk_stock_movements PRIMARY KEY (id),
    CONSTRAINT fk_stock_movement_item FOREIGN KEY (item_id) REFERENCES stock_items (id),
    CONSTRAINT chk_stock_movement_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_stock_movements_item ON stock_movements (item_id, occurred_at);

CREATE TABLE technical_assets (
    id VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location_type VARCHAR(20) NOT NULL,
    room_id VARCHAR(10),
    floor INT,
    location VARCHAR(150) NOT NULL,
    brand_model VARCHAR(150),
    installed_on DATE,
    next_maintenance DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'GOOD',
    original_value DECIMAL(14,2) NOT NULL DEFAULT 0,
    note VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_technical_assets PRIMARY KEY (id),
    CONSTRAINT fk_technical_asset_room FOREIGN KEY (room_id) REFERENCES rooms (id),
    CONSTRAINT chk_technical_asset_value CHECK (original_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_technical_assets_location ON technical_assets (location_type, floor, status);

CREATE TABLE cash_handover_denominations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    handover_id BIGINT NOT NULL,
    denomination DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    CONSTRAINT pk_cash_handover_denominations PRIMARY KEY (id),
    CONSTRAINT fk_cash_handover_denomination_handover FOREIGN KEY (handover_id) REFERENCES cash_shift_handovers (id) ON DELETE CASCADE,
    CONSTRAINT chk_cash_denomination_values CHECK (denomination > 0 AND quantity > 0 AND amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_cash_handover_denominations_handover ON cash_handover_denominations (handover_id);
