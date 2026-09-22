-- =======================================================
-- Script: create_table.sql
-- Mục đích: Tạo cấu trúc các bảng trong cơ sở dữ liệu
-- Dự án: Hotel Management System
-- =======================================================

-- 1. Bảng Vai trò và Tài khoản người dùng
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'STAFF', -- ADMIN, MANAGER, RECEPTIONIST, STAFF
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Khách hàng
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    identity_card VARCHAR(20) NOT NULL UNIQUE, -- CCCD / Hộ chiếu
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    gender VARCHAR(10),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Loại phòng
CREATE TABLE IF NOT EXISTS room_types (
    id BIGSERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE, -- Standard, Deluxe, Suite, VIP
    base_price DECIMAL(12, 2) NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Phòng
CREATE TABLE IF NOT EXISTS rooms (
    id BIGSERIAL PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    room_type_id BIGINT NOT NULL,
    floor INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, BOOKED, OCCUPIED, MAINTENANCE, DIRTY
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng Đặt phòng
CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checkin_date TIMESTAMP NOT NULL,
    checkout_date TIMESTAMP NOT NULL,
    actual_checkin TIMESTAMP,
    actual_checkout TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED
    deposit_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_estimated DECIMAL(12, 2) DEFAULT 0.00,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng Chi tiết phòng đặt (Booking Rooms)
CREATE TABLE IF NOT EXISTS booking_rooms (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    room_id BIGINT NOT NULL,
    price_per_night DECIMAL(12, 2) NOT NULL
);

-- 7. Bảng Dịch vụ
CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50), -- Ẩm thực, Giặt ủi, Spa, Xe đưa đón
    unit_price DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- lượt, chai, đĩa, giờ
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 8. Bảng Gọi dịch vụ của phòng/khách
CREATE TABLE IF NOT EXISTS service_orders (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    room_id BIGINT,
    service_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'COMPLETED' -- PENDING, COMPLETED, CANCELLED
);

-- 9. Bảng Hóa đơn thanh toán
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_code VARCHAR(30) NOT NULL UNIQUE,
    booking_id BIGINT NOT NULL UNIQUE,
    total_room_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_service_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    final_amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID, REFUNDED
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Bảng Chi tiết giao dịch thanh toán
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- CASH, CREDIT_CARD, BANK_TRANSFER, MOMO, VN_PAY
    amount DECIMAL(12, 2) NOT NULL,
    transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- 11. Bảng Bảo trì & Sửa chữa thiết bị phòng
CREATE TABLE IF NOT EXISTS maintenance_records (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL,
    issue_description TEXT NOT NULL,
    reported_by BIGINT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, RESOLVED, CANCELLED
    cost DECIMAL(12, 2) DEFAULT 0.00
);

-- 12. Bảng Nhật ký hệ thống (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(50),
    entity_id BIGINT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
