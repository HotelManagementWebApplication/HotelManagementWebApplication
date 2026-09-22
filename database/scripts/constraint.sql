-- =======================================================
-- Script: constraint.sql
-- Mục đích: Thiết lập ràng buộc khóa ngoại và Check Constraints
-- Dự án: Hotel Management System
-- =======================================================

-- 1. Khóa ngoại bảng rooms -> room_types
ALTER TABLE rooms
    ADD CONSTRAINT fk_rooms_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    ON DELETE RESTRICT;

-- 2. Khóa ngoại bảng bookings -> customers
ALTER TABLE bookings
    ADD CONSTRAINT fk_bookings_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE;

-- 3. Khóa ngoại bảng booking_rooms -> bookings & rooms
ALTER TABLE booking_rooms
    ADD CONSTRAINT fk_br_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE CASCADE,
    ADD CONSTRAINT fk_br_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE RESTRICT;

-- 4. Khóa ngoại bảng service_orders -> bookings & services
ALTER TABLE service_orders
    ADD CONSTRAINT fk_so_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE CASCADE,
    ADD CONSTRAINT fk_so_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE RESTRICT;

-- 5. Khóa ngoại bảng invoices -> bookings & users
ALTER TABLE invoices
    ADD CONSTRAINT fk_invoices_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE RESTRICT,
    ADD CONSTRAINT fk_invoices_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- 6. Khóa ngoại bảng payments -> invoices
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE;

-- 7. Khóa ngoại bảng maintenance_records -> rooms & users
ALTER TABLE maintenance_records
    ADD CONSTRAINT fk_maintenance_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
    ADD CONSTRAINT fk_maintenance_user
    FOREIGN KEY (reported_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- 8. CHECK CONSTRAINTS
ALTER TABLE bookings
    ADD CONSTRAINT chk_checkout_after_checkin
    CHECK (checkout_date >= checkin_date);

ALTER TABLE room_types
    ADD CONSTRAINT chk_positive_price
    CHECK (base_price >= 0),
    ADD CONSTRAINT chk_positive_capacity
    CHECK (capacity > 0);

ALTER TABLE services
    ADD CONSTRAINT chk_service_positive_price
    CHECK (unit_price >= 0);

ALTER TABLE service_orders
    ADD CONSTRAINT chk_service_quantity
    CHECK (quantity > 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_final_amount_non_negative
    CHECK (final_amount >= 0);
