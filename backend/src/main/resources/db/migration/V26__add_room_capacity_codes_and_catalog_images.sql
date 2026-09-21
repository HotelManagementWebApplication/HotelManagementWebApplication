ALTER TABLE room_types
    ADD COLUMN room_type_code VARCHAR(12) NOT NULL DEFAULT 'STD',
    ADD COLUMN max_occupancy INT NOT NULL DEFAULT 2,
    ADD COLUMN cover_image_url VARCHAR(500),
    ADD CONSTRAINT chk_room_types_max_occupancy CHECK (max_occupancy BETWEEN 1 AND 8);

CREATE INDEX idx_room_types_code ON room_types (room_type_code);
