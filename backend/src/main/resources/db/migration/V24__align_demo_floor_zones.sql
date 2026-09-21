INSERT IGNORE INTO commercial_partners
    (id, legal_name, brand_name, category, contact_phone, floor_from, floor_to, fixed_rent, service_fee, commission_rate, commission_floor, status)
VALUES ('PARTNER_HOTEL_01', 'MAM Hotel', 'MAM Hotel Amenities', 'HOTEL_AMENITY', NULL, 21, 21, 0, 0, 0, 0, 'ACTIVE');

UPDATE commercial_spaces SET partner_id='PARTNER_HOTEL_01' WHERE id='SPACE_POOL';

UPDATE rooms SET name='501', floor=5, description='Phòng tiêu chuẩn tầng 5' WHERE id='R101';
UPDATE rooms SET name='502', floor=5, description='Phòng tiêu chuẩn tầng 5' WHERE id='R102';
UPDATE rooms SET name='601', floor=6, description='Phòng Deluxe tầng 6' WHERE id='R201';
UPDATE rooms SET name='602', floor=6, description='Phòng Deluxe tầng 6' WHERE id='R202';
UPDATE rooms SET name='701', floor=7, description='Suite tầng 7' WHERE id='R301';
UPDATE rooms SET name='702', floor=7, description='Suite tầng 7' WHERE id='R302';
UPDATE rooms SET name='801', floor=8, description='VIP Suite tầng 8' WHERE id='R401';
UPDATE rooms SET name='802', floor=8, description='VIP Suite tầng 8' WHERE id='R402';
