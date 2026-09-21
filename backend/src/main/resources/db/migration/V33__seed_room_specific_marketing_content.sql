-- Nội dung quảng cáo riêng của từng phòng.
-- room_types vẫn giữ thông tin dùng chung cho phân loại; rooms và room_images
-- là nguồn dữ liệu cụ thể được hiển thị cho từng phòng trên customer portal.

ALTER TABLE rooms
    MODIFY COLUMN description VARCHAR(1200) NULL;

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
)
WHERE r.id IS NOT NULL;

-- Seed metadata ảnh theo từng room_id. Mỗi phòng có 3 ảnh riêng trong database
-- để màn hình chi tiết có thể trình bày ảnh chính và gallery mà không dùng ảnh
-- fallback của frontend. Nếu một phòng đã có ảnh vận hành, migration giữ nguyên.
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
) gallery
WHERE NOT EXISTS (
    SELECT 1 FROM room_images existing
    WHERE existing.room_id = r.id AND existing.active = TRUE
);
