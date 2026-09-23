-- Manual demo reset. Run only after Flyway has completed all migrations.
-- The database is not in production; this script rebuilds customer-facing demo data.
-- Employee accounts are intentionally preserved.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

DELETE FROM notification_outbox;
DELETE FROM cash_handover_denominations;
DELETE FROM technical_assets;
DELETE FROM stock_movements;
DELETE FROM stock_items;
DELETE FROM leave_requests;
DELETE FROM attendance_records;
DELETE FROM vat_invoices;
DELETE FROM hotel_service_bookings;
DELETE FROM financial_ledger_entries;
DELETE FROM partner_debt_settlements;
DELETE FROM receipts;
DELETE FROM payment_transactions;
DELETE FROM invoice_adjustments;
DELETE FROM invoices;
DELETE FROM equipment_incidents;
DELETE FROM service_usages;
DELETE FROM room_transfers;
DELETE FROM reservation_rooms;
DELETE FROM reservations;
DELETE FROM refresh_tokens;
DELETE FROM customer_accounts;
DELETE FROM membership_history;
DELETE FROM employee_login_events;
DELETE FROM employee_shifts;
DELETE FROM housekeeping_inspections;
DELETE FROM housekeeping_checklist_results;
DELETE FROM housekeeping_checklist_templates;
DELETE FROM housekeeping_tasks;
DELETE FROM technical_work_orders;
DELETE FROM maintenance_work_orders;
DELETE FROM room_equipment;
DELETE FROM room_images;
DELETE FROM room_type_amenities;
DELETE FROM amenities;
DELETE FROM inventory_movements;
DELETE FROM service_price_history;
DELETE FROM services;
DELETE FROM room_type_price_history;
DELETE FROM rooms;
DELETE FROM guests;
DELETE FROM room_types;
DELETE FROM partner_debts;
DELETE FROM expenses;
DELETE FROM cash_shift_handovers;
DELETE FROM approval_requests;
DELETE FROM audit_logs;
DELETE FROM idempotency_records;
DELETE FROM idempotency_lock_buckets;

ALTER TABLE guests AUTO_INCREMENT = 1;
ALTER TABLE customer_accounts AUTO_INCREMENT = 1;
ALTER TABLE reservations AUTO_INCREMENT = 1;
ALTER TABLE room_transfers AUTO_INCREMENT = 1;
ALTER TABLE invoices AUTO_INCREMENT = 1;
ALTER TABLE equipment_incidents AUTO_INCREMENT = 1;
ALTER TABLE amenities AUTO_INCREMENT = 1;
ALTER TABLE room_images AUTO_INCREMENT = 1;
ALTER TABLE approval_requests AUTO_INCREMENT = 1;
ALTER TABLE audit_logs AUTO_INCREMENT = 1;
ALTER TABLE refresh_tokens AUTO_INCREMENT = 1;
ALTER TABLE hotel_service_bookings AUTO_INCREMENT = 1;
ALTER TABLE partner_debts AUTO_INCREMENT = 1;
ALTER TABLE partner_debt_settlements AUTO_INCREMENT = 1;
ALTER TABLE expenses AUTO_INCREMENT = 1;
ALTER TABLE cash_shift_handovers AUTO_INCREMENT = 1;
ALTER TABLE payment_transactions AUTO_INCREMENT = 1;
ALTER TABLE receipts AUTO_INCREMENT = 1;
ALTER TABLE financial_ledger_entries AUTO_INCREMENT = 1;
ALTER TABLE inventory_movements AUTO_INCREMENT = 1;
ALTER TABLE room_equipment AUTO_INCREMENT = 1;
ALTER TABLE room_type_price_history AUTO_INCREMENT = 1;
ALTER TABLE housekeeping_tasks AUTO_INCREMENT = 1;
ALTER TABLE housekeeping_checklist_templates AUTO_INCREMENT = 1;
ALTER TABLE housekeeping_checklist_results AUTO_INCREMENT = 1;
ALTER TABLE housekeeping_inspections AUTO_INCREMENT = 1;
ALTER TABLE technical_work_orders AUTO_INCREMENT = 1;
ALTER TABLE employee_shifts AUTO_INCREMENT = 1;
ALTER TABLE cash_handover_denominations AUTO_INCREMENT = 1;
ALTER TABLE stock_movements AUTO_INCREMENT = 1;
ALTER TABLE leave_requests AUTO_INCREMENT = 1;
ALTER TABLE attendance_records AUTO_INCREMENT = 1;
ALTER TABLE vat_invoices AUTO_INCREMENT = 1;

INSERT INTO room_types
(id, name, room_type_code, daily_price, hourly_price, area, room_view, bed_type, max_occupancy, cover_image_url, description,
 catalog_status, catalog_updated_by, catalog_approved_by, catalog_updated_at, catalog_approved_at)
