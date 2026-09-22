-- =======================================================
-- Script: sample_data.sql
-- Mục đích: Chèn dữ liệu kiểm thử (Mock data)
-- Dự án: Hotel Management System
-- =======================================================

-- 1. Tài khoản mẫu (Mật khẩu băm hoặc mặc định)
INSERT INTO users (username, password, full_name, role, email, phone) VALUES
('admin', '$2a$10$e8wF4Y5i1oWf8Gq5iRjWae1a4sK0D4Z3e6zL4jVb8yZ.mockpassword', 'Nguyễn Quản Trị', 'ADMIN', 'admin@hotel.com', '0901234567'),
('manager', '$2a$10$e8wF4Y5i1oWf8Gq5iRjWae1a4sK0D4Z3e6zL4jVb8yZ.mockpassword', 'Trần Quản Lý', 'MANAGER', 'manager@hotel.com', '0912345678'),
('reception', '$2a$10$e8wF4Y5i1oWf8Gq5iRjWae1a4sK0D4Z3e6zL4jVb8yZ.mockpassword', 'Lê Lễ Tân', 'RECEPTIONIST', 'letan@hotel.com', '0923456789')
ON CONFLICT (username) DO NOTHING;

-- 2. Khách hàng mẫu
INSERT INTO customers (full_name, identity_card, phone, email, address) VALUES
('Phạm Văn A', '001201012345', '0934567890', 'vana@gmail.com', 'Hà Nội'),
('Hoàng Thị B', '001202023456', '0945678901', 'thib@gmail.com', 'Đà Nẵng'),
('Vũ Đình C', '001203034567', '0956789012', 'dinhc@gmail.com', 'Hồ Chí Minh')
ON CONFLICT (identity_card) DO NOTHING;

-- 3. Loại phòng mẫu
INSERT INTO room_types (type_name, base_price, capacity, description) VALUES
('Standard', 500000.00, 2, 'Phòng tiêu chuẩn 1 giường đôi, đầy đủ tiện nghi cơ bản'),
('Deluxe', 850000.00, 2, 'Phòng cao cấp view đẹp, bồn tắm nằm, ban công thoáng mát'),
('Suite', 1500000.00, 4, 'Phòng Suite gia đình sang trọng gồm phòng khách và 2 phòng ngủ'),
('VIP President', 3500000.00, 4, 'Căn hộ VIP đẳng cấp tổng thống, phục vụ riêng 24/7')
ON CONFLICT (type_name) DO NOTHING;

-- 4. Danh sách phòng
INSERT INTO rooms (room_number, room_type_id, floor, status) VALUES
('101', 1, 1, 'AVAILABLE'),
('102', 1, 1, 'AVAILABLE'),
('201', 2, 2, 'OCCUPIED'),
('202', 2, 2, 'AVAILABLE'),
('301', 3, 3, 'BOOKED'),
('401', 4, 4, 'AVAILABLE')
ON CONFLICT (room_number) DO NOTHING;

-- 5. Danh mục dịch vụ
INSERT INTO services (service_name, category, unit_price, unit, description) VALUES
('Bữa sáng Buffet', 'Ẩm thực', 120000.00, 'suất', 'Buffet sáng Á - Âu'),
('Giặt ủi quần áo', 'Giặt ủi', 50000.00, 'kg', 'Giặt sấy và ủi phẳng'),
('Massage Body & Spa', 'Spa', 350000.00, 'giờ', 'Trị liệu thư giãn thảo dược'),
('Thuê xe tự lái 4 chỗ', 'Di chuyển', 800000.00, 'ngày', 'Xe Sedan đời mới')
ON CONFLICT (service_name) DO NOTHING;
