-- Complete the public service catalog with the commercial spaces that back
-- customer vouchers. Hotel-operated services (room service, laundry,
-- minibar and transport) intentionally remain outside this table.

INSERT IGNORE INTO commercial_partners
    (id, legal_name, brand_name, category, contact_phone, floor_from, floor_to,
     fixed_rent, service_fee, commission_rate, commission_floor, status)
VALUES
    ('PARTNER_FNB_03', 'Công ty Ottimo Hospitality', 'Ý Ottimo House', 'F&B', '0908000011', 0, 2, 36000000, 5000000, 5.00, 7000000, 'ACTIVE'),
    ('PARTNER_FNB_04', 'Công ty Mermaid Seafood', 'Mermaid', 'F&B', '0908000012', 0, 2, 42000000, 5500000, 5.00, 9000000, 'ACTIVE'),
    ('PARTNER_FNB_05', 'Công ty Haidilao Việt Nam', 'Haidilao', 'F&B', '0908000013', 1, 2, 50000000, 6500000, 5.00, 10000000, 'ACTIVE'),
    ('PARTNER_FNB_06', 'Công ty Omakase Dining', 'Omakase', 'F&B', '0908000014', 2, 2, 48000000, 6000000, 5.00, 10000000, 'ACTIVE'),
    ('PARTNER_FNB_07', 'Công ty Spicy Box', 'Spicy Box', 'F&B', '0908000015', 1, 2, 30000000, 4500000, 5.00, 6000000, 'ACTIVE'),
    ('PARTNER_FNB_08', 'Công ty Dokki Việt Nam', 'Dokki', 'F&B', '0908000016', 1, 2, 32000000, 4500000, 5.00, 6500000, 'ACTIVE'),
    ('PARTNER_BAR_01', 'Công ty Speakeasy Bar', 'Speakeasy Bar', 'F&B', '0908000017', 2, 2, 38000000, 5000000, 5.00, 8000000, 'ACTIVE'),
    ('PARTNER_BAR_02', 'Công ty Whisky Lounge', 'Whisky', 'F&B', '0908000018', 2, 2, 40000000, 5000000, 5.00, 8000000, 'ACTIVE'),
    ('PARTNER_BAR_03', 'Công ty Skyline Hospitality', 'Skyline', 'F&B', '0908000019', 2, 2, 45000000, 5500000, 5.00, 9000000, 'ACTIVE'),
    ('PARTNER_WELLNESS_02', 'Công ty La Vie Wellness', 'La Vie Spa', 'WELLNESS', '0908000020', 3, 4, 58000000, 7000000, 5.00, 11000000, 'ACTIVE'),
    ('PARTNER_SPORT_01', 'Công ty MAM Sports', 'MAM Sports Club', 'WELLNESS', '0908000021', 3, 4, 42000000, 5500000, 5.00, 8000000, 'ACTIVE'),
    ('PARTNER_EVENT_01', 'Công ty MAM Events', 'MAM Events & Convention', 'EVENT', '0908000022', 4, 4, 70000000, 9000000, 5.00, 15000000, 'ACTIVE');

INSERT IGNORE INTO commercial_spaces
    (id, partner_id, name, floor, zone, access_policy, service_id, status)