VALUES
('RT001', 'Standard (STD) · Đơn', 'STD', 1200000.00, 180000.00, 18.00, 'Thành phố', 'Giường Queen', 2,
 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=800&fit=crop&auto=format',
 'Phòng tiêu chuẩn tiết kiệm, gọn gàng và đủ tiện nghi cho tối đa 2 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT002', 'Standard (STD) · Đôi', 'STD', 1450000.00, 220000.00, 25.00, 'Thành phố', 'Hai giường đơn', 4,
 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=800&fit=crop&auto=format',
 'Phòng STD rộng hơn với hai giường đơn, phù hợp nhóm nhỏ tối đa 4 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT003', 'Superior (SUP) · Đơn', 'SUP', 1800000.00, 260000.00, 28.00, 'Hướng vườn', 'Giường King', 2,
 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=800&fit=crop&auto=format',
 'Không gian SUP thoáng hơn, nội thất nâng cấp và cửa sổ hướng vườn.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT004', 'Superior (SUP) · Đôi', 'SUP', 2100000.00, 300000.00, 35.00, 'Thành phố', 'Hai giường Queen', 4,
 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&h=800&fit=crop&auto=format',
 'Phòng SUP đôi rộng rãi với tầm nhìn thoáng, phù hợp gia đình tối đa 4 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT005', 'Deluxe (DLX) · King', 'DLX', 2600000.00, 380000.00, 45.00, 'Sông Sài Gòn', 'Giường King', 4,
 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1200&h=800&fit=crop&auto=format',
 'DLX tầng cao, diện tích rộng, hướng sông và trang thiết bị cao cấp.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT006', 'Deluxe (DLX) · Family', 'DLX', 3200000.00, 460000.00, 58.00, 'Toàn cảnh thành phố', 'Hai giường Queen + sofa', 6,
 'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=1200&h=800&fit=crop&auto=format',
 'DLX Family cho nhóm đông, có khu vực sofa và không gian nghỉ thoải mái tối đa 6 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT007', 'Suite (SUT) · Residence', 'SUT', 4500000.00, 650000.00, 78.00, 'Sông Sài Gòn', 'Giường King + phòng khách', 8,
 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&h=800&fit=crop&auto=format',
 'Suite Residence tầng cao với phòng khách riêng, bồn tắm và sức chứa tối đa 8 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT008', 'Suite (SUT) · Executive', 'SUT', 5800000.00, 800000.00, 92.00, 'Toàn cảnh thành phố', 'Giường King + phòng khách', 8,
 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&h=800&fit=crop&auto=format',
 'Suite Executive rộng nhất hạng SUT, ban công riêng và dịch vụ đón tiếp cao cấp.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6)),
('RT009', 'Biệt thự Hoàng gia · Nguyên căn', 'VIP', 9500000.00, 1200000.00, 120.00, 'Toàn cảnh thành phố', 'Giường King + phòng khách riêng', 8,
 'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg',
 'Một căn biệt thự hoàn chỉnh dành riêng cho nhóm của bạn, gồm phòng khách riêng, khu ngủ cao cấp, sân hiên hoặc ban công riêng, dịch vụ quản gia và sức chứa tối đa 8 khách.', 'ACTIVE', 'DEMO_SEED', 'DEMO_SEED', NOW(6), NOW(6));

UPDATE room_types
SET marketing_tagline = CASE id
        WHEN 'RT001' THEN 'Ánh sáng tự nhiên ngập tràn & phong vị nghỉ dưỡng thanh bình'
        WHEN 'RT002' THEN 'Ánh sáng tự nhiên ngập tràn & phong vị nghỉ dưỡng thanh bình'
        WHEN 'RT003' THEN 'Ban công riêng hướng vịnh ngọc & bồn tắm thảo mộc thư thái'
        WHEN 'RT004' THEN 'Ban công riêng hướng vịnh ngọc & bồn tắm thảo mộc thư thái'
        WHEN 'RT005' THEN 'Tầm nhìn biển thoáng đạt, bồn đá cẩm thạch & ban công đón nắng'
        WHEN 'RT006' THEN 'Tầm nhìn biển thoáng đạt, bồn đá cẩm thạch & ban công đón nắng'
        WHEN 'RT007' THEN 'Phòng khách biệt lập, ban công hoàng hôn & quản gia tận tâm'
        WHEN 'RT008' THEN 'Phòng khách biệt lập, ban công hoàng hôn & quản gia tận tâm'
        WHEN 'RT009' THEN 'Hồ bơi vô cực biệt lập, quản gia 24/7 & xe đưa đón độc quyền'
    END,
    gallery_image_urls = CASE
        WHEN room_type_code = 'STD' THEN 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'SUP' THEN 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'DLX' THEN 'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=900&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'SUT' THEN 'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=900&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1578898886225-c7c894047899?w=1200&h=750&fit=crop&auto=format\nhttps://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'VIP' THEN 'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg\nhttps://www.robbreport.com.sg/storage/2022/10/DPSAZ-P0442-Beach-Villa.16x9.jpg\nhttps://luxesocietyasia.com/wp-content/uploads/2020/03/One-Bedroom-Beachfront-Villa-Pool.jpg'
    END;

INSERT INTO rooms (id, room_type_id, status, description, name, floor, version) VALUES
('501', 'RT001', 'available', 'STD đơn · tầng 5', '501', 5, 0), ('502', 'RT002', 'available', 'STD đôi · tầng 5', '502', 5, 0), ('503', 'RT003', 'available', 'SUP đơn · tầng 5', '503', 5, 0), ('504', 'RT004', 'available', 'SUP đôi · tầng 5', '504', 5, 0),
('601', 'RT001', 'available', 'STD đơn · tầng 6', '601', 6, 0), ('602', 'RT002', 'cleaning', 'STD đôi · tầng 6', '602', 6, 0), ('603', 'RT003', 'available', 'SUP đơn · tầng 6', '603', 6, 0), ('604', 'RT004', 'available', 'SUP đôi · tầng 6', '604', 6, 0),
('701', 'RT001', 'available', 'STD đơn · tầng 7', '701', 7, 0), ('702', 'RT002', 'maintenance', 'STD đôi · tầng 7', '702', 7, 0), ('703', 'RT003', 'available', 'SUP đơn · tầng 7', '703', 7, 0), ('704', 'RT004', 'available', 'SUP đôi · tầng 7', '704', 7, 0),
('801', 'RT001', 'available', 'STD đơn · tầng 8', '801', 8, 0), ('802', 'RT002', 'reserved', 'STD đôi · tầng 8', '802', 8, 0), ('803', 'RT003', 'available', 'SUP đơn · tầng 8', '803', 8, 0), ('804', 'RT004', 'available', 'SUP đôi · tầng 8', '804', 8, 0),
('901', 'RT003', 'available', 'SUP đơn · tầng 9', '901', 9, 0), ('902', 'RT004', 'available', 'SUP đôi · tầng 9', '902', 9, 0), ('903', 'RT005', 'available', 'DLX King · tầng 9', '903', 9, 0), ('904', 'RT006', 'available', 'DLX Family · tầng 9', '904', 9, 0),
('1001', 'RT003', 'available', 'SUP đơn · tầng 10', '1001', 10, 0), ('1002', 'RT004', 'available', 'SUP đôi · tầng 10', '1002', 10, 0), ('1003', 'RT005', 'available', 'DLX King · tầng 10', '1003', 10, 0), ('1004', 'RT006', 'available', 'DLX Family · tầng 10', '1004', 10, 0),
('1101', 'RT004', 'available', 'SUP đôi · tầng 11', '1101', 11, 0), ('1102', 'RT005', 'available', 'DLX King · tầng 11', '1102', 11, 0), ('1103', 'RT006', 'available', 'DLX Family · tầng 11', '1103', 11, 0), ('1104', 'RT007', 'available', 'Suite Residence · tầng 11', '1104', 11, 0),
('1201', 'RT004', 'available', 'SUP đôi · tầng 12', '1201', 12, 0), ('1202', 'RT005', 'available', 'DLX King · tầng 12', '1202', 12, 0), ('1203', 'RT006', 'available', 'DLX Family · tầng 12', '1203', 12, 0), ('1204', 'RT007', 'available', 'Suite Residence · tầng 12', '1204', 12, 0),
('1301', 'RT005', 'available', 'DLX King · tầng 13', '1301', 13, 0), ('1302', 'RT006', 'available', 'DLX Family · tầng 13', '1302', 13, 0), ('1303', 'RT007', 'available', 'Suite Residence · tầng 13', '1303', 13, 0), ('1304', 'RT008', 'available', 'Suite Executive · tầng 13', '1304', 13, 0),
('1401', 'RT005', 'available', 'DLX King · tầng 14', '1401', 14, 0), ('1402', 'RT006', 'available', 'DLX Family · tầng 14', '1402', 14, 0), ('1403', 'RT007', 'available', 'Suite Residence · tầng 14', '1403', 14, 0), ('1404', 'RT008', 'available', 'Suite Executive · tầng 14', '1404', 14, 0),
('1501', 'RT005', 'available', 'DLX King · tầng 15', '1501', 15, 0), ('1502', 'RT006', 'available', 'DLX Family · tầng 15', '1502', 15, 0), ('1503', 'RT007', 'available', 'Suite Residence · tầng 15', '1503', 15, 0), ('1504', 'RT008', 'available', 'Suite Executive · tầng 15', '1504', 15, 0),
('1601', 'RT005', 'available', 'DLX King · tầng 16', '1601', 16, 0), ('1602', 'RT006', 'available', 'DLX Family · tầng 16', '1602', 16, 0), ('1603', 'RT007', 'available', 'Suite Residence · tầng 16', '1603', 16, 0), ('1604', 'RT008', 'available', 'Suite Executive · tầng 16', '1604', 16, 0),
('1701', 'RT006', 'available', 'DLX Family · tầng 17', '1701', 17, 0), ('1702', 'RT007', 'available', 'Suite Residence · tầng 17', '1702', 17, 0), ('1703', 'RT008', 'available', 'Suite Executive · tầng 17', '1703', 17, 0), ('1704', 'RT009', 'available', 'VIP nguyên căn · tầng 17', '1704', 17, 0),
('1801', 'RT006', 'available', 'DLX Family · tầng 18', '1801', 18, 0), ('1802', 'RT007', 'available', 'Suite Residence · tầng 18', '1802', 18, 0), ('1803', 'RT008', 'available', 'Suite Executive · tầng 18', '1803', 18, 0), ('1804', 'RT009', 'available', 'VIP nguyên căn · tầng 18', '1804', 18, 0),
('1901', 'RT006', 'available', 'DLX Family · tầng 19', '1901', 19, 0), ('1902', 'RT007', 'available', 'Suite Residence · tầng 19', '1902', 19, 0), ('1903', 'RT008', 'available', 'Suite Executive · tầng 19', '1903', 19, 0), ('1904', 'RT009', 'available', 'VIP nguyên căn · tầng 19', '1904', 19, 0),
('2001', 'RT006', 'available', 'DLX Family · tầng 20', '2001', 20, 0), ('2002', 'RT007', 'available', 'Suite Residence · tầng 20', '2002', 20, 0), ('2003', 'RT008', 'available', 'Suite Executive · tầng 20', '2003', 20, 0), ('2004', 'RT009', 'available', 'VIP nguyên căn · tầng 20', '2004', 20, 0);

-- Nội dung quảng cáo và gallery được gắn theo từng phòng, không dùng chung theo loại phòng.
UPDATE rooms r
JOIN room_types t ON t.id = r.room_type_id
SET r.description = CONCAT(
    'Phòng ', r.name, ' tại tầng ', r.floor, ' mang đến ',
    CASE MOD(CAST(r.name AS UNSIGNED), 4)
        WHEN 0 THEN 'góc nhìn rộng mở và không gian yên tĩnh cho kỳ nghỉ riêng tư. '
        WHEN 1 THEN 'ánh sáng tự nhiên dịu nhẹ cùng góc nghỉ hướng thành phố. '
        WHEN 2 THEN 'không gian thoáng đãng, phù hợp cho những ngày nghỉ thư thái. '
        ELSE 'cảm giác ấm cúng với tầm nhìn đẹp và nhịp nghỉ dưỡng thanh bình. '
    END,
    CASE t.room_type_code
        WHEN 'STD' THEN 'Thiết kế tiêu chuẩn gọn gàng, giường ngủ êm ái và đầy đủ tiện nghi thiết yếu cho chuyến lưu trú thoải mái.'
        WHEN 'SUP' THEN 'Diện tích rộng rãi hơn, nội thất nâng cấp và khu vực nghỉ ngơi tiện nghi cho gia đình hoặc nhóm bạn.'
        WHEN 'DLX' THEN 'Không gian cao cấp với khu vực thư giãn riêng, trang thiết bị chọn lọc và trải nghiệm nghỉ dưỡng sang trọng.'
        WHEN 'SUT' THEN 'Phòng khách biệt lập, ban công riêng và tiện nghi cao cấp dành cho kỳ nghỉ dài ngày hoặc những dịp đặc biệt.'
        WHEN 'VIP' THEN 'Không gian nguyên căn riêng tư với phòng khách, ban công rộng và dịch vụ đón tiếp độc quyền.'
        ELSE 'Không gian lưu trú được chuẩn bị chỉn chu với các tiện nghi cần thiết cho khách nghỉ dưỡng.'
    END,
    ' Mã phòng: ', r.name, '.'
);

INSERT INTO room_images
    (room_id, relative_path, display_order, cover, content_type, size_bytes, active)
SELECT r.id,
       CONCAT(
           'https://images.unsplash.com/photo-',
           CASE t.room_type_code
               WHEN 'STD' THEN CASE gallery.image_no
                   WHEN 0 THEN '1584622650111-993a426fbf0a'
                   WHEN 1 THEN '1582719478250-c89cae4dc85b'
                   ELSE '1566665797739-1674de7a421a'
               END
               WHEN 'SUP' THEN CASE gallery.image_no
                   WHEN 0 THEN '1618773928121-c32242e63f39'
                   WHEN 1 THEN '1590490360182-c33d57733427'
                   ELSE '1578683010236-d716f9a3f461'
               END
               WHEN 'DLX' THEN CASE gallery.image_no
                   WHEN 0 THEN '1591088398332-8a7791972843d'
                   WHEN 1 THEN '1618773928121-c32242e63f39'
                   ELSE '1564078516393-cf04bd966897'
               END
               WHEN 'SUT' THEN CASE gallery.image_no
                   WHEN 0 THEN '1629140727571-9b5c6f6267b4'
                   WHEN 1 THEN '1578898886225-c7c894047899'
                   ELSE '1507652313519-d4e9174996dd'
               END
               ELSE CASE gallery.image_no
                   WHEN 0 THEN '1571896349842-33c89424de2d'
                   WHEN 1 THEN '1540541338287-41700207dee6'
                   ELSE '1520250497591-112f2f40a3f4'
               END
           END,
           '?w=1200&h=800&fit=crop&auto=format&room=', r.id,
           '&view=', gallery.image_no + 1
       ),
       gallery.image_no,
       gallery.image_no = 0,
       'image/jpeg',
       1,
       TRUE
FROM rooms r
JOIN room_types t ON t.id = r.room_type_id
CROSS JOIN (
    SELECT 0 AS image_no
    UNION ALL SELECT 1
    UNION ALL SELECT 2
    UNION ALL SELECT 3
) gallery;

INSERT INTO amenities (name, active) VALUES
('WiFi', TRUE), ('Điều hòa', TRUE), ('TV 4K', TRUE), ('Minibar', TRUE),
('Két an toàn', TRUE), ('Bồn tắm', TRUE), ('Máy pha cà phê', TRUE),
('Ban công', TRUE), ('Phòng khách riêng', TRUE), ('Quản gia riêng', TRUE),
('Bàn làm việc', TRUE), ('Sofa thư giãn', TRUE), ('Bếp nhỏ', TRUE), ('Dịch vụ quản gia 24/7', TRUE);

INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT 'RT001', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bàn làm việc')
UNION ALL SELECT 'RT002', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bàn làm việc')
UNION ALL SELECT 'RT003', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Bàn làm việc')
UNION ALL SELECT 'RT004', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Bàn làm việc')
UNION ALL SELECT 'RT005', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Bàn làm việc', 'Sofa thư giãn')
UNION ALL SELECT 'RT006', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Bàn làm việc', 'Sofa thư giãn')
UNION ALL SELECT 'RT007', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Ban công', 'Phòng khách riêng', 'Sofa thư giãn')
UNION ALL SELECT 'RT008', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Ban công', 'Phòng khách riêng', 'Sofa thư giãn')
UNION ALL SELECT 'RT009', id FROM amenities WHERE name IN ('WiFi', 'Điều hòa', 'TV 4K', 'Minibar', 'Két an toàn', 'Bồn tắm', 'Máy pha cà phê', 'Ban công', 'Phòng khách riêng', 'Quản gia riêng', 'Dịch vụ quản gia 24/7', 'Sofa thư giãn');

INSERT INTO guests
(full_name, address, phone, email, identity_number, birth_year, membership_tier,
 total_spend, late_cancellation_count, completed_stays, late_checkout_count, booking_blocked, version)
VALUES
('Nguyễn Văn An', 'Quận 1, TP.HCM', '0901234567', 'an.nguyen@example.test', '012345678901',
 1990, 'STANDARD', 0.00, 0, 0, 0, FALSE, 0),
('Trần Thị Bình', 'Quận 3, TP.HCM', '0912345678', 'binh.tran@example.test', '098765432109',
 1988, 'PLATINUM', 12000000.00, 0, 4, 0, FALSE, 0),
('Lê Hoàng Cường', 'Quận 7, TP.HCM', '0923456789', 'cuong.le@example.test', '112233445566',
 1995, 'STANDARD', 500000.00, 1, 1, 0, FALSE, 0);

-- BCrypt cost 12 for plaintext password: hotel123
INSERT INTO customer_accounts (guest_id, phone, password, enabled, account_non_locked)
SELECT id, phone, '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', TRUE, TRUE
FROM guests WHERE phone = '0901234567';

-- Demo employee identities. BCrypt cost 12 for plaintext password: hotel123
-- These are real backend accounts used by the role-specific frontend portals.
INSERT INTO employees
    (id, full_name, password, position, address, phone, enabled, account_non_locked,
     failed_login_attempts, employment_status)
VALUES
    ('FRONTDESK', 'Nguyễn Minh Lễ Tân', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'FRONT_DESK', 'TP.HCM', '0902000001', TRUE, TRUE, 0, 'WORKING'),
    ('HOUSEKEEP', 'Trần Thị Buồng Phòng', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'HOUSEKEEPING', 'TP.HCM', '0902000002', TRUE, TRUE, 0, 'WORKING'),
    ('TECHNICAL', 'Lê Hoàng Kỹ Thuật', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'TECHNICAL', 'TP.HCM', '0902000003', TRUE, TRUE, 0, 'WORKING'),
    ('ACCOUNTING', 'Phạm Thị Kế Toán', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'ACCOUNTING', 'TP.HCM', '0902000004', TRUE, TRUE, 0, 'WORKING'),
    ('KITCHEN', 'Võ Minh Bếp', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'KITCHEN', 'TP.HCM', '0902000005', TRUE, TRUE, 0, 'WORKING'),
    ('MANAGER', 'Hoàng Minh Quản', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'MANAGER', 'TP.HCM', '0902000006', TRUE, TRUE, 0, 'WORKING'),
    ('DIRECTOR', 'Đỗ Thanh Giám Đốc', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'DIRECTOR', 'TP.HCM', '0902000007', TRUE, TRUE, 0, 'WORKING'),
    ('ADMIN', 'Quản Trị Hệ Thống', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'ADMIN', 'TP.HCM', '0902000008', TRUE, TRUE, 0, 'WORKING'),
    ('HR', 'Nguyễn Thị Nhân Sự', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'HR', 'TP.HCM', '0902000009', TRUE, TRUE, 0, 'WORKING'),
    ('STAFF', 'Nhân Viên Vận Hành', '$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 'STAFF', 'TP.HCM', '0902000010', TRUE, TRUE, 0, 'WORKING')
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name), password = VALUES(password), position = VALUES(position),
    address = VALUES(address), phone = VALUES(phone), enabled = TRUE,
    account_non_locked = TRUE, failed_login_attempts = 0, employment_status = 'WORKING';

INSERT INTO services
(id, name, price, unit, stock_quantity, safety_threshold, active, category, description, image_url)
VALUES
('BREAKFAST', 'Bữa sáng thượng hạng tại phòng', 450000.00, 'suất', 999, 0, TRUE, 'inroom',
 'Bữa sáng Âu–Á cao cấp phục vụ tận phòng, kèm trà và nước ép tươi.',
 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop&auto=format'),
('ROOM24', 'Dịch vụ phòng 24/7', 0.00, '', 999, 0, TRUE, 'inroom',
 'Thực đơn đa dạng phục vụ tận phòng bất kỳ lúc nào trong ngày và đêm.',
 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&h=400&fit=crop&auto=format'),
('MINIBAR', 'Bổ sung minibar trong phòng', 180000.00, 'set', 999, 0, TRUE, 'inroom',
 'Nước uống, cà phê, trà và đồ ăn nhẹ bổ sung theo yêu cầu.',
 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&h=400&fit=crop&auto=format'),
('EXTRABED', 'Thêm giường phụ', 350000.00, 'đêm', 20, 2, TRUE, 'inroom',
 'Giường phụ tiêu chuẩn khách sạn, phù hợp gia đình và nhóm đông.',
 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=400&fit=crop&auto=format'),
('LNDRYEXP', 'Giặt ủi tận phòng · 4 giờ', 120000.00, 'món', 999, 0, TRUE, 'inroom',
 'Nhận đồ tại phòng, giặt hấp, là phẳng và hoàn trả trong 4 giờ.',
 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=600&h=400&fit=crop&auto=format'),
('LNDRYSTD', 'Giặt ủi tận phòng · Qua đêm', 80000.00, 'lần', 999, 0, TRUE, 'inroom',
 'Nhận trước 22:00 và hoàn trả vào sáng hôm sau trước 8:00.',
 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&h=400&fit=crop&auto=format'),
('PRESSING', 'Ủi nhanh tại phòng', 60000.00, 'món', 999, 0, TRUE, 'inroom',
 'Làm phẳng trang phục công tác hoặc dạ tiệc trong thời gian ngắn.',
 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&h=400&fit=crop&auto=format'),
('MAMREST', 'MaM Restaurant', 250000.00, 'suất', 999999, 0, TRUE, 'fine-dining',
 'Bữa trưa hoặc bữa tối tại MaM Restaurant. Khách thuê theo gói ngày-đêm được miễn một bữa trưa và một bữa tối mỗi ngày cho từng khách trong booking.',
 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=520&fit=crop&auto=format'),
('DECOR', 'Set trang trí Lãng mạn / Kỷ niệm', 1200000.00, 'bộ', 30, 5, TRUE, 'fine-dining',
 'Hoa tươi, nến thơm, champagne và thảm cánh hoa hồng cho dịp đặc biệt.',
 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop&auto=format'),
('SPAMASS', 'Liệu trình Massage Thư giãn', 980000.00, 'lượt', 999, 0, TRUE, 'spa',
 'Massage toàn thân 60 phút với tinh dầu thiên nhiên, giúp phục hồi năng lượng.',
 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop&auto=format'),
('SPAFACIAL', 'Chăm sóc da mặt cao cấp', 1350000.00, 'lượt', 999, 0, TRUE, 'spa',
 'Liệu trình 75 phút làm sạch sâu, dưỡng ẩm và trẻ hóa da.',
 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop&auto=format'),
('STEAM', 'Xông hơi & Sauna', 500000.00, 'lượt', 999, 0, TRUE, 'spa',
 'Khu xông hơi khô, ướt và phòng thư giãn với liệu trình theo giờ.',
 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&h=520&fit=crop&auto=format'),
('LIMO', 'Xe đưa đón sân bay VIP Limousine', 850000.00, 'chuyến', 999, 0, TRUE, 'transport',
 'Xe cao cấp với tài xế riêng, đón và tiễn sân bay Tân Sơn Nhất.',
 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=400&fit=crop&auto=format'),
('CITYTOUR', 'Tour thành phố Sài Gòn – Nửa ngày', 650000.00, 'khách', 999, 0, TRUE, 'transport',
 'Tham quan các địa danh nổi bật cùng hướng dẫn viên địa phương.',
 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&h=400&fit=crop&auto=format'),
('POOL', 'Hồ bơi vô cực & Jacuzzi', 200000.00, 'khách/ngày', 999, 0, TRUE, 'recreation',
 'Tầng 21 · Miễn phí không giới hạn lượt cho khách đã đăng ký trong booking thuê theo gói ngày-đêm. Khách thuê theo giờ trả 200.000 đồng mỗi khách mỗi ngày.',
 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=600&h=400&fit=crop&auto=format'),
('GYM', 'Trung tâm Thể dục & Thể hình', 100000.00, 'khách/ngày', 999, 0, TRUE, 'recreation',
 'Tầng 3–4 · Thiết bị tập luyện cao cấp, huấn luyện viên theo yêu cầu và lớp yoga hằng ngày.',
 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop&auto=format'),
('TENNIS', 'Sân Tennis & Cầu lông', 200000.00, 'giờ', 999, 0, TRUE, 'recreation',
 'Sân thể thao có đèn chiếu sáng, hỗ trợ thuê vợt và bóng.',
 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&h=400&fit=crop&auto=format'),
('PINGPONG', 'Bóng bàn', 100000.00, 'giờ', 999, 0, TRUE, 'recreation',
 'Không gian bóng bàn trong nhà, phù hợp giải trí nhẹ và hoạt động nhóm.',
 'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=800&h=520&fit=crop&auto=format'),
('BADMINTON', 'Cầu lông', 150000.00, 'giờ', 999, 0, TRUE, 'recreation',
 'Sân cầu lông tiêu chuẩn, có thể thuê vợt và cầu tại quầy tiện ích.',
 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=520&fit=crop&auto=format'),
('MEETING', 'Phòng họp & Hội nghị', 2500000.00, 'ngày', 999, 0, TRUE, 'business',
 'Tầng 4 · Phòng họp đa năng cho 10–200 người, trang bị AV 4K và WiFi tốc độ cao.',
 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop&auto=format'),
('EVENT', 'Tổ chức Tiệc cưới & Sự kiện', 0.00, '', 999, 0, TRUE, 'business',
 'Sảnh Grand Ballroom cho 500 khách cùng đội ngũ tổ chức sự kiện chuyên nghiệp.',
 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&h=400&fit=crop&auto=format'),
('BALLROOM', 'Nhà hàng tiệc cưới Grand Ballroom', 0.00, '', 999, 0, FALSE, 'business',
 'Tầng 4 · Sảnh tiệc cho tiệc cưới, gala dinner và sự kiện thương hiệu.',
 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&h=520&fit=crop&auto=format'),
('BOARDROOM', 'Phòng họp Executive', 3500000.00, 'ngày', 999, 0, TRUE, 'business',
 'Phòng họp riêng cho ban điều hành, có màn hình trình chiếu và phục vụ tea-break.',
 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=520&fit=crop&auto=format');

UPDATE services SET active=FALSE WHERE id IN ('ROOM24', 'EVENT');


-- End-to-end demo transactions. These rows deliberately cover the states shown by
-- the customer portal, front desk, accounting, housekeeping, technical and manager screens.
INSERT INTO reservations
    (id, guest_id, employee_id, customer_account_id, booked_at, deposit_amount, status, rental_type,
     actual_check_in, actual_check_out, extension_minutes, idempotency_key, version,
     deposit_payment_code, deposit_payment_expires_at, deposit_payment_status)
VALUES
    (1, 1, 'FRONTDESK', (SELECT id FROM customer_accounts WHERE phone = '0901234567'),
     DATE_SUB(NOW(), INTERVAL 2 DAY), 1000000.00, 'CHECKED_IN', 'PACKAGE',
     TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '14:00:00'), NULL, 0, 'DEMO-RES-001', 0,
     NULL, NULL, 'PAID'),
    (2, 2, 'FRONTDESK', NULL,
     DATE_SUB(NOW(), INTERVAL 3 DAY), 0.00, 'CONFIRMED', 'PACKAGE',
     NULL, NULL, 0, 'DEMO-RES-002', 0,
     NULL, NULL, 'NOT_REQUIRED'),
    (3, 3, 'FRONTDESK', NULL,
     DATE_SUB(NOW(), INTERVAL 2 DAY), 0.00, 'CHECKED_IN', 'PACKAGE',
     TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '14:00:00'), NULL, 0, 'DEMO-RES-003', 0,
     NULL, NULL, 'NOT_REQUIRED'),
    (4, 2, 'FRONTDESK', NULL,
     DATE_SUB(NOW(), INTERVAL 7 DAY), 2900000.00, 'CHECKED_OUT', 'PACKAGE',
     TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '14:00:00'),
     TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '11:30:00'), 0, 'DEMO-RES-004', 0,
     NULL, NULL, 'PAID'),
    (5, 1, NULL, (SELECT id FROM customer_accounts WHERE phone = '0901234567'),
     NOW(), 270000.00, 'DRAFT', 'HOURLY',
     NULL, NULL, 0, 'DEMO-RES-005', 0,
     'DEMO-DEP-005', DATE_ADD(NOW(), INTERVAL 7 DAY), 'PENDING'),
    (6, 1, NULL, (SELECT id FROM customer_accounts WHERE phone = '0901234567'),
     NOW(), 3900000.00, 'DEPOSIT_PAID', 'PACKAGE',
     NULL, NULL, 0, 'DEMO-RES-006', 0,
     'DEMO-DEP-006', DATE_ADD(NOW(), INTERVAL 7 DAY), 'PAID');

INSERT INTO reservation_rooms
    (reservation_id, room_id, check_in, check_out, original_check_out, status, transfer_count, guest_count)
VALUES
    (1, '501', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '14:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '12:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '12:00:00'), 'occupied', 0, 2),
    (2, '502', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'), 'reserved', 0, 1),
    (3, '601', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '14:00:00'), TIMESTAMP(CURDATE(), '12:00:00'), TIMESTAMP(CURDATE(), '12:00:00'), 'occupied', 0, 1),
    (4, '701', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '14:00:00'), TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '12:00:00'), TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '12:00:00'), 'returned', 0, 2),
    (5, '801', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '18:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '18:00:00'), 'reserved', 0, 1),
    (6, '1401', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'), TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'), 'reserved', 0, 2);

UPDATE rooms SET status = CASE id
    WHEN '501' THEN 'occupied'
    WHEN '502' THEN 'reserved'
    WHEN '601' THEN 'occupied'
    WHEN '602' THEN 'cleaning'
    WHEN '701' THEN 'cleaning'
    WHEN '702' THEN 'maintenance'
    WHEN '801' THEN 'reserved'
    WHEN '802' THEN 'available'
    ELSE status
END;

INSERT INTO service_usages (reservation_id, service_id, used_on, quantity, unit_price) VALUES
    (1, 'BREAKFAST', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 2, 0.00),
    (1, 'SPAMASS', CURDATE(), 1, 980000.00),
    (3, 'BREAKFAST', CURDATE(), 1, 0.00),
    (4, 'SPAFACIAL', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 1, 1350000.00);

INSERT INTO hotel_service_bookings
    (reservation_id, room_id, service_id, scheduled_at, meal_period, quantity, free_quantity,
     unit_price, status, request_key, request_hash, created_by, used_at, used_by)
VALUES
    (1, '501', 'MAMREST', TIMESTAMP(CURDATE(), '12:00:00'), 'LUNCH', 2, 2,
     250000.00, 'USED', 'DEMO-SERVICE-001', REPEAT('0', 64), 'FRONTDESK', NOW(), 'FRONTDESK'),
    (6, '1401', 'SPAMASS', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:00:00'), NULL, 1, 0,
     980000.00, 'CONFIRMED', 'DEMO-SERVICE-002', REPEAT('0', 64), 'customer:1', NULL, NULL);

INSERT INTO invoices
    (id, reservation_id, issued_at, discount, deposit_paid, payment_method, status,
     room_total, service_total, amount_due, surcharge, compensation, extension_fee, adjustment_total, version)
VALUES
    (1, 1, NOW(), 0.00, 1000000.00, 'CASH', 'CHUA_THANH_TOAN', 2400000.00, 980000.00, 2380000.00, 0.00, 0.00, 0.00, 0.00, 0),
    (3, 3, NOW(), 0.00, 0.00, 'CASH', 'CHUA_THANH_TOAN', 1900000.00, 0.00, 1200000.00, 0.00, 300000.00, 0.00, 0.00, 0),
    (4, 4, DATE_SUB(NOW(), INTERVAL 2 DAY), 710000.00, 2900000.00, 'CARD', 'DA_THANH_TOAN', 5800000.00, 1350000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0);

INSERT INTO payment_transactions
    (id, invoice_id, amount, method, type, status, reference, occurred_at, actor_id, idempotency_key, external_event_id)
VALUES
    (1, 1, 1000000.00, 'CASH', 'PAYMENT', 'COMPLETED', 'DEPOSIT:1', DATE_SUB(NOW(), INTERVAL 1 DAY), 'FRONTDESK', 'DEMO-PAY-001', NULL),
    (2, 3, 1000000.00, 'CASH', 'PAYMENT', 'COMPLETED', 'PAY:3:PARTIAL', DATE_SUB(NOW(), INTERVAL 1 HOUR), 'FRONTDESK', 'DEMO-PAY-002', NULL),
    (3, 4, 2900000.00, 'BANK_TRANSFER', 'PAYMENT', 'COMPLETED', 'DEPOSIT:4', DATE_SUB(NOW(), INTERVAL 5 DAY), 'FRONTDESK', 'DEMO-PAY-003', NULL),
    (4, 4, 3540000.00, 'CARD', 'PAYMENT', 'COMPLETED', 'FINAL:4', DATE_SUB(NOW(), INTERVAL 2 DAY), 'ACCOUNTING', 'DEMO-PAY-004', NULL);

INSERT INTO receipts
    (id, receipt_number, invoice_id, amount, method, issued_at, issued_by)
VALUES
    (1, 'DEP-DEMO-001', 1, 1000000.00, 'CASH', DATE_SUB(NOW(), INTERVAL 1 DAY), 'FRONTDESK'),
    (2, 'RCPT-DEMO-003', 3, 1000000.00, 'CASH', DATE_SUB(NOW(), INTERVAL 1 HOUR), 'FRONTDESK'),
    (3, 'DEP-DEMO-004', 4, 2900000.00, 'BANK_TRANSFER', DATE_SUB(NOW(), INTERVAL 5 DAY), 'FRONTDESK'),
    (4, 'RCPT-DEMO-004', 4, 3540000.00, 'CARD', DATE_SUB(NOW(), INTERVAL 2 DAY), 'ACCOUNTING');

INSERT INTO room_equipment
    (id, room_id, name, original_value, purchased_on, quantity, active)
VALUES
    (1, '501', 'Minibar', 6500000.00, DATE_SUB(CURDATE(), INTERVAL 18 MONTH), 1, TRUE),
    (2, '501', 'TV 4K', 12000000.00, DATE_SUB(CURDATE(), INTERVAL 12 MONTH), 1, TRUE),
    (3, '601', 'Máy sấy tóc', 800000.00, DATE_SUB(CURDATE(), INTERVAL 10 MONTH), 1, TRUE),
    (4, '602', 'Điều hòa', 18000000.00, DATE_SUB(CURDATE(), INTERVAL 14 MONTH), 1, TRUE),
    (5, '702', 'Điều hòa', 22000000.00, DATE_SUB(CURDATE(), INTERVAL 20 MONTH), 1, TRUE),
    (6, '702', 'Két an toàn', 9000000.00, DATE_SUB(CURDATE(), INTERVAL 15 MONTH), 1, TRUE);

INSERT INTO equipment_incidents
    (id, reservation_id, room_id, equipment_name, original_value, purchased_on, quantity, compensation,
     created_at, severity, handoff_status, handoff_note)
VALUES
    (1, 3, '601', 'Máy sấy tóc', 800000.00, DATE_SUB(CURDATE(), INTERVAL 10 MONTH), 1, 300000.00,
     NOW(), 'MEDIUM', 'OPEN', 'Chờ lễ tân xác nhận bồi thường khi khách trả phòng.');

INSERT INTO inventory_movements
    (id, service_id, type, quantity, actor_id, occurred_at, reason)
VALUES
    (1, 'BREAKFAST', 'RECEIVE', 20, 'KITCHEN', DATE_SUB(NOW(), INTERVAL 3 DAY), 'Nhập nguyên liệu bữa sáng demo'),
    (2, 'BREAKFAST', 'ISSUE', 2, 'KITCHEN', DATE_SUB(NOW(), INTERVAL 1 DAY), 'Phục vụ booking DEMO-RES-001'),
    (3, 'SPAMASS', 'RECEIVE', 10, 'KITCHEN', DATE_SUB(NOW(), INTERVAL 4 DAY), 'Nhập dầu massage demo'),
    (4, 'SPAFACIAL', 'ISSUE', 1, 'KITCHEN', DATE_SUB(NOW(), INTERVAL 3 DAY), 'Phục vụ booking DEMO-RES-004'),
    (5, 'DECOR', 'WASTE', 1, 'KITCHEN', DATE_SUB(NOW(), INTERVAL 2 DAY), 'Hao hụt vật tư trang trí');

UPDATE services SET stock_quantity = CASE id
    WHEN 'BREAKFAST' THEN 1017
    WHEN 'SPAMASS' THEN 1009
    WHEN 'SPAFACIAL' THEN 998
    WHEN 'DECOR' THEN 29
    ELSE stock_quantity
END;

INSERT INTO cash_shift_handovers
    (id, shift_code, from_actor, to_actor, expected_amount, actual_amount, variance, handed_over_at, note)
VALUES
    (1, 'MORNING', 'FRONTDESK', 'ACCOUNTING', 12500000.00, 12500000.00, 0.00, NOW(), 'Bàn giao ca sáng đủ quỹ.'),
    (2, 'NIGHT', 'FRONTDESK', 'ACCOUNTING', 8300000.00, 8250000.00, -50000.00, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Lệch quỹ cần đối soát cuối ca.');

INSERT INTO expenses
    (id, category, description, amount, paid_by, paid_at, status)
VALUES
    (1, 'Vệ sinh', 'Mua hóa chất và vật tư buồng phòng tháng này', 2350000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 2 DAY), 'APPROVED'),
    (2, 'Bảo trì', 'Thay linh kiện điều hòa phòng 702', 4800000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 1 DAY), 'RECORDED'),
    (3, 'Marketing', 'In tài liệu giới thiệu dịch vụ MaM Hotel', 1250000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 4 DAY), 'APPROVED');

INSERT INTO partner_debts
    (id, partner_name, reference_code, amount, settled_amount, status, recorded_at)
VALUES
    (1, 'Nhà cung cấp thực phẩm MaM', 'DEMO-SUPPLIER-FNB-09', 53000000.00, 0.00, 'OPEN', NOW()),
    (2, 'Nhà cung cấp vật tư spa MaM', 'DEMO-SUPPLIER-SPA-09', 73000000.00, 12000000.00, 'PARTIALLY_SETTLED', DATE_SUB(NOW(), INTERVAL 2 DAY));

INSERT INTO partner_debt_settlements
    (id, partner_debt_id, amount, settled_by, settled_at, note)
VALUES
    (1, 2, 12000000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 1 DAY), 'Đã thanh toán nhà cung cấp đợt 1.');

INSERT INTO financial_ledger_entries
    (id, entry_type, source_type, source_id, direction, amount, actor_id, occurred_at, note, finalized)
VALUES
    (1, 'PAYMENT_RECEIVED', 'PAYMENT_TRANSACTION', '1', 'DEBIT', 1000000.00, 'FRONTDESK', DATE_SUB(NOW(), INTERVAL 1 DAY), 'Thu cọc booking demo.', TRUE),
    (2, 'PAYMENT_RECEIVED', 'PAYMENT_TRANSACTION', '4', 'DEBIT', 3540000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 2 DAY), 'Thu phần còn lại hóa đơn demo.', TRUE),
    (3, 'EXPENSE_RECORDED', 'EXPENSE', '1', 'CREDIT', 2350000.00, 'ACCOUNTING', DATE_SUB(NOW(), INTERVAL 2 DAY), 'Chi vật tư vệ sinh demo.', TRUE);


INSERT INTO membership_history
    (id, guest_id, from_tier, to_tier, reason, changed_at)
VALUES
    (1, 2, 'STANDARD', 'PLATINUM', 'Đạt mốc doanh thu và số đêm lưu trú demo.', DATE_SUB(NOW(), INTERVAL 30 DAY));

INSERT INTO approval_requests
    (id, requester, action, target_id, mutation_payload, payload_fingerprint, amount, correlation_key,
     reason, risk, requested_at, status, approver, decided_at, expires_at, consumed_at)
VALUES
    (1, 'KITCHEN', 'SERVICE_PRICE_CHANGE', 'SPAMASS',
     '{"service_id":"SPAMASS","price":1100000,"reason":"Giá mùa cao điểm"}',
     SHA2('{"service_id":"SPAMASS","price":1100000,"reason":"Giá mùa cao điểm"}', 256),
     1100000.00, 'DEMO-APP-001', 'Điều chỉnh giá massage mùa cao điểm.', 'MEDIUM', NOW(), 'PENDING', NULL, NULL, DATE_ADD(NOW(), INTERVAL 7 DAY), NULL),
    (2, 'ACCOUNTING', 'BILLING_ADJUSTMENT', '3',
     'delta=-200000|reason=Khách VIP demo',
     SHA2('delta=-200000|reason=Khách VIP demo', 256),
     200000.00, 'DEMO-APP-002', 'Giảm giá hỗ trợ khách VIP sau sự cố dịch vụ.', 'LOW', NOW(), 'PENDING', NULL, NULL, DATE_ADD(NOW(), INTERVAL 7 DAY), NULL);

INSERT INTO maintenance_work_orders
(id, room_id, maintenance_type, scheduled_date, status, description) VALUES
('WO001', '702', 'Sửa điều hòa', '2026-09-25', 'CHUA_XU_LY', 'Điều hòa không làm lạnh'),
('WO002', '602', 'Kiểm tra sau vệ sinh', '2026-09-26', 'DA_HOAN_THANH', 'Kiểm tra phòng sau khi khách trả');

INSERT INTO employee_shifts
    (employee_id, shift_date, shift_code, starts_at, ends_at, status, created_by)
SELECT id, CURDATE(),
       CASE WHEN id IN ('TECHNICAL','ACCOUNTING') THEN 'AFTERNOON' ELSE 'MORNING' END,
       CASE WHEN id IN ('TECHNICAL','ACCOUNTING') THEN TIMESTAMP(CURDATE(), '14:00:00') ELSE TIMESTAMP(CURDATE(), '06:00:00') END,
       CASE WHEN id IN ('TECHNICAL','ACCOUNTING') THEN TIMESTAMP(CURDATE(), '22:00:00') ELSE TIMESTAMP(CURDATE(), '14:00:00') END,
       'STARTED', 'MANAGER'
FROM employees
WHERE id IN ('FRONTDESK','HOUSEKEEP','TECHNICAL','ACCOUNTING','KITCHEN','MANAGER','HR','STAFF');

INSERT INTO housekeeping_tasks
    (room_id, assignee, status, checklist_complete, blocking_incident, note, assigned_by, updated_at)
VALUES
    ('502', 'HOUSEKEEP', 'NEEDS_CLEANING', FALSE, FALSE, 'Chuẩn bị phòng cho lượt khách tiếp theo.', 'MANAGER', NOW(6)),
    ('602', 'HOUSEKEEP', 'IN_PROGRESS', FALSE, FALSE, 'Đang vệ sinh phòng Deluxe.', 'MANAGER', NOW(6)),
    ('702', 'HOUSEKEEP', 'WAITING_TECHNICAL', TRUE, TRUE, 'Chờ kỹ thuật xử lý điều hòa.', 'MANAGER', NOW(6)),
    ('701', 'HOUSEKEEP', 'CLEANED', TRUE, FALSE, 'Đã dọn xong, chờ quản lý kiểm tra cuối.', 'MANAGER', NOW(6));

INSERT INTO housekeeping_checklist_templates (id, name, active) VALUES
    (1, 'Vệ sinh phòng tiêu chuẩn', TRUE),
    (2, 'Kiểm tra minibar', TRUE),
    (3, 'Bàn giao thiết bị sau bảo trì', TRUE);

INSERT INTO housekeeping_checklist_results
    (id, task_id, item, passed, note, completed_by, completed_at)
VALUES
    (1, 2, 'Ga giường và khăn tắm', TRUE, 'Đã thay mới.', 'HOUSEKEEP', NOW(6)),
    (2, 2, 'Minibar và vật dụng phòng', TRUE, 'Đủ số lượng theo tiêu chuẩn.', 'HOUSEKEEP', NOW(6)),
    (3, 3, 'Điều hòa hoạt động bình thường', FALSE, 'Đang chờ kỹ thuật xử lý.', 'HOUSEKEEP', NOW(6)),
    (4, 4, 'Phòng sạch và không còn đồ thất lạc', TRUE, 'Đã kiểm tra.', 'HOUSEKEEP', NOW(6));

INSERT INTO housekeeping_inspections
    (id, task_id, inspection_type, item, quantity, item_condition, note, completed_by, completed_at)
VALUES
    (1, 2, 'MINIBAR', 'Nước suối', 4, 'OK', 'Đủ 4 chai.', 'HOUSEKEEP', NOW()),
    (2, 2, 'MINIBAR', 'Snack', 3, 'REFILLED', 'Đã bổ sung đủ 3 gói.', 'HOUSEKEEP', NOW()),
    (3, 3, 'ROOM_ASSET', 'Điều hòa', 1, 'DAMAGED', 'Không làm lạnh, đã tạo phiếu kỹ thuật.', 'HOUSEKEEP', NOW()),
    (4, 4, 'ROOM_ASSET', 'Không có', 0, 'OK', 'Không phát hiện đồ thất lạc.', 'HOUSEKEEP', NOW());

INSERT INTO technical_work_orders
    (room_id, equipment_id, assignee, priority, sla_due_at, materials, result_note,
     acceptance_note, accepted_by, accepted_at, status, created_by, created_at, updated_at)
VALUES
    ('702', (SELECT id FROM room_equipment WHERE room_id = '702' AND name = 'Điều hòa' LIMIT 1), 'TECHNICAL', 'HIGH', DATE_ADD(NOW(6), INTERVAL 4 HOUR), 'Kiểm tra điều hòa không làm lạnh', NULL, NULL, NULL, NULL, 'IN_PROGRESS', 'MANAGER', NOW(6), NOW(6)),
    ('602', (SELECT id FROM room_equipment WHERE room_id = '602' AND name = 'Điều hòa' LIMIT 1), 'TECHNICAL', 'MEDIUM', DATE_ADD(NOW(6), INTERVAL 1 DAY), 'Kiểm tra thiết bị sau vệ sinh', NULL, NULL, NULL, NULL, 'NEW', 'MANAGER', NOW(6), NOW(6));

-- OTA source/reconciliation demo. DIRECT remains the default for direct bookings.
UPDATE reservations SET booking_source='AGODA', ota_gross_revenue=1650000.00, ota_commission=247500.00,
    ota_net_revenue=1402500.00, ota_reconciliation_status='PENDING' WHERE id=1;
UPDATE reservations SET booking_source='BOOKING_COM', ota_gross_revenue=2450000.00, ota_commission=367500.00,
    ota_net_revenue=2082500.00, ota_reconciliation_status='MATCHED' WHERE id=3;
UPDATE reservations SET booking_source='EXPEDIA', ota_gross_revenue=5800000.00, ota_commission=870000.00,
    ota_net_revenue=4930000.00, ota_reconciliation_status='DISPUTED' WHERE id=4;

INSERT INTO vat_invoices
    (id, invoice_id, vat_invoice_number, tax_rate, taxable_amount, tax_amount, total_amount,
     customer_type, customer_name, tax_code, company_name, company_address, status, xml_status, created_by)
VALUES
    (1, 1, 'VAT-2026-0001', 8.00, 3280000.00, 262400.00, 3542400.00, 'COMPANY', 'Công ty TNHH Minh Anh', '0312345678', 'Công ty TNHH Minh Anh', '12 Nguyễn Huệ, Quận 1, TP.HCM', 'ISSUED', 'NOT_EXPORTED', 'ACCOUNTING'),
    (2, 3, 'VAT-2026-0002', 8.00, 1650000.00, 132000.00, 1782000.00, 'INDIVIDUAL', 'Trần Minh Khang', NULL, NULL, NULL, 'ISSUED', 'NOT_EXPORTED', 'ACCOUNTING'),
    (3, 4, 'VAT-2026-0003', 8.00, 5800000.00, 464000.00, 6264000.00, 'COMPANY', 'Công ty CP Sài Gòn Xanh', '0309876543', 'Công ty CP Sài Gòn Xanh', '88 Lê Lợi, Quận 1, TP.HCM', 'ISSUED', 'NOT_EXPORTED', 'ACCOUNTING');

INSERT INTO attendance_records
    (id, employee_id, work_date, clock_in, clock_out, status, source, device_event_id, note, imported_by)
VALUES
    (1, 'FRONTDESK', CURDATE(), TIMESTAMP(CURDATE(), '06:02:00'), TIMESTAMP(CURDATE(), '14:05:00'), 'PRESENT', 'BIOMETRIC_IMPORT', 'FP-DEMO-001', 'Import từ file máy vân tay demo', 'HR'),
    (2, 'HOUSEKEEP', CURDATE(), TIMESTAMP(CURDATE(), '06:15:00'), TIMESTAMP(CURDATE(), '14:00:00'), 'LATE', 'BIOMETRIC_IMPORT', 'FP-DEMO-002', 'Import từ file máy vân tay demo', 'HR'),
    (3, 'ACCOUNTING', CURDATE(), TIMESTAMP(CURDATE(), '08:00:00'), TIMESTAMP(CURDATE(), '17:00:00'), 'PRESENT', 'MANUAL', NULL, 'Nhập thủ công để test khi chưa có phần cứng', 'HR'),
    (4, 'TECHNICAL', CURDATE(), TIMESTAMP(CURDATE(), '08:05:00'), TIMESTAMP(CURDATE(), '17:10:00'), 'LATE', 'BIOMETRIC_IMPORT', 'FP-DEMO-004', 'Nhân viên đến muộn để kiểm thử cảnh báo', 'HR'),
    (5, 'KITCHEN', CURDATE(), TIMESTAMP(CURDATE(), '07:55:00'), TIMESTAMP(CURDATE(), '16:30:00'), 'PRESENT', 'BIOMETRIC_IMPORT', 'FP-DEMO-005', 'Import từ máy vân tay demo', 'HR'),
    (6, 'MANAGER', CURDATE(), TIMESTAMP(CURDATE(), '08:10:00'), TIMESTAMP(CURDATE(), '17:30:00'), 'LATE', 'BIOMETRIC_IMPORT', 'FP-DEMO-006', 'Nhân viên đến muộn để kiểm thử cảnh báo', 'HR'),
    (7, 'DIRECTOR', CURDATE(), TIMESTAMP(CURDATE(), '08:00:00'), TIMESTAMP(CURDATE(), '17:00:00'), 'PRESENT', 'BIOMETRIC_IMPORT', 'FP-DEMO-007', 'Import từ máy vân tay demo', 'HR'),
    (8, 'ADMIN', CURDATE(), NULL, NULL, 'ABSENT', 'MANUAL', NULL, 'Vắng không phép để kiểm thử trạng thái', 'HR'),
    (9, 'HR', CURDATE(), NULL, NULL, 'ON_LEAVE', 'MANUAL', NULL, 'Nghỉ phép để kiểm thử trạng thái', 'HR'),
    (10, 'STAFF', CURDATE(), TIMESTAMP(CURDATE(), '09:05:00'), TIMESTAMP(CURDATE(), '18:00:00'), 'LATE', 'BIOMETRIC_IMPORT', 'FP-DEMO-010', 'Nhân viên đến muộn để kiểm thử cảnh báo', 'HR');

INSERT INTO leave_requests
    (id, employee_id, leave_type, start_date, end_date, reason, status, requested_by, approver, decided_at)
VALUES
    (1, 'HOUSEKEEP', 'ANNUAL', DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Giải quyết việc gia đình.', 'PENDING', 'HOUSEKEEP', NULL, NULL),
    (2, 'FRONTDESK', 'SICK', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Nghỉ ốm có giấy xác nhận.', 'APPROVED', 'FRONTDESK', 'MANAGER', DATE_SUB(NOW(), INTERVAL 1 DAY)),
    (3, 'KITCHEN', 'SHIFT_CHANGE', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Đổi ca với đồng nghiệp.', 'PENDING', 'KITCHEN', NULL, NULL);

INSERT INTO stock_items
    (id, name, category, unit, current_quantity, safety_threshold, service_id, active)
VALUES
    ('LINEN-KING', 'Ga trải giường King', 'LINEN', 'bộ', 45, 20, NULL, TRUE),
    ('LINEN-TWIN', 'Ga trải giường Twin', 'LINEN', 'bộ', 38, 20, NULL, TRUE),
    ('LINEN-PILLOW', 'Vỏ gối', 'LINEN', 'cái', 120, 60, NULL, TRUE),
    ('LINEN-TOWEL-L', 'Khăn tắm lớn', 'LINEN', 'cái', 15, 40, NULL, TRUE),
    ('LINEN-TOWEL-S', 'Khăn tắm nhỏ', 'LINEN', 'cái', 18, 40, NULL, TRUE),
    ('GENERAL-WATER', 'Nước suối minibar', 'GENERAL', 'chai', 200, 80, 'BREAKFAST', TRUE);

INSERT INTO stock_movements (id, item_id, movement_type, quantity, actor_id, reason)
VALUES
    (1, 'LINEN-KING', 'RECEIVE', 60, 'HOUSEKEEP', 'Nhập kho đồ vải đầu kỳ'),
    (2, 'LINEN-TOWEL-L', 'ISSUE', 5, 'HOUSEKEEP', 'Cấp cho ca buồng phòng hôm nay');

INSERT INTO technical_assets
    (id, name, category, location_type, room_id, floor, location, brand_model, installed_on, next_maintenance, status, original_value, note)
VALUES
    ('AST-HVAC-001', 'Hệ thống điều hòa Chiller trung tâm', 'HVAC', 'BUILDING', NULL, 20, 'Tầng kỹ thuật mái', 'Daikin Modular 120RT', '2023-01-15', DATE_ADD(CURDATE(), INTERVAL 25 DAY), 'GOOD', 650000000.00, 'Tài sản tòa nhà'),
    ('AST-GEN-001', 'Máy phát điện dự phòng 500kVA', 'Hệ thống điện', 'BUILDING', NULL, -2, 'Phòng kỹ thuật B2', 'Cummins PowerTech', '2022-11-10', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'MAINTENANCE_NEEDED', 480000000.00, 'Tài sản tòa nhà'),
    ('AST-ELEV-001', 'Thang máy khách số 1', 'Thang máy', 'BUILDING', NULL, 0, 'Sảnh chính cánh Bắc', 'Mitsubishi NexWay 1000kg', '2023-03-20', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'GOOD', 520000000.00, 'Tài sản tòa nhà'),
    ('AST-POOL-001', 'Hệ thống lọc hồ bơi', 'Hồ bơi', 'BUILDING', NULL, 21, 'Khu kỹ thuật hồ bơi', 'Emaux Commercial SB20', '2023-04-15', DATE_ADD(CURDATE(), INTERVAL 8 DAY), 'GOOD', 95000000.00, 'Tài sản tầng 21'),
    ('AST-501-TV', 'TV 4K phòng 501', 'Thiết bị phòng', 'ROOM', '501', 5, 'Phòng 501', 'Samsung 55 inch', DATE_SUB(CURDATE(), INTERVAL 12 MONTH), DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'GOOD', 12000000.00, 'Liên kết tài sản phòng');

INSERT INTO cash_handover_denominations (id, handover_id, denomination, quantity, amount)
VALUES
    (1, 1, 500000.00, 20, 10000000.00),
    (2, 1, 200000.00, 10, 2000000.00),
    (3, 1, 100000.00, 5, 500000.00),
    (4, 2, 500000.00, 12, 6000000.00),
    (5, 2, 200000.00, 10, 2000000.00),
    (6, 2, 100000.00, 2, 200000.00);

UPDATE room_types
SET marketing_name = CASE room_type_code
        WHEN 'STD' THEN 'Phòng Tiêu Chuẩn Nghỉ Dưỡng'
        WHEN 'SUP' THEN 'Phòng Cao Cấp Thanh Lịch'
        WHEN 'DLX' THEN 'Phòng Deluxe Thượng Hạng'
        WHEN 'SUT' THEN 'Phòng Suite Hoàng Gia'
        WHEN 'VIP' THEN 'Biệt Thự Hoàng Gia'
    END,
    marketing_description = CASE id
        WHEN 'RT001' THEN 'Không gian nghỉ thanh lịch với ánh sáng tự nhiên ngập tràn, giường queen êm ái cùng phòng tắm tiện nghi tinh tế được thiết kế để bạn trọn vẹn thả lỏng bên vịnh biển.'
        WHEN 'RT002' THEN 'Không gian nghỉ thanh lịch với ánh sáng tự nhiên ngập tràn, hai giường đơn êm ái cùng phòng tắm tiện nghi tinh tế, phù hợp cho những chuyến đi cùng gia đình hoặc bạn bè.'
        WHEN 'RT003' THEN 'Khung cảnh vịnh biển xanh mát hoặc vườn hoa mở ra từ ban công riêng biệt. Bồn tắm đá ngâm thảo mộc và đệm ngủ chuẩn 5 sao giúp giấc ngủ sâu lắng và thư thái trọn vẹn.'
        WHEN 'RT004' THEN 'Khung cảnh vịnh biển xanh mát mở ra từ ban công riêng biệt. Hai giường đơn rộng rãi, bồn tắm đá ngâm thảo mộc và đệm ngủ chuẩn 5 sao mang đến kỳ nghỉ thư thái trọn vẹn.'
        WHEN 'RT005' THEN 'Không gian mời bạn cảm nhận trọn vẹn nhịp sống thư thái với tầm nhìn thoáng đạt, bồn tắm đá cẩm thạch nhìn ra thiên nhiên cùng ban công rộng đón nắng bình minh.'
        WHEN 'RT006' THEN 'Không gian Deluxe rộng rãi với tầm nhìn thoáng đạt, khu vực sofa riêng cho những buổi chuyện trò thư thái, bồn tắm đá cẩm thạch và ban công rộng đón nắng bình minh.'
        WHEN 'RT007' THEN 'Phòng Suite hoàng gia tích hợp phòng khách biệt lập, ban công ngắm hoàng hôn, đệm Emperor bọc linen cao cấp và gói chăm sóc quản gia tận tâm cùng rượu vang đón chào.'
        WHEN 'RT008' THEN 'Phòng Suite hoàng gia rộng nhất hạng SUT với phòng khách biệt lập, ban công riêng ngắm hoàng hôn, đệm Emperor bọc linen cao cấp và dịch vụ đón tiếp tận tâm.'
        WHEN 'RT009' THEN 'Một căn biệt thự hoàn chỉnh dành riêng cho nhóm của bạn: phòng khách rộng để quây quần, khu ngủ êm ái, sân hiên hướng thiên nhiên và trải nghiệm hồ bơi riêng. Dịch vụ quản gia hỗ trợ đón tiếp, phục vụ bữa sáng tại villa và chuẩn bị những khoảnh khắc đáng nhớ cho tối đa 8 khách.'
    END
WHERE id IN ('RT001', 'RT002', 'RT003', 'RT004', 'RT005', 'RT006', 'RT007', 'RT008', 'RT009');

-- V37: Chuẩn hóa toàn bộ ảnh phòng khách sạn theo đúng thứ hạng (STD, SUP, DLX, SUT, VIP)
-- Loại bỏ hoàn toàn ảnh bể bơi ngoài trời, mặt tiền villa/tòa nhà, bàn bóng bàn, góc phòng ăn rác.
-- Mỗi phòng có đúng 4 ảnh phòng ngủ và tiện nghi nội thất khép kín thực tế;
-- Ảnh cover được phân bổ riêng biệt theo đúng thứ hạng chất lượng và đặc trưng từng phòng.

DELETE FROM room_images;

INSERT INTO room_images (room_id, relative_path, display_order, cover, content_type, size_bytes, active)
VALUES
    ('501', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&h=800&q=80&room=501&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('501', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=501&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('501', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=501&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('501', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=501&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('502', 'https://images.unsplash.com/photo-1572987669554-0ba2ba9aee1f?auto=format&fit=crop&w=1200&h=800&q=80&room=502&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('502', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=502&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('502', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=502&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('502', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=502&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('601', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=601&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('601', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=601&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('601', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=601&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('601', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=601&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('602', 'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?auto=format&fit=crop&w=1200&h=800&q=80&room=602&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('602', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=602&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('602', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=602&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('602', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=602&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('701', 'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?auto=format&fit=crop&w=1200&h=800&q=80&room=701&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('701', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=701&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('701', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=701&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('701', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=701&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('702', 'https://images.pexels.com/photos/3754594/pexels-photo-3754594.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('702', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=702&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('702', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('702', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('801', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&h=800&q=80&room=801&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('801', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=801&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('801', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=801&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('801', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=801&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('802', 'https://images.pexels.com/photos/1457845/pexels-photo-1457845.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('802', 'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=802&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('802', 'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('802', 'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('503', 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&h=800&q=80&room=503&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('503', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=503&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('503', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=503&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('503', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=503&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('504', 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('504', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=504&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('504', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('504', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('603', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=603&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('603', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=603&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('603', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=603&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('603', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=603&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('604', 'https://images.pexels.com/photos/271616/pexels-photo-271616.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('604', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=604&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('604', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('604', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('703', 'https://images.unsplash.com/photo-1702014859878-5d4743176d28?auto=format&fit=crop&w=1200&h=800&q=80&room=703&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('703', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=703&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('703', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=703&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('703', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=703&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('704', 'https://images.unsplash.com/photo-1667125095636-dce94dcbdd96?auto=format&fit=crop&w=1200&h=800&q=80&room=704&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('704', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=704&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('704', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=704&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('704', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=704&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('803', 'https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=1200&h=800&q=80&room=803&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('803', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=803&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('803', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=803&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('803', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=803&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('804', 'https://images.pexels.com/photos/271619/pexels-photo-271619.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('804', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=804&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('804', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('804', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('901', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&h=800&q=80&room=901&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('901', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=901&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('901', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=901&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('901', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=901&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('902', 'https://images.pexels.com/photos/3659683/pexels-photo-3659683.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('902', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=902&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('902', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('902', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1001', 'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?auto=format&fit=crop&w=1200&h=800&q=80&room=1001&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1001', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1001&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1001', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1001&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1001', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1001&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1002', 'https://images.unsplash.com/photo-1605346434674-a440ca4dc4c0?auto=format&fit=crop&w=1200&h=800&q=80&room=1002&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1002', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1002&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1002', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1002&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1002', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1002&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1101', 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1101', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1101&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1101', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1101', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1201', 'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1201', 'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1201&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1201', 'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1201', 'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('903', 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&h=800&q=80&room=903&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('903', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=903&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('903', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=903&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('903', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=903&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('904', 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&h=800&q=80&room=904&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('904', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=904&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('904', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=904&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('904', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=904&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1003', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&h=800&q=80&room=1003&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1003', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1003&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1003', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1003&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1003', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1003&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1004', 'https://images.unsplash.com/photo-1737517302831-e7b8a8eaa97c?auto=format&fit=crop&w=1200&h=800&q=80&room=1004&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1004', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1004&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1004', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1004&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1004', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1004&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1102', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1102&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1102', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1102&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1102', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1102&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1102', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1102&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1103', 'https://images.pexels.com/photos/271643/pexels-photo-271643.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1103', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1103&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1103', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1103', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1202', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&h=800&q=80&room=1202&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1202', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1202&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1202', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1202&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1202', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1202&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1203', 'https://images.pexels.com/photos/271659/pexels-photo-271659.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1203', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1203&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1203', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1203', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1301', 'https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1200&h=800&q=80&room=1301&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1301', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1301&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1301', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1301&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1301', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1301&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1302', 'https://images.unsplash.com/photo-1576354302919-96748cb8299e?auto=format&fit=crop&w=1200&h=800&q=80&room=1302&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1302', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1302&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1302', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1302&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1302', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1302&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1401', 'https://images.unsplash.com/photo-1713762523087-41019a875741?auto=format&fit=crop&w=1200&h=800&q=80&room=1401&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1401', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1401&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1401', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1401&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1401', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1401&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1402', 'https://images.pexels.com/photos/1743231/pexels-photo-1743231.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1402', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1402&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1402', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1402', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1501', 'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1501', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1501&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1501', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1501', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1502', 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1200&h=800&q=80&room=1502&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1502', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1502&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1502', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1502&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1502', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1502&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1601', 'https://images.pexels.com/photos/276671/pexels-photo-276671.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1601', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1601&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1601', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1601', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1602', 'https://images.unsplash.com/photo-1630660664869-c9d3cc676880?auto=format&fit=crop&w=1200&h=800&q=80&room=1602&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1602', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1602&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1602', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1602&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1602', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1602&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1701', 'https://images.pexels.com/photos/172872/pexels-photo-172872.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1701', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1701&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1701', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1701', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1801', 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1801', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1801&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1801', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1801', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1901', 'https://images.pexels.com/photos/271674/pexels-photo-271674.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1901', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1901&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1901', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1901', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('2001', 'https://images.unsplash.com/photo-1698927100805-2a32718a7e05?auto=format&fit=crop&w=1200&h=800&q=80&room=2001&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('2001', 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=2001&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('2001', 'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2001&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('2001', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2001&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1104', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&h=800&q=80&room=1104&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1104', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1104&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1104', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1104&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1104', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1104&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1204', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1204&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1204', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1204&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1204', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1204&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1204', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1204&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1303', 'https://images.unsplash.com/photo-1731336478850-6bce7235e320?auto=format&fit=crop&w=1200&h=800&q=80&room=1303&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1303', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1303&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1303', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1303&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1303', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1303&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1304', 'https://images.unsplash.com/photo-1645619200527-c6786729c2da?auto=format&fit=crop&w=1200&h=800&q=80&room=1304&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1304', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1304&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1304', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1304&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1304', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1304&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1403', 'https://images.unsplash.com/photo-1776763018972-588e27bf6511?auto=format&fit=crop&w=1200&h=800&q=80&room=1403&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1403', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1403&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1403', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1403&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1403', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1403&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1404', 'https://images.unsplash.com/photo-1718851972754-6638b49b4775?auto=format&fit=crop&w=1200&h=800&q=80&room=1404&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1404', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1404&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1404', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1404&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1404', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1404&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1503', 'https://images.unsplash.com/photo-1592229505726-ca121723b8ef?auto=format&fit=crop&w=1200&h=800&q=80&room=1503&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1503', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1503&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1503', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1503&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1503', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1503&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1504', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=800&q=80&room=1504&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1504', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1504&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1504', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1504&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1504', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1504&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1603', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=800&q=80&room=1603&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1603', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1603&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1603', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1603&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1603', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1603&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1604', 'https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1604', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1604&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1604', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1604', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1702', 'https://images.unsplash.com/photo-1776763018821-8feeaeeee0a5?auto=format&fit=crop&w=1200&h=800&q=80&room=1702&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1702', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1702&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1702', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1702&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1702', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1702&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1703', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=800&q=80&room=1703&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1703', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1703&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1703', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1703&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1703', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1703&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1802', 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=800&q=80&room=1802&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1802', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1802&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1802', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1802&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1802', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1802&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1803', 'https://images.unsplash.com/photo-1639678349557-ffe5bed73ce7?auto=format&fit=crop&w=1200&h=800&q=80&room=1803&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1803', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1803&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1803', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1803&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1803', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1803&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1902', 'https://images.unsplash.com/photo-1711059985570-4c32ed12a12c?auto=format&fit=crop&w=1200&h=800&q=80&room=1902&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1902', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1902&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1902', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1902&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1902', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1902&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1903', 'https://images.pexels.com/photos/271644/pexels-photo-271644.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1903', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1903&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1903', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1903', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('2002', 'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1200&h=800&q=80&room=2002&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('2002', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=2002&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('2002', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2002&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('2002', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2002&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('2003', 'https://images.pexels.com/photos/775219/pexels-photo-775219.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('2003', 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=2003&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('2003', 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('2003', 'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1704', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&h=800&q=80&room=1704&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1704', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1704&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1704', 'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1704&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1704', 'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1704&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1804', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1804&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1804', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1804&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1804', 'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1804&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1804', 'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1804&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('1904', 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('1904', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1904&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('1904', 'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('1904', 'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=4', 3, FALSE, 'image/jpeg', 1, TRUE),
    ('2004', 'https://images.pexels.com/photos/2506990/pexels-photo-2506990.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=1', 0, TRUE, 'image/jpeg', 1, TRUE),
    ('2004', 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=2004&view=2', 1, FALSE, 'image/jpeg', 1, TRUE),
    ('2004', 'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=3', 2, FALSE, 'image/jpeg', 1, TRUE),
    ('2004', 'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=4', 3, FALSE, 'image/jpeg', 1, TRUE);

UPDATE room_types
SET cover_image_url = CASE room_type_code
    WHEN 'STD' THEN 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'SUP' THEN 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'DLX' THEN 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'SUT' THEN 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'VIP' THEN 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1400&h=1000&fit=crop&auto=format'
    ELSE cover_image_url
END;

UPDATE rooms
SET description = CASE name
    WHEN '1704' THEN 'Biệt thự Hoàng gia 1704 là không gian nguyên căn trên tầng 17 với phòng khách riêng, khu ngủ sang trọng, sân hiên riêng và góc ngắm hoàng hôn. Villa phù hợp tối đa 8 khách, có quản gia hỗ trợ chuẩn bị bữa sáng tại villa và các trải nghiệm riêng theo yêu cầu.'
    WHEN '1804' THEN 'Biệt thự Hoàng gia 1804 mở ra một kỳ nghỉ riêng tư với phòng khách tách biệt, ban công rộng và khu nghỉ dưỡng trong nhà - ngoài trời liền mạch. Đây là một căn villa hoàn chỉnh cho tối đa 8 khách, thích hợp cho gia đình hoặc nhóm bạn muốn tận hưởng trọn vẹn không gian riêng.'
    WHEN '1904' THEN 'Biệt thự Hoàng gia 1904 mang đến cảm giác như một ngôi nhà nghỉ dưỡng riêng giữa tầng cao: phòng khách, khu ngủ cao cấp, khu vực dùng bữa và sân hiên ngắm thành phố. Quản gia tận tâm đồng hành để kỳ nghỉ của tối đa 8 khách trở nên nhẹ nhàng và đáng nhớ.'
    WHEN '2004' THEN 'Biệt thự Hoàng gia 2004 là căn villa đặc biệt ở tầng cao nhất của bộ sưu tập, nơi cả nhóm có thể tận hưởng phòng khách riêng, khu ngủ rộng, ban công riêng và không gian thư giãn biệt lập. Villa phục vụ tối đa 8 khách với dịch vụ quản gia và trải nghiệm cá nhân hóa.'
    ELSE description
END
WHERE room_type_id = 'RT009';

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
