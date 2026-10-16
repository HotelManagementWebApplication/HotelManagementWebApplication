-- Dữ liệu kiểm thử riêng của Lê Huy. Chạy thủ công sau Flyway V1–V6.
-- sqlcmd -S 'tcp:localhost,1433' -E -C -d QLKS_LeHuy_Local -b -I -f 65001 -i database/demo/seed_lehuy_demo.sql
-- Không reset DB, không thay đổi schema, không gọi các file SQL khác.
-- Cần dữ liệu nhân viên và booking demo hiện có; không nạp lên dev/database chung.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'QLKS_LeHuy_Local'
    THROW 52400,N'Chỉ nạp dữ liệu test trên QLKS_LeHuy_Local.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'ACCOUNTING' AND vaiTro=N'Kế toán')
    OR NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'KITCHEN')
    THROW 52401,N'Cần tài khoản demo ACCOUNTING và KITCHEN trong database local trước khi nạp.',1;

BEGIN TRY
BEGIN TRANSACTION;
-- 1. Danh mục dịch vụ và vật dụng: chỉ bổ sung mã chưa có.
INSERT INTO dbo.DichVu (maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong, danhMuc, moTa, duongDanAnh)
SELECT sample.* FROM (VALUES
(N'BREAKFAST', N'Bữa sáng thượng hạng tại phòng', 450000.00, N'suất', 30, 15, 1, N'Dịch vụ tại phòng',
 N'Bữa sáng Âu–Á cao cấp phục vụ tận phòng, kèm trà và nước ép tươi.',
 N'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop&auto=format'),
(N'MINIBAR', N'Bổ sung minibar trong phòng', 180000.00, N'bộ', 36, 12, 1, N'Dịch vụ tại phòng',
 N'Nước uống, cà phê, trà và đồ ăn nhẹ bổ sung theo yêu cầu.',
 N'https://images.unsplash.com/photo-1540961403310-79825242906e?w=600&h=400&fit=crop&auto=format'),
(N'EXTRABED', N'Thêm giường phụ', 350000.00, N'đêm', 12, 3, 1, N'Dịch vụ tại phòng',
 N'Giường phụ tiêu chuẩn khách sạn, phù hợp gia đình và nhóm đông.',
 N'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=400&fit=crop&auto=format'),
(N'LNDRYEXP', N'Giặt ủi tận phòng · 4 giờ', 120000.00, N'món', 18, 5, 1, N'Dịch vụ tại phòng',
 N'Nhận đồ tại phòng, giặt hấp, là phẳng và hoàn trả trong 4 giờ.',
 N'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=600&h=400&fit=crop&auto=format'),
(N'LNDRYSTD', N'Giặt ủi tận phòng · Qua đêm', 80000.00, N'lần', 24, 6, 1, N'Dịch vụ tại phòng',
 N'Nhận trước 22:00 và hoàn trả vào sáng hôm sau trước 8:00.',
 N'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&h=400&fit=crop&auto=format'),
(N'PRESSING', N'Ủi nhanh tại phòng', 60000.00, N'món', 15, 4, 1, N'Dịch vụ tại phòng',
 N'Làm phẳng trang phục công tác hoặc dạ tiệc trong thời gian ngắn.',
 N'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&h=400&fit=crop&auto=format'),
(N'MAMREST', N'MaM Restaurant', 250000.00, N'suất', 120, 30, 1, N'Nhà hàng cao cấp',
 N'Bữa trưa hoặc bữa tối tại MaM Restaurant. Khách thuê theo gói ngày-đêm được miễn một bữa trưa và một bữa tối mỗi ngày cho từng khách trong booking.',
 N'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=520&fit=crop&auto=format'),
(N'DECOR', N'Set trang trí Lãng mạn / Kỷ niệm', 1200000.00, N'bộ', 8, 3, 1, N'Dịch vụ tại phòng',
 N'Hoa tươi, nến thơm, champagne và thảm cánh hoa hồng cho dịp đặc biệt.',
 N'https://images.unsplash.com/photo-1637515128249-df66173ee9b4?w=600&h=400&fit=crop&auto=format'),
(N'SPAMASS', N'Liệu trình Massage Thư giãn', 980000.00, N'lượt', 18, 6, 1, N'Spa',
 N'Massage toàn thân 60 phút với tinh dầu thiên nhiên, giúp phục hồi năng lượng.',
 N'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop&auto=format'),
(N'SPAFACIAL', N'Chăm sóc da mặt cao cấp', 1350000.00, N'lượt', 16, 5, 1, N'Spa',
 N'Liệu trình 75 phút làm sạch sâu, dưỡng ẩm và trẻ hóa da.',
 N'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop&auto=format'),
(N'STEAM', N'Xông hơi & Sauna', 500000.00, N'lượt', 24, 6, 1, N'Spa',
 N'Khu xông hơi khô, ướt và phòng thư giãn với liệu trình theo giờ.',
 N'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&h=520&fit=crop&auto=format'),
(N'LIMO', N'Xe đưa đón sân bay VIP Limousine', 850000.00, N'chuyến', 8, 2, 1, N'Đưa đón',
 N'Xe cao cấp với tài xế riêng đưa đón giữa sân bay Tân Sơn Nhất và khách sạn tại Vũng Tàu.',
 N'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=400&fit=crop&auto=format'),
(N'CITYTOUR', N'Tour Vũng Tàu – Nửa ngày', 650000.00, N'khách', 20, 6, 1, N'Đưa đón',
 N'Tham quan các địa danh nổi bật tại Vũng Tàu cùng hướng dẫn viên địa phương.',
 N'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&h=400&fit=crop&auto=format'),
(N'POOL', N'Hồ bơi vô cực & Jacuzzi', 200000.00, N'khách/ngày', 128, 32, 1, N'Giải trí',
 N'Tầng 21 · Miễn phí không giới hạn lượt cho khách đã đăng ký trong booking thuê theo gói ngày-đêm. Khách thuê theo giờ trả 200.000 đồng mỗi khách mỗi ngày.',
 N'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=600&h=400&fit=crop&auto=format'),
(N'GYM', N'Trung tâm Thể dục & Thể hình', 100000.00, N'khách/ngày', 96, 24, 1, N'Giải trí',
 N'Tầng 3–4 · Thiết bị tập luyện cao cấp, huấn luyện viên theo yêu cầu và lớp yoga hằng ngày.',
 N'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop&auto=format'),
(N'TENNIS', N'Sân Tennis & Cầu lông', 200000.00, N'giờ', 16, 4, 1, N'Giải trí',
 N'Sân thể thao có đèn chiếu sáng, hỗ trợ thuê vợt và bóng.',
 N'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&h=400&fit=crop&auto=format'),
(N'PINGPONG', N'Bóng bàn', 100000.00, N'giờ', 12, 3, 1, N'Giải trí',
 N'Không gian bóng bàn trong nhà, phù hợp giải trí nhẹ và hoạt động nhóm.',
 N'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=800&h=520&fit=crop&auto=format'),
(N'BADMINTON', N'Cầu lông', 150000.00, N'giờ', 16, 4, 1, N'Giải trí',
 N'Sân cầu lông tiêu chuẩn, có thể thuê vợt và cầu tại quầy tiện ích.',
 N'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=520&fit=crop&auto=format'),
(N'MEETING', N'Phòng họp & Hội nghị', 2500000.00, N'ngày', 6, 2, 1, N'Dịch vụ doanh nghiệp',
 N'Tầng 4 · Phòng họp đa năng cho 10–200 người, trang bị AV 4K và WiFi tốc độ cao.',
 N'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop&auto=format'),
(N'BOARDROOM', N'Phòng họp Executive', 3500000.00, N'ngày', 4, 1, 1, N'Dịch vụ doanh nghiệp',
 N'Phòng họp riêng cho ban điều hành, có màn hình trình chiếu và phục vụ tea-break.',
 N'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=520&fit=crop&auto=format'),
(N'DENTALKIT', N'Bộ bàn chải đánh răng và kem đánh răng', 0.00, N'gói', 240, 80, 0, N'Vật dụng phòng',
 N'Vật tư tiêu hao cấp phát cho khách lưu trú; chỉ kiểm kê nội bộ, không bán riêng.',
 N'https://images.unsplash.com/photo-1760184762833-7c6bd9ef1415?w=600&h=400&fit=crop&auto=format'),
(N'COMBONE', N'Lược dùng một lần', 0.00, N'cái', 180, 60, 0, N'Vật dụng phòng',
 N'Lược dùng một lần cấp phát tại phòng nghỉ; chỉ kiểm kê nội bộ, không bán riêng.',
 N'https://images.unsplash.com/photo-1609850808399-82fb0bb6fb32?w=600&h=400&fit=crop&auto=format'),
(N'TOWELRST', N'Khăn tắm lớn dự phòng kho tổng', 0.00, N'cái', 72, 24, 0, N'Vật dụng phòng',
 N'Khăn mới dự phòng để bổ sung kho buồng phòng; không tính chung với khăn sạch đang luân chuyển.',
 N'https://images.unsplash.com/photo-1709720402421-86971b148021?w=600&h=400&fit=crop&auto=format'),
(N'SOAPBAR', N'Xà phòng bánh mini', 0.00, N'cái', 180, 60, 0, N'Vật dụng phòng',
 N'Xà phòng dùng một lần cấp phát tại phòng nghỉ; chỉ kiểm kê nội bộ, không bán riêng.',
 N'https://images.unsplash.com/photo-1726235812628-23558521686f?w=600&h=400&fit=crop&auto=format'),
(N'SHAMPOO', N'Dầu gội mini 30 ml', 0.00, N'chai', 180, 60, 0, N'Vật dụng phòng',
 N'Dầu gội dung tích nhỏ cấp phát tại phòng nghỉ; chỉ kiểm kê nội bộ, không bán riêng.',
 N'https://images.unsplash.com/photo-1648383336009-27812dcbf260?w=600&h=400&fit=crop&auto=format'),
(N'BODYWASH', N'Sữa tắm mini 30 ml', 0.00, N'chai', 180, 60, 0, N'Vật dụng phòng',
 N'Sữa tắm dung tích nhỏ cấp phát tại phòng nghỉ; chỉ kiểm kê nội bộ, không bán riêng.',
 N'https://images.unsplash.com/photo-1648383336009-27812dcbf260?w=600&h=400&fit=crop&auto=format'),
(N'SHWRCAP', N'Mũ trùm tóc dùng một lần', 0.00, N'cái', 150, 50, 0, N'Vật dụng phòng',
 N'Mũ trùm tóc dùng một lần đặt trong bộ tiện nghi phòng tắm; chỉ kiểm kê nội bộ.',
 N'https://images.unsplash.com/photo-1750271336429-8b0a507785c0?w=600&h=400&fit=crop&auto=format'),
(N'VANITYKIT', N'Bộ bông tăm và bông cotton', 0.00, N'gói', 150, 50, 0, N'Vật dụng phòng',
 N'Bộ vệ sinh cá nhân đóng gói nhỏ đặt trong phòng tắm; chỉ kiểm kê nội bộ.',
 N'https://images.unsplash.com/photo-1750271336429-8b0a507785c0?w=600&h=400&fit=crop&auto=format')
) sample(maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong, danhMuc, moTa, duongDanAnh)
WHERE NOT EXISTS(SELECT 1 FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=sample.maDichVu);


