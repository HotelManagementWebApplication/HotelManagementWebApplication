-- Làm mới ảnh catalog: mỗi room_id có một ảnh gốc khác nhau.
-- Các URL được lưu trong room_images để customer portal không dùng ảnh chung
-- theo room_type. Ảnh thật không được nhúng vào bundle frontend.
SET @room_catalog_image_ids = JSON_ARRAY(
    'photo-1464366400600-7168b8af9bc3',
    'photo-1497366216548-37526070297c',
    'photo-1497366811353-6870744d04b2',
    'photo-1498654896293-37aacf113fd9',
    'photo-1504754524776-8f4f37790ca0',
    'photo-1505693416388-ac5ce068fe85',
    'photo-1507652313519-d4e9174996dd',
    'photo-1511578314322-379afb476865',
    'photo-1514933651103-005eec06c04b',
    'photo-1517248135467-4c7edcad34c4',
    'photo-1519167758481-83f550bb49b3',
    'photo-1519741497674-611481863552',
    'photo-1520250497591-112f2f40a3f4',
    'photo-1527281400683-1aae777175f8',
    'photo-1533777857889-4be7c70b33f7',
    'photo-1534438327276-14e5300c3a48',
    'photo-1534528741775-53994a69daeb',
    'photo-1536926219056-1e30e3a3b98d',
    'photo-1540541338287-41700207dee6',
    'photo-1540555700478-4be289fbecef',
    'photo-1544161515-4ab6ce6db874',
    'photo-1545173168-9f1947eebb7f',
    'photo-1547036967-23d11aacaee0',
    'photo-1551218808-94e220e084d2',
    'photo-1554068865-24cecd4e34b8',
    'photo-1555396273-367ea4eb4db5',
    'photo-1556909212-d5b604d0c90d',
    'photo-1563245372-f21724e3856d',
    'photo-1564078516393-cf04bd966897',
    'photo-1564501049412-61c2a3083791',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1566073771259-6a8506099945',
    'photo-1566665797739-1674de7a421a',
    'photo-1570172619644-dfd03ed5d881',
    'photo-1571896349842-33c89424de2d',
    'photo-1575429198097-0414ec08e8cd',
    'photo-1578683010236-d716f9a3f461',
    'photo-1578898886225-c7c894047899',
    'photo-1579871494447-9811cf80d66c',
    'photo-1582719478250-c89cae4dc85b',
    'photo-1583417319070-4a69db38a482',
    'photo-1584622650111-993a426fbf0a',
    'photo-1590490360182-c33d57733427',
    'photo-1591088398332-8a7791972843d',
    'photo-1600334089648-b0d9d3028eb2',
    'photo-1600607687920-4e2a09cf159d',
    'photo-1600607688969-a5bfcd646154',
    'photo-1604335399105-a0c585fd81a1',
    'photo-1611251135345-18c56206b863',
    'photo-1611892440504-42a792e24d32',
    'photo-1618773928121-c32242e63f39',
    'photo-1626224583764-f87db24ac4ea',
    'photo-1629140727571-9b5c6f6267b4',
    'photo-1631049307264-da0ec9d70304',
    'photo-1713762523087-41019a875741',
    'photo-1711059985570-4c32ed12a12c',
    'photo-1631049552057-403cdb8f0658',
    'photo-1568495248636-6432b97bd949',
    'photo-1576354302919-96748cb8299e',
    'photo-1630660664869-c9d3cc676880',
    'photo-1667125095636-dce94dcbdd96',
    'photo-1631049421450-348ccd7f8949',
    'photo-1549638441-b787d2e11f14',
    'photo-1551882547-ff40c63fe5fa'
);

UPDATE room_images ri
JOIN (
    SELECT id AS room_id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS room_index
    FROM rooms
) sequence_map ON sequence_map.room_id = ri.room_id
SET ri.relative_path =
    CONCAT(
        'https://images.unsplash.com/',
        JSON_UNQUOTE(JSON_EXTRACT(
            @room_catalog_image_ids,
            CONCAT('$[', MOD(sequence_map.room_index + ri.display_order, JSON_LENGTH(@room_catalog_image_ids)), ']')
        )),
        '?ixlib=rb-4.1.0&q=85&fm=jpg&fit=crop&w=1200&h=800&auto=format&room=',
        ri.room_id, '&view=', ri.display_order + 1
    )
WHERE ri.active = TRUE
  AND ri.relative_path LIKE 'https://images.unsplash.com/photo-%';

