-- Manual additive demo data. Run after Flyway V1-V6, with the backend stopped.
-- Existing items and quantities are preserved. Internal stock is not published
-- to customers (dangHoatDong = 0), like the existing room-amenity fixtures.
-- Minibar stock uses the MINI SKU prefix and the existing food/beverage groups.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

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

COMMIT TRANSACTION;
