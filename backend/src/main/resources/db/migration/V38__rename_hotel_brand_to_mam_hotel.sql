-- Rename the persisted hotel tenant brand without editing immutable migrations.
UPDATE commercial_partners
SET legal_name = 'MaM Hotel',
    brand_name = 'MaM Hotel Amenities'
WHERE id = 'PARTNER_HOTEL_01';

UPDATE commercial_spaces
SET name = 'MaM Hotel Amenities'
WHERE partner_id = 'PARTNER_HOTEL_01'
  AND name = 'MAM Hotel Amenities';
