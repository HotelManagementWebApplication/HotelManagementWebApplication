-- Thay toàn bộ gallery cũ bằng ảnh phòng ngủ, suite và villa thực tế từ Unsplash.
-- Mỗi phòng có đúng 4 ảnh; ảnh cover được phân bổ theo room_index để 64 phòng
-- hoàn toàn có ảnh bìa riêng biệt, không trùng lặp và không dùng ảnh ẩm thực, thể thao, giặt ủi.

DELETE FROM room_images;

SET @room_image_catalog = JSON_ARRAY(
    'photo-1590490360182-c33d57733427',
    'photo-1582719478250-c89cae4dc85b',
    'photo-1566665797739-1674de7a421a',
    'photo-1505693416388-ac5ce068fe85',
    'photo-1631049307264-da0ec9d70304',
    'photo-1576354302919-96748cb8299e',
    'photo-1618773928121-c32242e63f39',
    'photo-1578683010236-d716f9a3f461',
    'photo-1631049552057-403cdb8f0658',
    'photo-1568495248636-6432b97bd949',
    'photo-1584622650111-993a426fbf0a',
    'photo-1549638441-b787d2e11f14',
    'photo-1564078516393-cf04bd966897',
    'photo-1591088398332-8a7791972843',
    'photo-1630660664869-c9d3cc676880',
    'photo-1631049421450-348ccd7f8949',
    'photo-1667125095636-dce94dcbdd96',
    'photo-1595576508898-0ad5c879a061',
    'photo-1600607687920-4e2a09cf159d',
    'photo-1611892440504-42a792e24d32',
    'photo-1629140727571-9b5c6f6267b4',
    'photo-1578898886225-c7c894047899',
    'photo-1616594039964-ae9021a400a0',
    'photo-1551882547-ff40c63fe5fa',
    'photo-1571896349842-33c89424de2d',
    'photo-1600607688969-a5bfcd646154',
    'photo-1540541338287-41700207dee6',
    'photo-1520250497591-112f2f40a3f4',
    'photo-1613977257363-707ba9348227',
    'photo-1613490493576-7fde63acd811',
    'photo-1711059985570-4c32ed12a12c',
    'photo-1666813721996-42956e40788e',
    'photo-1731336478850-6bce7235e320',
    'photo-1590675560125-0d832b9d719e',
    'photo-1605346434674-a440ca4dc4c0',
    'photo-1645619200527-c6786729c2da',
    'photo-1572987669554-0ba2ba9aee1f',
    'photo-1605346576608-92f1346b67d6',
    'photo-1698927100805-2a32718a7e05',
    'photo-1560448204-e02f11c3d0e2',
    'photo-1737517302831-e7b8a8eaa97c',
    'photo-1632598024410-3d8f24daab57',
    'photo-1585738067728-0033516f4a89',
    'photo-1776763018821-8feeaeeee0a5',
    'photo-1776763018972-588e27bf6511',
    'photo-1777180249046-abf7d640e0d9',
    'photo-1718851972754-6638b49b4775',
    'photo-1702014859878-5d4743176d28',
    'photo-1639678349557-ffe5bed73ce7',
    'photo-1561501900-3701fa6a0864',
    'photo-1592229505726-ca121723b8ef',
    'photo-1564501049412-61c2a3083791',
    'photo-1566073771259-6a8506099945',
    'photo-1583417319070-4a69db38a482',
    'photo-1611251135345-18c56206b863',
    'photo-1713762523087-41019a875741',
    'photo-1507652313519-d4e9174996dd',
    'photo-1596394516093-501ba68a0ba6',
    'photo-1587985064135-0366536eab42',
    'photo-1590381105924-c72589b9ef3f',
    'photo-1562778612-e1e0cda9915c',
    'photo-1544984243-ec57ea16fe25',
    'photo-1522771739844-6a9f6d5f14af',
    'photo-1512918728675-ed5a9ecdebfd'
);

INSERT INTO room_images
    (room_id, relative_path, display_order, cover, content_type, size_bytes, active)
SELECT room_sequence.room_id,
       CONCAT(
           'https://images.unsplash.com/',
           JSON_UNQUOTE(JSON_EXTRACT(
               @room_image_catalog,
               CONCAT('$[', MOD(room_sequence.room_index + gallery.image_no * 16, JSON_LENGTH(@room_image_catalog)), ']')
           )),
           '?ixlib=rb-4.1.0&q=85&fm=jpg&fit=crop&w=1400&h=1000&auto=format&room=',
           room_sequence.room_id,
           '&view=', gallery.image_no + 1
       ),
       gallery.image_no,
       gallery.image_no = 0,
       'image/jpeg',
       1,
       TRUE
FROM (
    SELECT id AS room_id,
           ROW_NUMBER() OVER (ORDER BY CAST(name AS UNSIGNED), id) - 1 AS room_index
    FROM rooms
) room_sequence
CROSS JOIN (
    SELECT 0 AS image_no
    UNION ALL SELECT 1
    UNION ALL SELECT 2
    UNION ALL SELECT 3
) gallery;

UPDATE room_types
SET cover_image_url = CASE room_type_code
    WHEN 'STD' THEN 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'SUP' THEN 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'DLX' THEN 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'SUT' THEN 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1400&h=1000&fit=crop&auto=format'
    WHEN 'VIP' THEN 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1400&h=1000&fit=crop&auto=format'
    ELSE cover_image_url
END;
