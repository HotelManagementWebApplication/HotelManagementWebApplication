-- =======================================================
-- Script: trigger.sql
-- Mục đích: Tự động hóa nghiệp vụ (Cập nhật trạng thái phòng, tính tổng tiền...)
-- Dự án: Hotel Management System
-- =======================================================

-- 1. Trigger cập nhật updated_at tự động khi sửa đổi bản ghi
CREATE OR REPLACE FUNCTION update_timestamp_func()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_update_time
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_func();

CREATE OR REPLACE TRIGGER trg_rooms_update_time
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION update_timestamp_func();

-- 2. Trigger tự động tính total_price khi thêm mới đơn dịch vụ
CREATE OR REPLACE FUNCTION calculate_service_order_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.quantity * NEW.unit_price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_service_order_total
BEFORE INSERT OR UPDATE ON service_orders
FOR EACH ROW EXECUTE FUNCTION calculate_service_order_total();

-- 3. Trigger cập nhật trạng thái phòng khi đặt phòng chuyển sang CHECKED_IN
CREATE OR REPLACE FUNCTION sync_room_status_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CHECKED_IN' AND OLD.status != 'CHECKED_IN' THEN
        UPDATE rooms
        SET status = 'OCCUPIED'
        WHERE id IN (SELECT room_id FROM booking_rooms WHERE booking_id = NEW.id);
    ELSIF NEW.status = 'CHECKED_OUT' AND OLD.status != 'CHECKED_OUT' THEN
        UPDATE rooms
        SET status = 'DIRTY' -- Cần dọn dẹp trước khi chuyển về AVAILABLE
        WHERE id IN (SELECT room_id FROM booking_rooms WHERE booking_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_room_status
AFTER UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION sync_room_status_on_checkin();
