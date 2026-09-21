ALTER TABLE room_types
    ADD COLUMN marketing_tagline VARCHAR(500) NULL,
    ADD COLUMN gallery_image_urls TEXT NULL;

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
        WHEN room_type_code = 'STD' THEN 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'SUP' THEN 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'DLX' THEN 'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=900&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'SUT' THEN 'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=900&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1578898886225-c7c894047899?w=1200&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=900&h=750&fit=crop&auto=format'
        WHEN room_type_code = 'VIP' THEN 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&h=750&fit=crop&auto=format
https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&h=750&fit=crop&auto=format'
    END
WHERE id IN ('RT001', 'RT002', 'RT003', 'RT004', 'RT005', 'RT006', 'RT007', 'RT008', 'RT009');