-- 2. Món ăn, thức uống, đồ gia dụng và minibar
-- Manual additive demo data. Run after Flyway V1-V6, with the backend stopped.
-- Existing items and quantities are preserved. Internal stock is not published
-- to customers (dangHoatDong = 0), like the existing room-amenity fixtures.
-- Minibar stock uses the MINI SKU prefix and the existing food/beverage groups.

INSERT INTO dbo.DichVu
    (maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong, danhMuc, moTa, duongDanAnh)
SELECT sample.id, sample.name, sample.price, sample.unit, sample.stock, sample.threshold, 0, sample.category,
       N'Dữ liệu minh họa kiểm kê kho nội bộ; không niêm yết trên cổng khách hàng.', NULL
FROM (VALUES
    (N'FOODRICE', N'Cơm chiên hải sản', 95000, N'suất', 40, 10, N'Món ăn'),
    (N'FOODPHO', N'Phở bò', 85000, N'suất', 35, 10, N'Món ăn'),
    (N'FOODBREAD', N'Bánh mì trứng', 45000, N'suất', 25, 8, N'Món ăn'),
    (N'FOODSALAD', N'Salad rau củ', 65000, N'suất', 20, 5, N'Món ăn'),
    (N'DRNKWATER', N'Nước suối 500 ml', 15000, N'chai', 120, 30, N'Thức uống'),
    (N'DRNKCOLA', N'Nước ngọt cola 330 ml', 25000, N'lon', 72, 18, N'Thức uống'),
    (N'DRNKCOFF', N'Cà phê sữa', 35000, N'ly', 40, 10, N'Thức uống'),
    (N'DRNKTEA', N'Trà đào', 40000, N'ly', 35, 10, N'Thức uống'),
    (N'HHKETTLE', N'Ấm đun nước siêu tốc', 350000, N'cái', 18, 5, N'Vật dụng phòng'),
    (N'HHHAIRDRY', N'Máy sấy tóc', 280000, N'cái', 20, 5, N'Vật dụng phòng'),
    (N'HHGLASS', N'Ly thủy tinh', 25000, N'cái', 96, 24, N'Vật dụng phòng'),
    (N'HHHANGER', N'Móc treo quần áo', 10000, N'cái', 150, 40, N'Vật dụng phòng'),
    (N'MINIWATER', N'Minibar · Nước suối 350 ml', 20000, N'chai', 96, 24, N'Thức uống'),
    (N'MINICOLA', N'Minibar · Nước ngọt cola 330 ml', 30000, N'lon', 72, 18, N'Thức uống'),
    (N'MINIJUICE', N'Minibar · Nước ép cam 250 ml', 35000, N'chai', 48, 12, N'Thức uống'),
    (N'MINIBEER', N'Minibar · Bia lon 330 ml', 45000, N'lon', 48, 12, N'Thức uống'),
    (N'MINIWINE', N'Minibar · Rượu vang đỏ 187 ml', 180000, N'chai', 24, 6, N'Thức uống'),
    (N'MINICHOCO', N'Minibar · Chocolate thanh 40 g', 40000, N'gói', 48, 12, N'Món ăn'),
    (N'MINISNACK', N'Minibar · Snack khoai tây 50 g', 30000, N'gói', 60, 15, N'Món ăn'),
    (N'MINICANDY', N'Minibar · Kẹo trái cây 40 g', 25000, N'gói', 48, 12, N'Món ăn'),
    (N'MININUTS', N'Minibar · Hạt điều rang 50 g', 45000, N'gói', 36, 9, N'Món ăn'),
    (N'MINIBREAD', N'Minibar · Bánh quy bơ 60 g', 35000, N'gói', 48, 12, N'Món ăn')
) AS sample(id, name, price, unit, stock, threshold, category)
WHERE NOT EXISTS (SELECT 1 FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK) WHERE maDichVu = sample.id);



