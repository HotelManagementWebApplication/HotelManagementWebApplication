-- Cập nhật toàn bộ ảnh phòng: chỉ dùng ảnh phòng ngủ khách sạn, phòng suite và biệt thự resort 5 sao thực tế.
-- Tuyệt đối không dùng ảnh đồ ăn, thể thao (bóng bàn, cầu lông), spa hay giặt ủi cho phòng lưu trú.

SET @std_images = JSON_ARRAY(
    'photo-1590490360182-c33d57733427',
    'photo-1582719478250-c89cae4dc85b',
    'photo-1566665797739-1674de7a421a',
    'photo-1505693416388-ac5ce068fe85',
    'photo-1631049307264-da0ec9d70304',
    'photo-1576354302919-96748cb8299e'
);

SET @sup_images = JSON_ARRAY(
    'photo-1618773928121-c32242e63f39',
    'photo-1578683010236-d716f9a3f461',
    'photo-1631049552057-403cdb8f0658',
    'photo-1568495248636-6432b97bd949',
    'photo-1584622650111-993a426fbf0a',
    'photo-1549638441-b787d2e11f14'
);

SET @dlx_images = JSON_ARRAY(
    'photo-1564078516393-cf04bd966897',
    'photo-1591088398332-8a7791972843',
    'photo-1630660664869-c9d3cc676880',
    'photo-1631049421450-348ccd7f8949',
    'photo-1667125095636-dce94dcbdd96',
    'photo-1595576508898-0ad5c879a061'
);

SET @sut_images = JSON_ARRAY(
    'photo-1600607687920-4e2a09cf159d',
    'photo-1611892440504-42a792e24d32',
    'photo-1629140727571-9b5c6f6267b4',
    'photo-1578898886225-c7c894047899',
    'photo-1616594039964-ae9021a400a0',
    'photo-1551882547-ff40c63fe5fa'
);

SET @vip_images = JSON_ARRAY(
    'photo-1571896349842-33c89424de2d',
    'photo-1600607688969-a5bfcd646154',
    'photo-1540541338287-41700207dee6',
    'photo-1520250497591-112f2f40a3f4',
    'photo-1613977257363-707ba9348227',
    'photo-1613490493576-7fde63acd811'
);

UPDATE room_images ri
JOIN rooms r ON r.id = ri.room_id
JOIN room_types rt ON rt.id = r.room_type_id
JOIN (
    SELECT id AS room_id, ROW_NUMBER() OVER (PARTITION BY room_type_id ORDER BY id) - 1 AS type_seq
    FROM rooms
) seq ON seq.room_id = r.id
SET ri.relative_path = CONCAT(
    'https://images.unsplash.com/',
    CASE rt.room_type_code
        WHEN 'STD' THEN JSON_UNQUOTE(JSON_EXTRACT(@std_images, CONCAT('$[', MOD(seq.type_seq * 3 + ri.display_order, JSON_LENGTH(@std_images)), ']')))
        WHEN 'SUP' THEN JSON_UNQUOTE(JSON_EXTRACT(@sup_images, CONCAT('$[', MOD(seq.type_seq * 3 + ri.display_order, JSON_LENGTH(@sup_images)), ']')))
        WHEN 'DLX' THEN JSON_UNQUOTE(JSON_EXTRACT(@dlx_images, CONCAT('$[', MOD(seq.type_seq * 3 + ri.display_order, JSON_LENGTH(@dlx_images)), ']')))
        WHEN 'SUT' THEN JSON_UNQUOTE(JSON_EXTRACT(@sut_images, CONCAT('$[', MOD(seq.type_seq * 3 + ri.display_order, JSON_LENGTH(@sut_images)), ']')))
        ELSE JSON_UNQUOTE(JSON_EXTRACT(@vip_images, CONCAT('$[', MOD(seq.type_seq * 3 + ri.display_order, JSON_LENGTH(@vip_images)), ']')))
    END,
    '?ixlib=rb-4.1.0&q=85&fm=jpg&fit=crop&w=1200&h=800&auto=format&room=', ri.room_id, '&view=', ri.display_order + 1
)
WHERE ri.active = TRUE;

UPDATE room_types
SET cover_image_url = 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&h=800&fit=crop&auto=format'
WHERE id = 'RT006';
