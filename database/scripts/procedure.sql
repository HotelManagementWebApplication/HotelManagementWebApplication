-- =======================================================
-- Script: procedure.sql
-- Mục đích: Lưu trữ thủ tục xử lý nghiệp vụ phức tạp
-- Dự án: Hotel Management System
-- =======================================================

-- 1. Thủ tục tạo hóa đơn thanh toán tự động khi Check-out
CREATE OR REPLACE PROCEDURE sp_generate_invoice_for_booking(
    p_booking_id BIGINT,
    p_user_id BIGINT,
    OUT p_invoice_code VARCHAR(30),
    OUT p_final_amount DECIMAL(12, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_room_amount DECIMAL(12, 2) := 0.00;
    v_service_amount DECIMAL(12, 2) := 0.00;
    v_discount DECIMAL(12, 2) := 0.00;
    v_tax DECIMAL(12, 2) := 0.00;
    v_code VARCHAR(30);
BEGIN
    -- Tính tổng tiền phòng (đơn giá * số đêm)
    SELECT COALESCE(SUM(br.price_per_night * GREATEST(1, EXTRACT(DAY FROM (b.checkout_date - b.checkin_date)))), 0)
    INTO v_room_amount
    FROM bookings b
    JOIN booking_rooms br ON b.id = br.booking_id
    WHERE b.id = p_booking_id;

    -- Tính tổng tiền dịch vụ đã gọi
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_service_amount
    FROM service_orders
    WHERE booking_id = p_booking_id AND status = 'COMPLETED';

    -- Thuế VAT 8%
    v_tax := (v_room_amount + v_service_amount) * 0.08;
    p_final_amount := v_room_amount + v_service_amount + v_tax - v_discount;

    -- Tạo mã hóa đơn
    v_code := 'INV-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || LPAD(p_booking_id::TEXT, 4, '0');
    p_invoice_code := v_code;

    -- Chèn vào bảng invoices
    INSERT INTO invoices (
        invoice_code, booking_id, total_room_amount, total_service_amount,
        discount_amount, tax_amount, final_amount, payment_status, created_by
    ) VALUES (
        v_code, p_booking_id, v_room_amount, v_service_amount,
        v_discount, v_tax, p_final_amount, 'UNPAID', p_user_id
    );
END;
$$;

-- 2. Thủ tục thống kê doanh thu theo khoảng thời gian
CREATE OR REPLACE FUNCTION fn_get_revenue_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_invoices BIGINT,
    total_room_revenue DECIMAL(12, 2),
    total_service_revenue DECIMAL(12, 2),
    grand_total DECIMAL(12, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(id) AS total_invoices,
        COALESCE(SUM(total_room_amount), 0.00) AS total_room_revenue,
        COALESCE(SUM(total_service_amount), 0.00) AS total_service_revenue,
        COALESCE(SUM(final_amount), 0.00) AS grand_total
    FROM invoices
    WHERE payment_status = 'PAID'
      AND created_at::DATE BETWEEN p_start_date AND p_end_date;
END;
$$;