-- 3. Cấu hình lịch và giá demo
-- Manual demo configuration. Keep existing configuration and custom prices.
-- Price units in DichVu (hour/day/etc.) stay unchanged.
INSERT dbo.CauHinhLichDichVu(maDichVu,congSuat,donViKhaDung,soPhutMoiLuot,cachTinh,truTonKhiSuDung)
SELECT s.id,s.capacity,s.unit,s.minutes,s.mode,CASE WHEN s.id IN (N'BREAKFAST',N'MAMREST',N'DECOR',N'MINIBAR') THEN 1 ELSE 0 END
FROM (VALUES
    (N'BADMINTON',2,N'sân',60,N'Theo thời lượng'),
    (N'TENNIS',2,N'sân',60,N'Theo thời lượng'),
    (N'PINGPONG',2,N'bàn',60,N'Theo thời lượng'),
    (N'MEETING',2,N'phòng',1440,N'Theo thời lượng'),
    (N'BOARDROOM',1,N'phòng',1440,N'Theo thời lượng'),
    (N'CITYTOUR',20,N'suất',240,N'Theo lượt'),
    (N'LIMO',3,N'xe',120,N'Theo lượt'),
    (N'BREAKFAST',40,N'suất',60,N'Theo lượt'),
    (N'MAMREST',60,N'suất',120,N'Theo lượt'),
    (N'SPAMASS',6,N'suất',60,N'Theo lượt'),
    (N'SPAFACIAL',4,N'suất',75,N'Theo lượt'),
    (N'STEAM',8,N'suất',60,N'Theo lượt'),
    (N'POOL',32,N'suất',1440,N'Theo ngày'),
    (N'GYM',20,N'suất',1440,N'Theo ngày'),
    (N'EXTRABED',12,N'giường',1440,N'Theo kỳ lưu trú'),
    (N'LNDRYEXP',18,N'món',240,N'Theo lượt'),
    (N'LNDRYSTD',24,N'lượt',1440,N'Qua đêm'),
    (N'PRESSING',15,N'món',60,N'Theo lượt'),
    (N'DECOR',8,N'bộ',120,N'Theo lượt'),
    (N'MINIBAR',36,N'bộ',60,N'Theo tồn kho')
) s(id,capacity,unit,minutes,mode)
JOIN dbo.DichVu d ON d.maDichVu=s.id
WHERE NOT EXISTS (SELECT 1 FROM dbo.CauHinhLichDichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=s.id);