VALUES
    ('SPACE_OTTIMO', 'PARTNER_FNB_03', 'Ý Ottimo House', 0, 'Khu ẩm thực tầng trệt', 'PUBLIC', 'OTTIMO', 'ACTIVE'),
    ('SPACE_MERMAID', 'PARTNER_FNB_04', 'Mermaid', 1, 'Khu ẩm thực tầng 1', 'PUBLIC', 'MERMAID', 'ACTIVE'),
    ('SPACE_HAIDILAO', 'PARTNER_FNB_05', 'Haidilao', 1, 'Khu ẩm thực tầng 1', 'PUBLIC', 'HAIDILAO', 'ACTIVE'),
    ('SPACE_OMAKASE', 'PARTNER_FNB_06', 'Omakase', 2, 'Khu ẩm thực tầng 2', 'PUBLIC', 'OMAKASE', 'ACTIVE'),
    ('SPACE_SPICYBOX', 'PARTNER_FNB_07', 'Spicy Box', 1, 'Khu ẩm thực tầng 1', 'PUBLIC', 'SPICYBOX', 'ACTIVE'),
    ('SPACE_DOKKI', 'PARTNER_FNB_08', 'Dokki', 2, 'Khu ẩm thực tầng 2', 'PUBLIC', 'DOKKI', 'ACTIVE'),
    ('SPACE_SPEAKEASY', 'PARTNER_BAR_01', 'Speakeasy Bar', 2, 'Khu bar tầng 2', 'PUBLIC', 'SPEAKEASY', 'ACTIVE'),
    ('SPACE_WHISKY', 'PARTNER_BAR_02', 'Whisky', 2, 'Khu bar tầng 2', 'PUBLIC', 'WHISKYBAR', 'ACTIVE'),
    ('SPACE_SKYLINE', 'PARTNER_BAR_03', 'Skyline', 2, 'Khu bar tầng 2', 'PUBLIC', 'SKYBAR', 'ACTIVE'),
    ('SPACE_LAVIE', 'PARTNER_WELLNESS_02', 'La Vie Spa', 3, 'Khu tiện ích cao cấp tầng 3', 'DAY_PASS', 'LAVIESPA', 'ACTIVE'),
    ('SPACE_SPAFACIAL', 'PARTNER_WELLNESS_01', 'Sen Spa - Chăm sóc da', 3, 'Khu tiện ích cao cấp tầng 3', 'DAY_PASS', 'SPAFACIAL', 'ACTIVE'),
    ('SPACE_SENSPA', 'PARTNER_WELLNESS_01', 'Sen Spa - Trị liệu', 3, 'Khu tiện ích cao cấp tầng 3', 'DAY_PASS', 'SENSPA', 'ACTIVE'),
    ('SPACE_STEAM', 'PARTNER_WELLNESS_01', 'Sen Spa - Xông hơi', 4, 'Khu tiện ích cao cấp tầng 4', 'DAY_PASS', 'STEAM', 'ACTIVE'),
    ('SPACE_TENNIS', 'PARTNER_SPORT_01', 'Sân Tennis', 3, 'Câu lạc bộ thể thao tầng 3', 'DAY_PASS', 'TENNIS', 'ACTIVE'),
    ('SPACE_BADMINTON', 'PARTNER_SPORT_01', 'Sân Cầu lông', 3, 'Câu lạc bộ thể thao tầng 3', 'DAY_PASS', 'BADMINTON', 'ACTIVE'),
    ('SPACE_PINGPONG', 'PARTNER_SPORT_01', 'Bóng bàn', 4, 'Câu lạc bộ thể thao tầng 4', 'DAY_PASS', 'PINGPONG', 'ACTIVE'),
    ('SPACE_MEETING', 'PARTNER_EVENT_01', 'Phòng họp & Hội nghị', 4, 'Trung tâm hội nghị tầng 4', 'PUBLIC', 'MEETING', 'ACTIVE'),
    ('SPACE_EVENT', 'PARTNER_EVENT_01', 'Tổ chức Tiệc cưới & Sự kiện', 4, 'Trung tâm hội nghị tầng 4', 'PUBLIC', 'EVENT', 'ACTIVE'),
    ('SPACE_BALLROOM', 'PARTNER_EVENT_01', 'Grand Ballroom', 4, 'Trung tâm hội nghị tầng 4', 'PUBLIC', 'BALLROOM', 'ACTIVE'),
    ('SPACE_BOARDROOM', 'PARTNER_EVENT_01', 'Phòng họp Executive', 4, 'Trung tâm hội nghị tầng 4', 'PUBLIC', 'BOARDROOM', 'ACTIVE');

INSERT IGNORE INTO partner_monthly_settlements
    (partner_id, period_start, period_end, fixed_rent, service_fee, actual_revenue,
     commission_rate, commission_floor, commission_due, total_due, status)
SELECT p.id, DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), p.fixed_rent,
       p.service_fee, 0, p.commission_rate, p.commission_floor, p.commission_floor,
       p.fixed_rent + p.service_fee + p.commission_floor, 'OPEN'
FROM commercial_partners p
WHERE p.category <> 'HOTEL_AMENITY';