-- Biệt thự Hoàng gia là một đơn vị lưu trú nguyên căn: phòng khách riêng,
-- khu ngủ, không gian ngoài trời/hồ bơi riêng và dịch vụ quản gia.
UPDATE room_types
SET name = 'Biệt thự Hoàng gia · Nguyên căn',
    description = 'Mỗi mã phòng là một căn biệt thự nguyên căn dành cho tối đa 8 khách, gồm phòng khách riêng, khu ngủ cao cấp, ban công hoặc sân hiên riêng và dịch vụ quản gia theo yêu cầu.',
    cover_image_url = 'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg',
    marketing_name = 'Biệt thự Hoàng gia',
    marketing_tagline = 'Villa nguyên căn riêng tư · hồ bơi · quản gia tận tâm',
    marketing_description = 'Một căn biệt thự hoàn chỉnh dành riêng cho nhóm của bạn: phòng khách rộng để quây quần, khu ngủ êm ái, sân hiên hướng thiên nhiên và trải nghiệm hồ bơi riêng. Dịch vụ quản gia hỗ trợ đón tiếp, phục vụ bữa sáng tại villa và chuẩn bị những khoảnh khắc đáng nhớ cho tối đa 8 khách.'
WHERE id = 'RT009';

UPDATE rooms
SET description = CASE name
    WHEN '1704' THEN 'Biệt thự Hoàng gia 1704 là không gian nguyên căn trên tầng 17 với phòng khách riêng, khu ngủ sang trọng, sân hiên riêng và góc ngắm hoàng hôn. Villa phù hợp tối đa 8 khách, có quản gia hỗ trợ chuẩn bị bữa sáng tại villa và các trải nghiệm riêng theo yêu cầu.'
    WHEN '1804' THEN 'Biệt thự Hoàng gia 1804 mở ra một kỳ nghỉ riêng tư với phòng khách tách biệt, ban công rộng và khu nghỉ dưỡng trong nhà - ngoài trời liền mạch. Đây là một căn villa hoàn chỉnh cho tối đa 8 khách, thích hợp cho gia đình hoặc nhóm bạn muốn tận hưởng trọn vẹn không gian riêng.'
    WHEN '1904' THEN 'Biệt thự Hoàng gia 1904 mang đến cảm giác như một ngôi nhà nghỉ dưỡng riêng giữa tầng cao: phòng khách, khu ngủ cao cấp, khu vực dùng bữa và sân hiên ngắm thành phố. Quản gia tận tâm đồng hành để kỳ nghỉ của tối đa 8 khách trở nên nhẹ nhàng và đáng nhớ.'
    WHEN '2004' THEN 'Biệt thự Hoàng gia 2004 là căn villa đặc biệt ở tầng cao nhất của bộ sưu tập, nơi cả nhóm có thể tận hưởng phòng khách riêng, khu ngủ rộng, ban công riêng và không gian thư giãn biệt lập. Villa phục vụ tối đa 8 khách với dịch vụ quản gia và trải nghiệm cá nhân hóa.'
    ELSE description
END
WHERE room_type_id = 'RT009';

-- Hình ảnh villa thật khác nhau theo từng căn, ưu tiên ảnh ngoại thất/hồ bơi
-- cho cover và ảnh không gian nghỉ dưỡng cho gallery.
UPDATE room_images ri
JOIN rooms r ON r.id = ri.room_id
SET ri.relative_path = CASE CONCAT(r.name, ':', ri.display_order)
    WHEN '1704:0' THEN 'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg'
    WHEN '1704:1' THEN 'https://www.robbreport.com.sg/storage/2022/10/DPSAZ-P0442-Beach-Villa.16x9.jpg'
    WHEN '1704:2' THEN 'https://luxesocietyasia.com/wp-content/uploads/2020/03/One-Bedroom-Beachfront-Villa-Pool.jpg'
    WHEN '1804:0' THEN 'https://www.maldivesisles.com/uploads/S0cjedyHAJoB.jpg'
    WHEN '1804:1' THEN 'https://photos.travelmyth.com/hotels/480/21/m1-213617.jpg'
    WHEN '1804:2' THEN 'https://images.luxuryescapes.com/fl_progressive%2Cq_auto%3Agood/kgels7cqeefi0fiiwrkg'
    WHEN '1904:0' THEN 'https://static.hiamag.com/styles/autox754/public/article/18/10/2017/6084911-624901652.jpg'
    WHEN '1904:1' THEN 'https://media.luxeglobalawards.com/cdn-cgi/image/format%3Dauto/production/cJ8McLZdhROyg5K58v7TYa6vkNB9zn0m-TDL%20-%20Princess%20Beach%20Villa%20Exterior.jpg'
    WHEN '1904:2' THEN 'https://strohbeck-reisen.de/__we_thumbs__/2/4368_2025_Anantara_Kihavah_03.jpg'
    WHEN '2004:0' THEN 'https://vexploretours.com/wp-content/uploads/2022/03/The-Ritz-Carlton-Bali-Pavilion-Villa-With-Pool-Access-01.jpg'
    WHEN '2004:1' THEN 'https://lucidcm.imgix.net/95182/Hotel/61398/Image/q7pDHlIjl0C1J102FBG64g_WAD03639%20copy4.jpg.jpg?h=3534&w=5772'
    WHEN '2004:2' THEN 'https://www.hotelalpinemusk.com/image/pic6.webp'
    ELSE ri.relative_path
END
WHERE r.room_type_id = 'RT009' AND ri.active = TRUE;
