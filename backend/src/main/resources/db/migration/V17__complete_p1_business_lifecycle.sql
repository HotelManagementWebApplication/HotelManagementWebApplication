ALTER TABLE inventory_movements
    DROP CHECK chk_inventory_movements_quantity;

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movements_quantity CHECK (quantity <> 0);

ALTER TABLE employees
    ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT 'WORKING',
    ADD COLUMN leave_start DATE,
    ADD COLUMN leave_end DATE,
    ADD CONSTRAINT chk_employee_employment_status
        CHECK (employment_status IN ('WORKING','ON_LEAVE','TERMINATED')),
    ADD CONSTRAINT chk_employee_leave_period
        CHECK (leave_start IS NULL OR leave_end IS NULL OR leave_end >= leave_start);

CREATE INDEX idx_employees_employment_status ON employees (employment_status, enabled);

CREATE TABLE employee_login_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id VARCHAR(10) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_employee_login_event_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT chk_employee_login_event_outcome CHECK (outcome IN ('SUCCEEDED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_employee_login_event_employee_time
    ON employee_login_events (employee_id, occurred_at);

ALTER TABLE room_types
    DROP CHECK chk_room_types_catalog_status;

ALTER TABLE room_types
    ADD COLUMN revision_of_id VARCHAR(10),
    ADD COLUMN superseded_by_id VARCHAR(10),
    ADD CONSTRAINT chk_room_types_catalog_status
        CHECK (catalog_status IN ('DRAFT','ACTIVE','REJECTED','RETIRED')),
    ADD CONSTRAINT fk_room_type_revision_of FOREIGN KEY (revision_of_id) REFERENCES room_types (id),
    ADD CONSTRAINT fk_room_type_superseded_by FOREIGN KEY (superseded_by_id) REFERENCES room_types (id);

CREATE INDEX idx_room_type_revision_of ON room_types (revision_of_id);
