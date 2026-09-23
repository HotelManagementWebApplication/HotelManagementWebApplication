-- Hotel-operated services replace the commercial tenant and voucher model.
-- Keep historical service usages and the independent supplier debt ledger.
-- Existing voucher and tenant rows are intentionally removed by this cutover.
DROP TABLE customer_vouchers;
DROP TABLE partner_monthly_settlements;
DROP TABLE commercial_spaces;
DROP TABLE commercial_partners;

-- Old tenant brands remain inactive for historical foreign-key references.
UPDATE services SET active = FALSE
WHERE id IN ('LABRASS', 'OTTIMO', 'MERMAID', 'HAIDILAO', 'OMAKASE',
             'SPICYBOX', 'DOKKI', 'SPEAKEASY', 'WHISKYBAR', 'SKYBAR',
             'LAVIESPA', 'SENSPA');

-- The hotel operates its restaurant and wellness services directly.
INSERT INTO services (id, name, price, unit, stock_quantity, safety_threshold,
                      active, category, description)
VALUES ('MAMREST', 'MaM Restaurant', 250000.00, 'suất', 999999, 0,
        TRUE, 'fine-dining', 'Bữa trưa hoặc bữa tối tại nhà hàng MaM Hotel. Khách lưu trú theo gói ngày-đêm được miễn một bữa trưa và một bữa tối mỗi ngày cho từng khách trong booking.');

UPDATE services SET price = 200000.00, unit = 'khách/ngày',
    description = 'Khách thuê theo gói ngày-đêm dùng hồ bơi miễn phí không giới hạn trong thời gian lưu trú, theo số khách đã đăng ký. Khách thuê theo giờ trả 200.000 đồng mỗi khách mỗi ngày.'
WHERE id = 'POOL';
UPDATE services SET price = 100000.00, unit = 'khách/ngày'
WHERE id = 'GYM';
UPDATE services SET unit = 'lần', price = 80000.00
WHERE id = 'LNDRYSTD';

-- Zero-priced placeholders have no bookable, reliable tariff.
UPDATE services SET active = FALSE WHERE id IN ('ROOM24', 'EVENT', 'BALLROOM');

ALTER TABLE reservation_rooms
    ADD COLUMN guest_count INT NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_reservation_rooms_guest_count CHECK (guest_count > 0);

CREATE TABLE hotel_service_bookings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    reservation_id BIGINT NOT NULL,
    room_id VARCHAR(10) NOT NULL,
    service_id VARCHAR(10) NOT NULL,
    scheduled_at DATETIME NOT NULL,
    meal_period VARCHAR(10),
    quantity INT NOT NULL,
    free_quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    note VARCHAR(500),
    request_key VARCHAR(100) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    created_by VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    used_by VARCHAR(80),
    CONSTRAINT pk_hotel_service_bookings PRIMARY KEY (id),
    CONSTRAINT uk_hotel_service_booking_request_key UNIQUE (request_key),
    CONSTRAINT fk_hotel_service_booking_room FOREIGN KEY (reservation_id, room_id)
        REFERENCES reservation_rooms (reservation_id, room_id),
    CONSTRAINT fk_hotel_service_booking_service FOREIGN KEY (service_id) REFERENCES services (id),
    CONSTRAINT chk_hotel_service_booking_quantity CHECK (quantity > 0 AND free_quantity >= 0 AND free_quantity <= quantity),
    CONSTRAINT chk_hotel_service_booking_price CHECK (unit_price >= 0),
    CONSTRAINT chk_hotel_service_booking_meal_period CHECK (meal_period IS NULL OR meal_period IN ('LUNCH', 'DINNER')),
    CONSTRAINT chk_hotel_service_booking_status CHECK (status IN ('CONFIRMED', 'USED', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_hotel_service_booking_reservation
    ON hotel_service_bookings (reservation_id, status, scheduled_at);
CREATE INDEX idx_hotel_service_booking_quota
    ON hotel_service_bookings (reservation_id, room_id, service_id, scheduled_at, status);
