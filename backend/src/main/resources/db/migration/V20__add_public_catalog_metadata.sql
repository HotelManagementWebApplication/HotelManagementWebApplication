ALTER TABLE room_types
    ADD COLUMN area DECIMAL(8, 2),
    ADD COLUMN room_view VARCHAR(100),
    ADD COLUMN hourly_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN bed_type VARCHAR(100),
    ADD CONSTRAINT chk_room_types_area CHECK (area IS NULL OR area > 0),
    ADD CONSTRAINT chk_room_types_hourly_price CHECK (hourly_price >= 0);

ALTER TABLE services
    ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'other',
    ADD COLUMN description VARCHAR(1000),
    ADD COLUMN image_url VARCHAR(500);

CREATE INDEX idx_services_public_catalog ON services (active, category, name);