-- Existing housekeeping fixtures have no price; add demo unit prices only
-- where still zero, preserving any price users have already entered.
UPDATE d SET gia=p.price
FROM dbo.DichVu d JOIN (VALUES
    (N'DENTALKIT',12000),(N'COMBONE',5000),(N'TOWELRST',120000),
    (N'SOAPBAR',8000),(N'SHAMPOO',15000),(N'BODYWASH',15000),
    (N'SHWRCAP',3000),(N'VANITYKIT',7000)
) p(id,price) ON p.id=d.maDichVu WHERE d.gia=0;


-- 4. Lượt đặt dịch vụ demo
-- Private Le Huy demo only. These reservations are samples for the time filter.
IF DB_NAME()<>N'QLKS_LeHuy_Local' THROW 51000,N'Chỉ nạp lịch mẫu vào QLKS_LeHuy_Local.',1;

INSERT dbo.DatDichVuKhachSan(maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,soLuong,soLuongMienPhi,donGia,trangThai,khoaYeuCau,maBamYeuCau,nguoiTao,ghiChu)
SELECT p.maPhieuDatPhong,p.maPhong,s.id,DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATE))),s.quantity,0,d.gia,N'Đã xác nhận',
    N'lehuy-schedule-'+s.id,REPLICATE(N'a',64),N'KITCHEN',N'Lịch mẫu kiểm tra công suất theo thời gian'
