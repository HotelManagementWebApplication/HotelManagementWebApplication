ALTER TABLE room_types
    ADD COLUMN marketing_name VARCHAR(200) NULL,
    ADD COLUMN marketing_description VARCHAR(1200) NULL;

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
        WHEN 'RT009' THEN 'Biệt thự tổng thống đỉnh cao với hồ bơi vô cực riêng biệt, khuôn viên chan hòa thiên nhiên, phòng ăn riêng và dịch vụ quản gia 24/7 độc quyền cùng xe Rolls-Royce đưa đón.'
    END
WHERE id IN ('RT001', 'RT002', 'RT003', 'RT004', 'RT005', 'RT006', 'RT007', 'RT008', 'RT009');
