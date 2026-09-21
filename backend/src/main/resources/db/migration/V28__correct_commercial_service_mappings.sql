-- Legacy demo rows represented a tenant by borrowing an unrelated hotel
-- service id. Keep those spaces available for existing vouchers, but remove
-- the misleading catalog links and add the real restaurant service link.
UPDATE commercial_spaces
SET service_id = NULL
WHERE id IN ('SPACE_LAURA', 'SPACE_COFFEE', 'SPACE_MART');

INSERT IGNORE INTO commercial_spaces
    (id, partner_id, name, floor, zone, access_policy, service_id, status)
VALUES
    ('SPACE_LABRASS', 'PARTNER_FNB_01', 'La Brasserie', 0,
     'Khu ẩm thực tầng trệt', 'PUBLIC', 'LABRASS', 'ACTIVE');