FROM (VALUES (N'BADMINTON',10,2),(N'BOARDROOM',8,1),(N'CITYTOUR',9,4),(N'SPAMASS',10,2),(N'EXTRABED',8,1)) s(id,hour,quantity)
JOIN dbo.DichVu d ON d.maDichVu=s.id
JOIN dbo.ChiTietDatPhong p ON p.maPhieuDatPhong=1 AND p.maPhong=N'501'
JOIN dbo.PhieuDatPhong r ON r.maPhieuDatPhong=p.maPhieuDatPhong
WHERE r.trangThai=N'Đã nhận phòng'
    AND DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATE)))>=p.thoiDiemNhanPhong
    AND DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATE)))<p.thoiDiemTraPhong
    AND NOT EXISTS (SELECT 1 FROM dbo.DatDichVuKhachSan WITH(UPDLOCK,HOLDLOCK) WHERE khoaYeuCau=N'lehuy-schedule-'+s.id);


-- 5. Tài khoản và lịch bàn giao Kế toán
-- Additive, local-only cash handover roster. No financial entries are generated.
IF DB_NAME() <> N'QLKS_LeHuy_Local'
    THROW 52400, N'Chỉ chạy dữ liệu này trên database demo QLKS_LeHuy_Local.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'ACCOUNTING' AND vaiTro=N'Kế toán')
    THROW 52401, N'Cần tài khoản demo ACCOUNTING trước khi thêm lịch bàn giao.', 1;

-- Reuse the existing demo password hash; never change the original account.
INSERT INTO dbo.NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai)
SELECT sample.id,sample.name,original.matKhau,N'Kế toán',sample.phone
FROM (VALUES
    (N'ACCNEXT1',N'Nguyễn Minh Anh (Demo ca chiều)',N'0999000201'),
    (N'ACCNEXT2',N'Trần Hoàng Nam (Demo ca đêm)',N'0999000202')
) sample(id,name,phone)
CROSS JOIN dbo.NhanVien original
WHERE original.maNhanVien=N'ACCOUNTING'
  AND NOT EXISTS(SELECT 1 FROM dbo.NhanVien existing WHERE existing.maNhanVien=sample.id);

DECLARE @today date=CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS date);
DECLARE @roster TABLE(employee nvarchar(10),shiftCode nvarchar(30) COLLATE Vietnamese_100_CS_AS,startsAt datetime2,endsAt datetime2);
INSERT @roster
SELECT sample.employee,sample.shiftCode,
       DATEADD(hour,sample.startHour,DATEADD(day,days.offsetDay,CAST(@today AS datetime2))),
       DATEADD(hour,sample.endHour,DATEADD(day,days.offsetDay,CAST(@today AS datetime2)))
FROM (VALUES
    (N'ACCOUNTING',N'Ca sáng',6,14),
    (N'ACCNEXT1',N'Ca chiều',14,22),
    (N'ACCNEXT2',N'Ca đêm',22,30)
) sample(employee,shiftCode,startHour,endHour)
CROSS JOIN (VALUES (0),(1),(2)) days(offsetDay);

-- Preserve real assignments and existing demo assignments, including cancelled rows.
INSERT INTO dbo.CaLamViecNhanVien(maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao)
SELECT r.employee,CAST(r.startsAt AS date),r.shiftCode,r.startsAt,r.endsAt,N'Đã phân công',N'ACCOUNTING'
FROM @roster r
WHERE NOT EXISTS(SELECT 1 FROM dbo.CaLamViecNhanVien ca
                 WHERE ca.maNhanVien=r.employee AND ca.ngayLamCa=CAST(r.startsAt AS date) AND ca.maCa=r.shiftCode)
  AND NOT EXISTS(SELECT 1 FROM dbo.CaLamViecNhanVien ca
                 WHERE ca.maNhanVien=r.employee AND ca.trangThai<>N'Đã hủy'
                   AND ca.thoiDiemBatDau<r.endsAt AND ca.thoiDiemKetThuc>r.startsAt);

SELECT maNhanVien,hoVaTen,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai
FROM dbo.vwLichLamViecNhanVien
WHERE maNhanVien IN(N'ACCOUNTING',N'ACCNEXT1',N'ACCNEXT2') AND ngayLamCa BETWEEN @today AND DATEADD(day,2,@today)
ORDER BY thoiDiemBatDau;

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
