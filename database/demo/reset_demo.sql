-- Manual demo reset. Run only after Flyway has applied all current migrations.
-- The database is not in production; this script rebuilds customer-facing demo data.
-- Demo reset rebuilds employee accounts as part of the disposable dataset.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM HangDoiThongBao;
DELETE FROM ChiTietTienBanGiao;
DELETE FROM TaiSanKyThuat;
DELETE FROM BienDongTonKho;
DELETE FROM MatHangTonKho;
DELETE FROM DonNghiPhep;
DELETE FROM ChamCong;
DELETE FROM HoaDonGiaTriGiaTang;
DELETE FROM DatDichVuKhachSan;
DELETE FROM ButToanTaiChinh;
DELETE FROM ThanhToanCongNoDoiTac;
DELETE FROM BienLai;
DELETE FROM GiaoDichThanhToan;
DELETE FROM DieuChinhHoaDon;
DELETE FROM HoaDon;
DELETE FROM SuCoThietBi;
DELETE FROM SuDungDichVu;
DELETE FROM ChuyenPhong;
DELETE FROM ChiTietDatPhong;
DELETE FROM PhieuDatPhong;
DELETE FROM MaLamMoiDangNhap;
DELETE FROM TaiKhoanKhachHang;
DELETE FROM LichSuHangThanhVien;
DELETE FROM SuKienDangNhapNhanVien;
DELETE FROM CaLamViecNhanVien;
DELETE FROM KiemTraBuongPhong;
DELETE FROM KetQuaChecklistBuongPhong;
DELETE FROM MauChecklistBuongPhong;
DELETE FROM NhiemVuBuongPhong;
DELETE FROM PhieuCongViecKyThuat;
DELETE FROM PhieuBaoTri;
DELETE FROM ThietBiPhong;
DELETE FROM HinhAnhLoaiPhong;
DELETE FROM HinhAnhPhong;
DELETE FROM LoaiPhongTienNghi;
DELETE FROM TienNghi;
DELETE FROM BienDongKhoDichVu;
DELETE FROM LichSuGiaDichVu;
DELETE FROM DichVu;
DELETE FROM LichSuGiaLoaiPhong;
DELETE FROM Phong;
DELETE FROM KhachLuuTru;
DELETE FROM LoaiPhong;
DELETE FROM CongNoDoiTac;
DELETE FROM KhoanChi;
DELETE FROM BanGiaoTienCa;
DELETE FROM YeuCauPheDuyet;
DELETE FROM NhatKyKiemSoat;
DELETE FROM BanGhiChongTrung;
DELETE FROM NhanVien;

DBCC CHECKIDENT (N'KhachLuuTru', RESEED, 0);
DBCC CHECKIDENT (N'TaiKhoanKhachHang', RESEED, 0);
DBCC CHECKIDENT (N'PhieuDatPhong', RESEED, 0);
DBCC CHECKIDENT (N'ChuyenPhong', RESEED, 0);
DBCC CHECKIDENT (N'HoaDon', RESEED, 0);
DBCC CHECKIDENT (N'SuCoThietBi', RESEED, 0);
DBCC CHECKIDENT (N'TienNghi', RESEED, 0);
DBCC CHECKIDENT (N'HinhAnhPhong', RESEED, 0);
DBCC CHECKIDENT (N'YeuCauPheDuyet', RESEED, 0);
DBCC CHECKIDENT (N'NhatKyKiemSoat', RESEED, 0);
DBCC CHECKIDENT (N'MaLamMoiDangNhap', RESEED, 0);
DBCC CHECKIDENT (N'DatDichVuKhachSan', RESEED, 0);
DBCC CHECKIDENT (N'CongNoDoiTac', RESEED, 0);
DBCC CHECKIDENT (N'ThanhToanCongNoDoiTac', RESEED, 0);
DBCC CHECKIDENT (N'KhoanChi', RESEED, 0);
DBCC CHECKIDENT (N'BanGiaoTienCa', RESEED, 0);
DBCC CHECKIDENT (N'GiaoDichThanhToan', RESEED, 0);
DBCC CHECKIDENT (N'BienLai', RESEED, 0);
DBCC CHECKIDENT (N'ButToanTaiChinh', RESEED, 0);
DBCC CHECKIDENT (N'BienDongKhoDichVu', RESEED, 0);
DBCC CHECKIDENT (N'ThietBiPhong', RESEED, 0);
DBCC CHECKIDENT (N'LichSuGiaLoaiPhong', RESEED, 0);
DBCC CHECKIDENT (N'NhiemVuBuongPhong', RESEED, 0);
DBCC CHECKIDENT (N'MauChecklistBuongPhong', RESEED, 0);
DBCC CHECKIDENT (N'KetQuaChecklistBuongPhong', RESEED, 0);
DBCC CHECKIDENT (N'KiemTraBuongPhong', RESEED, 0);
DBCC CHECKIDENT (N'PhieuCongViecKyThuat', RESEED, 0);
DBCC CHECKIDENT (N'CaLamViecNhanVien', RESEED, 0);
DBCC CHECKIDENT (N'ChiTietTienBanGiao', RESEED, 0);
DBCC CHECKIDENT (N'BienDongTonKho', RESEED, 0);
DBCC CHECKIDENT (N'DonNghiPhep', RESEED, 0);
DBCC CHECKIDENT (N'ChamCong', RESEED, 0);
DBCC CHECKIDENT (N'HoaDonGiaTriGiaTang', RESEED, 0);
INSERT INTO LoaiPhong
(maLoaiPhong, ten, maHangPhong, giaTheoNgay, giaTheoGio, dienTich, huongNhin, loaiGiuong, soKhachToiDa, duongDanAnhBia, moTa, trangThaiDanhMuc, nguoiCapNhatDanhMuc, nguoiDuyetDanhMuc, thoiDiemCapNhatDanhMuc, thoiDiemDuyetDanhMuc)
VALUES
(N'RT001', N'Standard (STD) · Đơn', N'STD', 1200000.00, 180000.00, 18.00, N'Thành phố', N'Giường Queen', 2,
 N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=800&fit=crop&auto=format',
 N'Phòng tiêu chuẩn tiết kiệm, gọn gàng và đủ tiện nghi cho tối đa 2 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT002', N'Standard (STD) · Đôi', N'STD', 1450000.00, 220000.00, 25.00, N'Thành phố', N'Hai giường đơn', 4,
 N'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=800&fit=crop&auto=format',
 N'Phòng STD rộng hơn với hai giường đơn, phù hợp nhóm nhỏ tối đa 4 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT003', N'Superior (SUP) · Đơn', N'SUP', 1800000.00, 260000.00, 28.00, N'Hướng vườn', N'Giường King', 2,
 N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=800&fit=crop&auto=format',
 N'Không gian SUP thoáng hơn, nội thất nâng cấp và cửa sổ hướng vườn.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT004', N'Superior (SUP) · Đôi', N'SUP', 2100000.00, 300000.00, 35.00, N'Thành phố', N'Hai giường Queen', 4,
 N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&h=800&fit=crop&auto=format',
 N'Phòng SUP đôi rộng rãi với tầm nhìn thoáng, phù hợp gia đình tối đa 4 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT005', N'Deluxe (DLX) · King', N'DLX', 2600000.00, 380000.00, 45.00, N'Biển Vũng Tàu', N'Giường King', 4,
 N'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1200&h=800&fit=crop&auto=format',
 N'DLX tầng cao, diện tích rộng, hướng sông và trang thiết bị cao cấp.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT006', N'Deluxe (DLX) · Family', N'DLX', 3200000.00, 460000.00, 58.00, N'Toàn cảnh thành phố', N'Hai giường Queen + sofa', 6,
 N'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=1200&h=800&fit=crop&auto=format',
 N'DLX Family cho nhóm đông, có khu vực sofa và không gian nghỉ thoải mái tối đa 6 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT007', N'Suite (SUT) · Residence', N'SUT', 4500000.00, 650000.00, 78.00, N'Biển Vũng Tàu', N'Giường King + phòng khách', 8,
 N'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&h=800&fit=crop&auto=format',
 N'Suite Residence tầng cao với phòng khách riêng, bồn tắm và sức chứa tối đa 8 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT008', N'Suite (SUT) · Executive', N'SUT', 5800000.00, 800000.00, 92.00, N'Toàn cảnh thành phố', N'Giường King + phòng khách', 8,
 N'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&h=800&fit=crop&auto=format',
 N'Suite Executive rộng nhất hạng SUT, ban công riêng và dịch vụ đón tiếp cao cấp.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME()),
(N'RT009', N'Biệt thự Hoàng gia · Nguyên căn', N'VIP', 9500000.00, 1200000.00, 120.00, N'Toàn cảnh thành phố', N'Giường King + phòng khách riêng', 8,
 N'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg',
 N'Một căn biệt thự hoàn chỉnh dành riêng cho nhóm của bạn, gồm phòng khách riêng, khu ngủ cao cấp, sân hiên hoặc ban công riêng, dịch vụ quản gia và sức chứa tối đa 8 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', SYSDATETIME(), SYSDATETIME());

UPDATE LoaiPhong
SET khauHieuQuangBa = CASE maLoaiPhong
        WHEN N'RT001' THEN N'Ánh sáng tự nhiên ngập tràn & phong vị nghỉ dưỡng thanh bình'
        WHEN N'RT002' THEN N'Ánh sáng tự nhiên ngập tràn & phong vị nghỉ dưỡng thanh bình'
        WHEN N'RT003' THEN N'Ban công riêng hướng vịnh ngọc & bồn tắm thảo mộc thư thái'
        WHEN N'RT004' THEN N'Ban công riêng hướng vịnh ngọc & bồn tắm thảo mộc thư thái'
        WHEN N'RT005' THEN N'Tầm nhìn biển thoáng đạt, bồn đá cẩm thạch & ban công đón nắng'
        WHEN N'RT006' THEN N'Tầm nhìn biển thoáng đạt, bồn đá cẩm thạch & ban công đón nắng'
        WHEN N'RT007' THEN N'Phòng khách biệt lập, ban công hoàng hôn & quản gia tận tâm'
        WHEN N'RT008' THEN N'Phòng khách biệt lập, ban công hoàng hôn & quản gia tận tâm'
        WHEN N'RT009' THEN N'Hồ bơi vô cực biệt lập, quản gia 24/7 & xe đưa đón độc quyền'
    END;

INSERT INTO HinhAnhLoaiPhong (maLoaiPhong, duongDanAnh, thuTuHienThi)
SELECT t.maLoaiPhong, a.duongDanAnh, a.thuTuHienThi
FROM LoaiPhong t
JOIN (
    SELECT N'STD' maHangPhong, N'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&h=750&fit=crop&auto=format' duongDanAnh, 0 thuTuHienThi
    UNION ALL SELECT N'STD', N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=750&fit=crop&auto=format', 1
    UNION ALL SELECT N'STD', N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&h=750&fit=crop&auto=format', 2
    UNION ALL SELECT N'SUP', N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=750&fit=crop&auto=format', 0
    UNION ALL SELECT N'SUP', N'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=750&fit=crop&auto=format', 1
    UNION ALL SELECT N'SUP', N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format', 2
    UNION ALL SELECT N'DLX', N'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=900&h=750&fit=crop&auto=format', 0
    UNION ALL SELECT N'DLX', N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=750&fit=crop&auto=format', 1
    UNION ALL SELECT N'DLX', N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format', 2
    UNION ALL SELECT N'SUT', N'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=900&h=750&fit=crop&auto=format', 0
    UNION ALL SELECT N'SUT', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?w=1200&h=750&fit=crop&auto=format', 1
    UNION ALL SELECT N'SUT', N'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=900&h=750&fit=crop&auto=format', 2
    UNION ALL SELECT N'VIP', N'https://www.maldives.com/uploads/Anantara_Kihavah_Maldives_Villas_Accommodation_Villas_Beach_Pool_Villa_Exterior_a75316dd46.jpg', 0
    UNION ALL SELECT N'VIP', N'https://www.robbreport.com.sg/storage/2022/10/DPSAZ-P0442-Beach-Villa.16x9.jpg', 1
    UNION ALL SELECT N'VIP', N'https://luxesocietyasia.com/wp-content/uploads/2020/03/One-Bedroom-Beachfront-Villa-Pool.jpg', 2
) a ON a.maHangPhong = t.maHangPhong;

INSERT INTO Phong (maPhong, maLoaiPhong, trangThai, moTa, ten, tang, phienBan) VALUES
(N'501', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 5', N'501', 5, 0), (N'502', N'RT002', N'Sẵn sàng', N'STD đôi · tầng 5', N'502', 5, 0), (N'503', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 5', N'503', 5, 0), (N'504', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 5', N'504', 5, 0),
(N'601', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 6', N'601', 6, 0), (N'602', N'RT002', N'Đang dọn phòng', N'STD đôi · tầng 6', N'602', 6, 0), (N'603', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 6', N'603', 6, 0), (N'604', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 6', N'604', 6, 0),
(N'701', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 7', N'701', 7, 0), (N'702', N'RT002', N'Đang bảo trì', N'STD đôi · tầng 7', N'702', 7, 0), (N'703', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 7', N'703', 7, 0), (N'704', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 7', N'704', 7, 0),
(N'801', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 8', N'801', 8, 0), (N'802', N'RT002', N'Đã giữ phòng', N'STD đôi · tầng 8', N'802', 8, 0), (N'803', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 8', N'803', 8, 0), (N'804', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 8', N'804', 8, 0),
(N'901', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 9', N'901', 9, 0), (N'902', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 9', N'902', 9, 0), (N'903', N'RT005', N'Sẵn sàng', N'DLX King · tầng 9', N'903', 9, 0), (N'904', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 9', N'904', 9, 0),
(N'1001', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 10', N'1001', 10, 0), (N'1002', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 10', N'1002', 10, 0), (N'1003', N'RT005', N'Sẵn sàng', N'DLX King · tầng 10', N'1003', 10, 0), (N'1004', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 10', N'1004', 10, 0),
(N'1101', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 11', N'1101', 11, 0), (N'1102', N'RT005', N'Sẵn sàng', N'DLX King · tầng 11', N'1102', 11, 0), (N'1103', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 11', N'1103', 11, 0), (N'1104', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 11', N'1104', 11, 0),
(N'1201', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 12', N'1201', 12, 0), (N'1202', N'RT005', N'Sẵn sàng', N'DLX King · tầng 12', N'1202', 12, 0), (N'1203', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 12', N'1203', 12, 0), (N'1204', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 12', N'1204', 12, 0),
(N'1301', N'RT005', N'Sẵn sàng', N'DLX King · tầng 13', N'1301', 13, 0), (N'1302', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 13', N'1302', 13, 0), (N'1303', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 13', N'1303', 13, 0), (N'1304', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 13', N'1304', 13, 0),
(N'1401', N'RT005', N'Sẵn sàng', N'DLX King · tầng 14', N'1401', 14, 0), (N'1402', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 14', N'1402', 14, 0), (N'1403', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 14', N'1403', 14, 0), (N'1404', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 14', N'1404', 14, 0),
(N'1501', N'RT005', N'Sẵn sàng', N'DLX King · tầng 15', N'1501', 15, 0), (N'1502', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 15', N'1502', 15, 0), (N'1503', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 15', N'1503', 15, 0), (N'1504', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 15', N'1504', 15, 0),
(N'1601', N'RT005', N'Sẵn sàng', N'DLX King · tầng 16', N'1601', 16, 0), (N'1602', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 16', N'1602', 16, 0), (N'1603', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 16', N'1603', 16, 0), (N'1604', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 16', N'1604', 16, 0),
(N'1701', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 17', N'1701', 17, 0), (N'1702', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 17', N'1702', 17, 0), (N'1703', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 17', N'1703', 17, 0), (N'1704', N'RT009', N'Sẵn sàng', N'VIP nguyên căn · tầng 17', N'1704', 17, 0),
(N'1801', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 18', N'1801', 18, 0), (N'1802', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 18', N'1802', 18, 0), (N'1803', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 18', N'1803', 18, 0), (N'1804', N'RT009', N'Sẵn sàng', N'VIP nguyên căn · tầng 18', N'1804', 18, 0),
(N'1901', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 19', N'1901', 19, 0), (N'1902', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 19', N'1902', 19, 0), (N'1903', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 19', N'1903', 19, 0), (N'1904', N'RT009', N'Sẵn sàng', N'VIP nguyên căn · tầng 19', N'1904', 19, 0),
(N'2001', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 20', N'2001', 20, 0), (N'2002', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 20', N'2002', 20, 0), (N'2003', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 20', N'2003', 20, 0), (N'2004', N'RT009', N'Sẵn sàng', N'VIP nguyên căn · tầng 20', N'2004', 20, 0);

-- Nội dung quảng cáo và gallery được gắn theo từng phòng, không dùng chung theo loại phòng.
UPDATE r
SET moTa = CONCAT(
    N'Phòng ', r.ten, N' tại tầng ', r.tang, N' mang đến ',
    CASE (TRY_CONVERT(INT, r.ten) % 4)
        WHEN 0 THEN N'góc nhìn rộng mở và không gian yên tĩnh cho kỳ nghỉ riêng tư. '
        WHEN 1 THEN N'ánh sáng tự nhiên dịu nhẹ cùng góc nghỉ hướng thành phố. '
        WHEN 2 THEN N'không gian thoáng đãng, phù hợp cho những ngày nghỉ thư thái. '
        ELSE N'cảm giác ấm cúng với tầm nhìn đẹp và nhịp nghỉ dưỡng thanh bình. '
    END,
    CASE t.maHangPhong
        WHEN N'STD' THEN N'Thiết kế tiêu chuẩn gọn gàng, giường ngủ êm ái và đầy đủ tiện nghi thiết yếu cho chuyến lưu trú thoải mái.'
        WHEN N'SUP' THEN N'Diện tích rộng rãi hơn, nội thất nâng cấp và khu vực nghỉ ngơi tiện nghi cho gia đình hoặc nhóm bạn.'
        WHEN N'DLX' THEN N'Không gian cao cấp với khu vực thư giãn riêng, trang thiết bị chọn lọc và trải nghiệm nghỉ dưỡng sang trọng.'
        WHEN N'SUT' THEN N'Phòng khách biệt lập, ban công riêng và tiện nghi cao cấp dành cho kỳ nghỉ dài ngày hoặc những dịp đặc biệt.'
        WHEN N'VIP' THEN N'Không gian nguyên căn riêng tư với phòng khách, ban công rộng và dịch vụ đón tiếp độc quyền.'
        ELSE N'Không gian lưu trú được chuẩn bị chỉn chu với các tiện nghi cần thiết cho khách nghỉ dưỡng.'
    END,
    N' Mã phòng: ', r.ten, N'.'
)
FROM Phong r
JOIN LoaiPhong t ON t.maLoaiPhong = r.maLoaiPhong;

INSERT INTO HinhAnhPhong
    (maPhong, duongDanTuongDoi, thuTuHienThi, laAnhBia, loaiNoiDung, kichThuocByte, dangHoatDong)
SELECT r.maPhong,
       CONCAT(
           N'https://images.unsplash.com/photo-',
           CASE t.maHangPhong
               WHEN N'STD' THEN CASE gallery.image_no
                   WHEN 0 THEN N'1584622650111-993a426fbf0a'
                   WHEN 1 THEN N'1582719478250-c89cae4dc85b'
                   ELSE N'1566665797739-1674de7a421a'
               END
               WHEN N'SUP' THEN CASE gallery.image_no
                   WHEN 0 THEN N'1618773928121-c32242e63f39'
                   WHEN 1 THEN N'1590490360182-c33d57733427'
                   ELSE N'1578683010236-d716f9a3f461'
               END
               WHEN N'DLX' THEN CASE gallery.image_no
                   WHEN 0 THEN N'1591088398332-8a7791972843d'
                   WHEN 1 THEN N'1618773928121-c32242e63f39'
                   ELSE N'1564078516393-cf04bd966897'
               END
               WHEN N'SUT' THEN CASE gallery.image_no
                   WHEN 0 THEN N'1629140727571-9b5c6f6267b4'
                   WHEN 1 THEN N'1578898886225-c7c894047899'
                   ELSE N'1507652313519-d4e9174996dd'
               END
               ELSE CASE gallery.image_no
                   WHEN 0 THEN N'1571896349842-33c89424de2d'
                   WHEN 1 THEN N'1540541338287-41700207dee6'
                   ELSE N'1520250497591-112f2f40a3f4'
               END
           END,
           N'?w=1200&h=800&fit=crop&auto=format&room=', r.maPhong,
           N'&view=', gallery.image_no + 1
       ),
       gallery.image_no,
       CASE WHEN gallery.image_no = 0 THEN 1 ELSE 0 END,
       N'image/jpeg',
       1,
       1
FROM Phong r
JOIN LoaiPhong t ON t.maLoaiPhong = r.maLoaiPhong
CROSS JOIN (
    SELECT 0 AS image_no
    UNION ALL SELECT 1
    UNION ALL SELECT 2
    UNION ALL SELECT 3
) AS gallery;
INSERT INTO TienNghi (ten, dangHoatDong) VALUES
(N'WiFi', 1), (N'Điều hòa', 1), (N'TV 4K', 1), (N'Minibar', 1),
(N'Két an toàn', 1), (N'Bồn tắm', 1), (N'Máy pha cà phê', 1),
(N'Ban công', 1), (N'Phòng khách riêng', 1), (N'Quản gia riêng', 1),
(N'Bàn làm việc', 1), (N'Sofa thư giãn', 1), (N'Bếp nhỏ', 1), (N'Dịch vụ quản gia 24/7', 1);
INSERT INTO LoaiPhongTienNghi (maLoaiPhong, maTienNghi)
SELECT N'RT001', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bàn làm việc')
UNION ALL SELECT N'RT002', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bàn làm việc')
UNION ALL SELECT N'RT003', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Bàn làm việc')
UNION ALL SELECT N'RT004', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc')
UNION ALL SELECT N'RT005', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc', N'Sofa thư giãn')
UNION ALL SELECT N'RT006', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc', N'Sofa thư giãn')
UNION ALL SELECT N'RT007', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Sofa thư giãn')
UNION ALL SELECT N'RT008', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Sofa thư giãn')
UNION ALL SELECT N'RT009', maTienNghi FROM TienNghi WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Quản gia riêng', N'Dịch vụ quản gia 24/7', N'Sofa thư giãn');

SET IDENTITY_INSERT KhachLuuTru ON;
INSERT INTO KhachLuuTru
(maKhachLuuTru, hoVaTen, diaChi, soDienThoai, email, soGiayToTuyThan, namSinh, hangThanhVien, tongChiTieu, soLanHuyMuon, soLanLuuTruHoanThanh, soLanTraPhongMuon, biChanDatPhong, phienBan)
VALUES
(1, N'Nguyễn Văn An', N'Quận 1, TP.HCM', N'0901234567', N'an.nguyen@example.test', N'012345678901',
  1990, N'Tiêu chuẩn', 0.00, 0, 0, 0, 0, 0),
(2, N'Trần Thị Bình', N'Quận 3, TP.HCM', N'0912345678', N'binh.tran@example.test', N'098765432109',
  1988, N'Bạch kim', 12000000.00, 0, 4, 0, 0, 0),
(3, N'Lê Hoàng Cường', N'Quận 7, TP.HCM', N'0923456789', N'cuong.le@example.test', N'112233445566',
  1995, N'Tiêu chuẩn', 500000.00, 1, 1, 0, 0, 0);
SET IDENTITY_INSERT KhachLuuTru OFF;
-- BCrypt cost 12 for plaintext matKhau: hotel123
INSERT INTO TaiKhoanKhachHang (maKhachLuuTru, soDienThoai, matKhau, duocKichHoat, taiKhoanKhongBiKhoa)
SELECT maKhachLuuTru, soDienThoai, N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', 1, 1
FROM KhachLuuTru WHERE soDienThoai = N'0901234567';
-- Demo employee identities. BCrypt cost 12 for plaintext matKhau: hotel123
-- These are real backend accounts used by the role-specific frontend portals.
INSERT INTO NhanVien
    (maNhanVien, hoVaTen, matKhau, vaiTro, diaChi, soDienThoai, duocKichHoat, taiKhoanKhongBiKhoa, soLanDangNhapThatBai, trangThaiLamViec)
VALUES
    (N'FRONTDESK', N'Nguyễn Minh Lễ Tân', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Lễ tân', N'TP.HCM', N'0902000001', 1, 1, 0, N'Đang làm việc'),
    (N'HOUSEKEEP', N'Trần Thị Buồng Phòng', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Buồng phòng', N'TP.HCM', N'0902000002', 1, 1, 0, N'Đang làm việc'),
    (N'TECHNICAL', N'Lê Hoàng Kỹ Thuật', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Kỹ thuật', N'TP.HCM', N'0902000003', 1, 1, 0, N'Đang làm việc'),
    (N'ACCOUNTING', N'Phạm Thị Kế Toán', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Kế toán', N'TP.HCM', N'0902000004', 1, 1, 0, N'Đang làm việc'),
    (N'KITCHEN', N'Võ Minh Bếp', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Nhà bếp', N'TP.HCM', N'0902000005', 1, 1, 0, N'Đang làm việc'),
    (N'MANAGER', N'Hoàng Minh Quản', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Quản lý', N'TP.HCM', N'0902000006', 1, 1, 0, N'Đang làm việc'),
    (N'DIRECTOR', N'Đỗ Thanh Giám Đốc', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Giám đốc', N'TP.HCM', N'0902000007', 1, 1, 0, N'Đang làm việc'),
    (N'ADMIN', N'Quản Trị Hệ Thống', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Quản trị viên', N'TP.HCM', N'0902000008', 1, 1, 0, N'Đang làm việc'),
    (N'HR', N'Nguyễn Thị Nhân Sự', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Nhân sự', N'TP.HCM', N'0902000009', 1, 1, 0, N'Đang làm việc'),
    (N'STAFF', N'Nhân Viên Vận Hành', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Nhân viên', N'TP.HCM', N'0902000010', 1, 1, 0, N'Đang làm việc')
;INSERT INTO DichVu
(maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong, danhMuc, moTa, duongDanAnh)
VALUES
(N'BREAKFAST', N'Bữa sáng thượng hạng tại phòng', 450000.00, N'suất', 999, 0, 1, N'Dịch vụ tại phòng',
 N'Bữa sáng Âu–Á cao cấp phục vụ tận phòng, kèm trà và nước ép tươi.',
 N'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop&auto=format'),
(N'MINIBAR', N'Bổ sung minibar trong phòng', 180000.00, N'bộ', 999, 0, 1, N'Dịch vụ tại phòng',
 N'Nước uống, cà phê, trà và đồ ăn nhẹ bổ sung theo yêu cầu.',
 N'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&h=400&fit=crop&auto=format'),
(N'EXTRABED', N'Thêm giường phụ', 350000.00, N'đêm', 20, 2, 1, N'Dịch vụ tại phòng',
 N'Giường phụ tiêu chuẩn khách sạn, phù hợp gia đình và nhóm đông.',
 N'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=400&fit=crop&auto=format'),
(N'LNDRYEXP', N'Giặt ủi tận phòng · 4 giờ', 120000.00, N'món', 999, 0, 1, N'Dịch vụ tại phòng',
 N'Nhận đồ tại phòng, giặt hấp, là phẳng và hoàn trả trong 4 giờ.',
 N'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=600&h=400&fit=crop&auto=format'),
(N'LNDRYSTD', N'Giặt ủi tận phòng · Qua đêm', 80000.00, N'lần', 999, 0, 1, N'Dịch vụ tại phòng',
 N'Nhận trước 22:00 và hoàn trả vào sáng hôm sau trước 8:00.',
 N'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&h=400&fit=crop&auto=format'),
(N'PRESSING', N'Ủi nhanh tại phòng', 60000.00, N'món', 999, 0, 1, N'Dịch vụ tại phòng',
 N'Làm phẳng trang phục công tác hoặc dạ tiệc trong thời gian ngắn.',
 N'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&h=400&fit=crop&auto=format'),
(N'MAMREST', N'MaM Restaurant', 250000.00, N'suất', 999999, 0, 1, N'Nhà hàng cao cấp',
 N'Bữa trưa hoặc bữa tối tại MaM Restaurant. Khách thuê theo gói ngày-đêm được miễn một bữa trưa và một bữa tối mỗi ngày cho từng khách trong booking.',
 N'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=520&fit=crop&auto=format'),
(N'DECOR', N'Set trang trí Lãng mạn / Kỷ niệm', 1200000.00, N'bộ', 30, 5, 1, N'Nhà hàng cao cấp',
 N'Hoa tươi, nến thơm, champagne và thảm cánh hoa hồng cho dịp đặc biệt.',
 N'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop&auto=format'),
(N'SPAMASS', N'Liệu trình Massage Thư giãn', 980000.00, N'lượt', 999, 0, 1, N'Spa',
 N'Massage toàn thân 60 phút với tinh dầu thiên nhiên, giúp phục hồi năng lượng.',
 N'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop&auto=format'),
(N'SPAFACIAL', N'Chăm sóc da mặt cao cấp', 1350000.00, N'lượt', 999, 0, 1, N'Spa',
 N'Liệu trình 75 phút làm sạch sâu, dưỡng ẩm và trẻ hóa da.',
 N'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=400&fit=crop&auto=format'),
(N'STEAM', N'Xông hơi & Sauna', 500000.00, N'lượt', 999, 0, 1, N'Spa',
 N'Khu xông hơi khô, ướt và phòng thư giãn với liệu trình theo giờ.',
 N'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&h=520&fit=crop&auto=format'),
(N'LIMO', N'Xe đưa đón sân bay VIP Limousine', 850000.00, N'chuyến', 999, 0, 1, N'Đưa đón',
 N'Xe cao cấp với tài xế riêng đưa đón giữa sân bay Tân Sơn Nhất và khách sạn tại Vũng Tàu.',
 N'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=400&fit=crop&auto=format'),
(N'CITYTOUR', N'Tour Vũng Tàu – Nửa ngày', 650000.00, N'khách', 999, 0, 1, N'Đưa đón',
 N'Tham quan các địa danh nổi bật tại Vũng Tàu cùng hướng dẫn viên địa phương.',
 N'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&h=400&fit=crop&auto=format'),
(N'POOL', N'Hồ bơi vô cực & Jacuzzi', 200000.00, N'khách/ngày', 999, 0, 1, N'Giải trí',
 N'Tầng 21 · Miễn phí không giới hạn lượt cho khách đã đăng ký trong booking thuê theo gói ngày-đêm. Khách thuê theo giờ trả 200.000 đồng mỗi khách mỗi ngày.',
 N'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=600&h=400&fit=crop&auto=format'),
(N'GYM', N'Trung tâm Thể dục & Thể hình', 100000.00, N'khách/ngày', 999, 0, 1, N'Giải trí',
 N'Tầng 3–4 · Thiết bị tập luyện cao cấp, huấn luyện viên theo yêu cầu và lớp yoga hằng ngày.',
 N'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop&auto=format'),
(N'TENNIS', N'Sân Tennis & Cầu lông', 200000.00, N'giờ', 999, 0, 1, N'Giải trí',
 N'Sân thể thao có đèn chiếu sáng, hỗ trợ thuê vợt và bóng.',
 N'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&h=400&fit=crop&auto=format'),
(N'PINGPONG', N'Bóng bàn', 100000.00, N'giờ', 999, 0, 1, N'Giải trí',
 N'Không gian bóng bàn trong nhà, phù hợp giải trí nhẹ và hoạt động nhóm.',
 N'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=800&h=520&fit=crop&auto=format'),
(N'BADMINTON', N'Cầu lông', 150000.00, N'giờ', 999, 0, 1, N'Giải trí',
 N'Sân cầu lông tiêu chuẩn, có thể thuê vợt và cầu tại quầy tiện ích.',
 N'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=520&fit=crop&auto=format'),
(N'MEETING', N'Phòng họp & Hội nghị', 2500000.00, N'ngày', 999, 0, 1, N'Dịch vụ doanh nghiệp',
 N'Tầng 4 · Phòng họp đa năng cho 10–200 người, trang bị AV 4K và WiFi tốc độ cao.',
 N'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop&auto=format'),
(N'BOARDROOM', N'Phòng họp Executive', 3500000.00, N'ngày', 999, 0, 1, N'Dịch vụ doanh nghiệp',
 N'Phòng họp riêng cho ban điều hành, có màn hình trình chiếu và phục vụ tea-break.',
 N'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=520&fit=crop&auto=format');

-- End-to-end demo transactions. These rows deliberately laAnhBia the states shown by
-- the customer portal, front desk, accounting, housekeeping, technical and manager screens.
SET IDENTITY_INSERT PhieuDatPhong ON;
INSERT INTO PhieuDatPhong
    (maPhieuDatPhong, maKhachLuuTru, maNhanVien, maTaiKhoanKhachHang, thoiDiemDat, tienDatCoc, trangThai, hinhThucThue, thoiDiemNhanPhongThucTe, thoiDiemTraPhongThucTe, soPhutGiaHan, khoaChongTrung, phienBan, maThanhToanDatCoc, thoiDiemHetHanThanhToanCoc, trangThaiThanhToanCoc)
VALUES
    (1, 1, N'FRONTDESK', (SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE soDienThoai = N'0901234567'),
     DATEADD(DAY, -2, SYSDATETIME()), 1000000.00, N'Đã nhận phòng', N'Theo gói',
     DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -1, CAST(SYSDATETIME() AS date)) AS datetime2)), NULL, 0, N'DEMO-RES-001', 0,
     NULL, NULL, N'Đã thanh toán'),
    (2, 2, N'FRONTDESK', NULL,
     DATEADD(DAY, -3, SYSDATETIME()), 0.00, N'Đã xác nhận', N'Theo gói',
     NULL, NULL, 0, N'DEMO-RES-002', 0,
     NULL, NULL, N'Không yêu cầu'),
    (3, 3, N'FRONTDESK', NULL,
     DATEADD(DAY, -2, SYSDATETIME()), 0.00, N'Đã nhận phòng', N'Theo gói',
     DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)) AS datetime2)), NULL, 0, N'DEMO-RES-003', 0,
     NULL, NULL, N'Không yêu cầu'),
    (4, 2, N'FRONTDESK', NULL,
     DATEADD(DAY, -7, SYSDATETIME()), 2900000.00, N'Đã trả phòng', N'Theo gói',
     DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -5, CAST(SYSDATETIME() AS date)) AS datetime2)),
     DATEADD(SECOND, 41400, CAST(DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)) AS datetime2)), 0, N'DEMO-RES-004', 0,
     NULL, NULL, N'Đã thanh toán'),
    (5, 1, NULL, (SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE soDienThoai = N'0901234567'),
     SYSDATETIME(), 270000.00, N'Bản nháp', N'Theo giờ',
     NULL, NULL, 0, N'DEMO-RES-005', 0,
     N'DEMO-DEP-005', DATEADD(MINUTE, 30, SYSDATETIME()), N'Chờ thanh toán'),
    (6, 1, NULL, (SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE soDienThoai = N'0901234567'),
     SYSDATETIME(), 3900000.00, N'Đã thanh toán cọc', N'Theo gói',
     NULL, NULL, 0, N'DEMO-RES-006', 0,
     N'DEMO-DEP-006', NULL, N'Đã thanh toán');
SET IDENTITY_INSERT PhieuDatPhong OFF;

INSERT INTO ChiTietDatPhong
    (maPhieuDatPhong, maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, thoiDiemTraPhongBanDau, trangThai, soLanChuyenPhong, soLuongKhach)
VALUES
    (1, N'501', DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), N'Đang có khách', 0, 2),
    (2, N'502', DATEADD(SECOND, 50400, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(SYSDATETIME() AS date)) AS datetime2)), N'Đã giữ phòng', 0, 1),
    (3, N'601', DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 43200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Đang có khách', 0, 1),
    (4, N'701', DATEADD(SECOND, 50400, CAST(DATEADD(DAY, -5, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)) AS datetime2)), N'Đã trả phòng', 0, 2),
    (5, N'801', DATEADD(SECOND, 54000, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 64800, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 64800, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), N'Đã giữ phòng', 0, 1),
    (6, N'1401', DATEADD(SECOND, 50400, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(SYSDATETIME() AS date)) AS datetime2)), DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(SYSDATETIME() AS date)) AS datetime2)), N'Đã giữ phòng', 0, 2);

UPDATE Phong SET trangThai = CASE maPhong
    WHEN N'501' THEN N'Đang có khách'
    WHEN N'502' THEN N'Đã giữ phòng'
    WHEN N'601' THEN N'Đang có khách'
    WHEN N'602' THEN N'Đang dọn phòng'
    WHEN N'701' THEN N'Đang dọn phòng'
    WHEN N'702' THEN N'Đang bảo trì'
    WHEN N'801' THEN N'Đã giữ phòng'
    WHEN N'802' THEN N'Sẵn sàng'
    ELSE trangThai
END;

-- Customer demo bookings with a deposit code are VNPay bookings. Keep the
-- payment channel explicit so the customer portal and checkout guard agree.
UPDATE PhieuDatPhong
SET phuongThucBaoDam = N'VNPay'
WHERE maPhieuDatPhong IN (5, 6)
  AND maThanhToanDatCoc IS NOT NULL;

INSERT INTO SuDungDichVu (maPhieuDatPhong, maDichVu, ngaySuDung, soLuong, donGia) VALUES
    (1, N'BREAKFAST', DATEADD(DAY, -1, CAST(SYSDATETIME() AS date)), 2, 0.00),
    (1, N'SPAMASS', CAST(SYSDATETIME() AS date), 1, 980000.00),
    (3, N'BREAKFAST', CAST(SYSDATETIME() AS date), 1, 0.00),
    (4, N'SPAFACIAL', DATEADD(DAY, -3, CAST(SYSDATETIME() AS date)), 1, 1350000.00);

INSERT INTO DatDichVuKhachSan
    (maPhieuDatPhong, maPhong, maDichVu, thoiDiemDuKien, buoiAn, soLuong, soLuongMienPhi, donGia, trangThai, khoaYeuCau, maBamYeuCau, nguoiTao, thoiDiemSuDung, nguoiXacNhanSuDung)
VALUES
    (1, N'501', N'MAMREST', DATEADD(SECOND, 43200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Bữa trưa', 2, 2,
     250000.00, N'Đã sử dụng', N'DEMO-SERVICE-001', REPLICATE(N'0', 64), N'FRONTDESK', SYSDATETIME(), N'FRONTDESK'),
    (6, N'1401', N'SPAMASS', DATEADD(SECOND, 57600, CAST(DATEADD(DAY, 1, CAST(SYSDATETIME() AS date)) AS datetime2)), NULL, 1, 0,
     980000.00, N'Đã xác nhận', N'DEMO-SERVICE-002', REPLICATE(N'0', 64), N'customer:1', NULL, NULL);
SET IDENTITY_INSERT HoaDon ON;
INSERT INTO HoaDon
    (maHoaDon, maPhieuDatPhong, thoiDiemPhatHanh, tienGiamGia, tienDatCocDaTra, phuongThucThanhToan, trangThai, tongTienPhong, tongTienDichVu, soTienPhaiTra, tienPhuThu, tienBoiThuong, phiGiaHan, tongTienDieuChinh, phienBan)
VALUES
    (1, 1, SYSDATETIME(), 0.00, 1000000.00, N'Tiền mặt', N'Chưa thanh toán', 2400000.00, 980000.00, 2380000.00, 0.00, 0.00, 0.00, 0.00, 0),
    (3, 3, SYSDATETIME(), 0.00, 0.00, N'Tiền mặt', N'Chưa thanh toán', 1900000.00, 0.00, 1200000.00, 0.00, 300000.00, 0.00, 0.00, 0),
    (4, 4, DATEADD(DAY, -2, SYSDATETIME()), 710000.00, 2900000.00, N'Thẻ', N'Đã thanh toán', 5800000.00, 1350000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0);
SET IDENTITY_INSERT HoaDon OFF;

SET IDENTITY_INSERT GiaoDichThanhToan ON;
INSERT INTO GiaoDichThanhToan
    (maGiaoDichThanhToan, maHoaDon, soTien, phuongThuc, loai, trangThai, maThamChieu, thoiDiemPhatSinh, maNguoiThucHien, khoaChongTrung, maSuKienBenNgoai)
VALUES
    (1, 1, 1000000.00, N'Tiền mặt', N'Thanh toán', N'Đã hoàn tất', N'DEPOSIT:1', DATEADD(DAY, -1, SYSDATETIME()), N'FRONTDESK', N'DEMO-PAY-001', NULL),
    (2, 3, 1000000.00, N'Tiền mặt', N'Thanh toán', N'Đã hoàn tất', N'PAY:3:PARTIAL', DATEADD(HOUR, -1, SYSDATETIME()), N'FRONTDESK', N'DEMO-PAY-002', NULL),
    (3, 4, 2900000.00, N'Chuyển khoản ngân hàng', N'Thanh toán', N'Đã hoàn tất', N'DEPOSIT:4', DATEADD(DAY, -5, SYSDATETIME()), N'FRONTDESK', N'DEMO-PAY-003', NULL),
    (4, 4, 3540000.00, N'Thẻ', N'Thanh toán', N'Đã hoàn tất', N'FINAL:4', DATEADD(DAY, -2, SYSDATETIME()), N'ACCOUNTING', N'DEMO-PAY-004', NULL);
SET IDENTITY_INSERT GiaoDichThanhToan OFF;

SET IDENTITY_INSERT BienLai ON;
INSERT INTO BienLai
    (maBienLai, soBienLai, maHoaDon, soTien, phuongThuc, thoiDiemPhatHanh, nguoiPhatHanh)
VALUES
    (1, N'DEP-DEMO-001', 1, 1000000.00, N'Tiền mặt', DATEADD(DAY, -1, SYSDATETIME()), N'FRONTDESK'),
    (2, N'RCPT-DEMO-003', 3, 1000000.00, N'Tiền mặt', DATEADD(HOUR, -1, SYSDATETIME()), N'FRONTDESK'),
    (3, N'DEP-DEMO-004', 4, 2900000.00, N'Chuyển khoản ngân hàng', DATEADD(DAY, -5, SYSDATETIME()), N'FRONTDESK'),
    (4, N'RCPT-DEMO-004', 4, 3540000.00, N'Thẻ', DATEADD(DAY, -2, SYSDATETIME()), N'ACCOUNTING');
SET IDENTITY_INSERT BienLai OFF;

SET IDENTITY_INSERT ThietBiPhong ON;
INSERT INTO ThietBiPhong
    (maThietBiPhong, maPhong, ten, giaTriBanDau, ngayMua, soLuong, dangHoatDong)
VALUES
    (1, N'501', N'Minibar', 6500000.00, DATEADD(MONTH, -18, CAST(SYSDATETIME() AS date)), 1, 1),
    (2, N'501', N'TV 4K', 12000000.00, DATEADD(MONTH, -12, CAST(SYSDATETIME() AS date)), 1, 1),
    (3, N'601', N'Máy sấy tóc', 800000.00, DATEADD(MONTH, -10, CAST(SYSDATETIME() AS date)), 1, 1),
    (4, N'602', N'Điều hòa', 18000000.00, DATEADD(MONTH, -14, CAST(SYSDATETIME() AS date)), 1, 1),
    (5, N'702', N'Điều hòa', 22000000.00, DATEADD(MONTH, -20, CAST(SYSDATETIME() AS date)), 1, 1),
    (6, N'702', N'Két an toàn', 9000000.00, DATEADD(MONTH, -15, CAST(SYSDATETIME() AS date)), 1, 1);
SET IDENTITY_INSERT ThietBiPhong OFF;

SET IDENTITY_INSERT SuCoThietBi ON;
INSERT INTO SuCoThietBi
    (maSuCoThietBi, maPhieuDatPhong, maPhong, tenThietBi, giaTriBanDau, ngayMua, soLuong, tienBoiThuong, thoiDiemTao, mucDoNghiemTrong, trangThaiBanGiao, ghiChuBanGiao)
VALUES
    (1, 3, N'601', N'Máy sấy tóc', 800000.00, DATEADD(MONTH, -10, CAST(SYSDATETIME() AS date)), 1, 300000.00,
     SYSDATETIME(), N'Trung bình', N'Đang mở', N'Chờ lễ tân xác nhận bồi thường khi khách trả phòng.');
SET IDENTITY_INSERT SuCoThietBi OFF;

SET IDENTITY_INSERT BienDongKhoDichVu ON;
INSERT INTO BienDongKhoDichVu
    (maBienDongKhoDichVu, maDichVu, loai, soLuong, maNguoiThucHien, thoiDiemPhatSinh, lyDo)
VALUES
    (1, N'BREAKFAST', N'Nhập kho', 20, N'KITCHEN', DATEADD(DAY, -3, SYSDATETIME()), N'Nhập nguyên liệu bữa sáng demo'),
    (2, N'BREAKFAST', N'Xuất kho', 2, N'KITCHEN', DATEADD(DAY, -1, SYSDATETIME()), N'Phục vụ booking DEMO-RES-001'),
    (3, N'SPAMASS', N'Nhập kho', 10, N'KITCHEN', DATEADD(DAY, -4, SYSDATETIME()), N'Nhập dầu massage demo'),
    (4, N'SPAFACIAL', N'Xuất kho', 1, N'KITCHEN', DATEADD(DAY, -3, SYSDATETIME()), N'Phục vụ booking DEMO-RES-004'),
    (5, N'DECOR', N'Hao hụt', 1, N'KITCHEN', DATEADD(DAY, -2, SYSDATETIME()), N'Hao hụt vật tư trang trí');
SET IDENTITY_INSERT BienDongKhoDichVu OFF;

UPDATE DichVu SET soLuongTonKho = CASE maDichVu
    WHEN N'BREAKFAST' THEN 1017
    WHEN N'SPAMASS' THEN 1009
    WHEN N'SPAFACIAL' THEN 998
    WHEN N'DECOR' THEN 29
    ELSE soLuongTonKho
END;

SET IDENTITY_INSERT BanGiaoTienCa ON;
INSERT INTO BanGiaoTienCa
    (maBanGiaoTienCa, maCa, nguoiBanGiao, nguoiNhanBanGiao, soTienDuKien, soTienThucTe, thoiDiemBanGiao, ghiChu)
VALUES
    (1, N'Ca sáng', N'FRONTDESK', N'ACCOUNTING', 12500000.00, 12500000.00, SYSDATETIME(), N'Bàn giao ca sáng đủ quỹ.'),
    (2, N'Ca đêm', N'FRONTDESK', N'ACCOUNTING', 8300000.00, 8250000.00, DATEADD(DAY, -1, SYSDATETIME()), N'Lệch quỹ cần đối soát cuối ca.');
SET IDENTITY_INSERT BanGiaoTienCa OFF;

SET IDENTITY_INSERT KhoanChi ON;
INSERT INTO KhoanChi
    (maKhoanChi, danhMuc, moTa, soTien, nguoiChiTra, thoiDiemChiTra, trangThai)
VALUES
    (1, N'Vệ sinh', N'Mua hóa chất và vật tư buồng phòng tháng này', 2350000.00, N'ACCOUNTING', DATEADD(DAY, -2, SYSDATETIME()), N'Đã phê duyệt'),
    (2, N'Bảo trì', N'Thay linh kiện điều hòa phòng 702', 4800000.00, N'ACCOUNTING', DATEADD(DAY, -1, SYSDATETIME()), N'Đã ghi nhận'),
    (3, N'Marketing', N'In tài liệu giới thiệu dịch vụ MaM Hotel', 1250000.00, N'ACCOUNTING', DATEADD(DAY, -4, SYSDATETIME()), N'Đã phê duyệt');
SET IDENTITY_INSERT KhoanChi OFF;

SET IDENTITY_INSERT CongNoDoiTac ON;
INSERT INTO CongNoDoiTac
    (maCongNoDoiTac, tenDoiTac, maThamChieu, soTien, soTienDaThanhToan, trangThai, thoiDiemGhiNhan)
VALUES
    (1, N'Nhà cung cấp thực phẩm MaM', N'DEMO-SUPPLIER-FNB-09', 53000000.00, 0.00, N'Chưa thanh toán', SYSDATETIME()),
    (2, N'Nhà cung cấp vật tư spa MaM', N'DEMO-SUPPLIER-SPA-09', 73000000.00, 12000000.00, N'Đã thanh toán một phần', DATEADD(DAY, -2, SYSDATETIME()));
SET IDENTITY_INSERT CongNoDoiTac OFF;

SET IDENTITY_INSERT ThanhToanCongNoDoiTac ON;
INSERT INTO ThanhToanCongNoDoiTac
    (maThanhToanCongNo, maCongNoDoiTac, soTien, nguoiThanhToan, thoiDiemThanhToan, ghiChu)
VALUES
    (1, 2, 12000000.00, N'ACCOUNTING', DATEADD(DAY, -1, SYSDATETIME()), N'Đã thanh toán nhà cung cấp đợt 1.');
SET IDENTITY_INSERT ThanhToanCongNoDoiTac OFF;

SET IDENTITY_INSERT ButToanTaiChinh ON;
INSERT INTO ButToanTaiChinh
    (maButToanTaiChinh, loaiButToan, loaiNguon, maNguon, chieuButToan, soTien, maNguoiThucHien, thoiDiemPhatSinh, ghiChu, daChotSo)
VALUES
    (1, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'1', N'Ghi nợ', 1000000.00, N'FRONTDESK', DATEADD(DAY, -1, SYSDATETIME()), N'Thu cọc booking demo.', 1),
    (2, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'4', N'Ghi nợ', 3540000.00, N'ACCOUNTING', DATEADD(DAY, -2, SYSDATETIME()), N'Thu phần còn lại hóa đơn demo.', 1),
    (3, N'EXPENSE_RECORDED', N'EXPENSE', N'1', N'Ghi có', 2350000.00, N'ACCOUNTING', DATEADD(DAY, -2, SYSDATETIME()), N'Chi vật tư vệ sinh demo.', 1);
SET IDENTITY_INSERT ButToanTaiChinh OFF;


SET IDENTITY_INSERT LichSuHangThanhVien ON;
INSERT INTO LichSuHangThanhVien
    (maLichSuHangThanhVien, maKhachLuuTru, hangCu, hangMoi, lyDo, thoiDiemThayDoi)
VALUES
    (1, 2, N'Tiêu chuẩn', N'Bạch kim', N'Đạt mốc doanh thu và số đêm lưu trú demo.', DATEADD(DAY, -30, SYSDATETIME()));
SET IDENTITY_INSERT LichSuHangThanhVien OFF;

SET IDENTITY_INSERT YeuCauPheDuyet ON;
INSERT INTO YeuCauPheDuyet
    (maYeuCauPheDuyet, nguoiYeuCau, hanhDong, maDoiTuong, duLieuThayDoi, dauVanTayDuLieu, soTien, khoaLienKet, lyDo, mucDoRuiRo, thoiDiemYeuCau, trangThai, nguoiPheDuyet, thoiDiemQuyetDinh, thoiDiemHetHan, thoiDiemSuDung)
VALUES
    (1, N'KITCHEN', N'Thay đổi giá dịch vụ', N'SPAMASS',
     N'{"maDichVu":"SPAMASS","gia":1100000,"lyDo":"Giá mùa cao điểm"}',
     CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(MAX), N'{"maDichVu":"SPAMASS","gia":1100000,"lyDo":"Giá mùa cao điểm"}')), 2),
     1100000.00, N'DEMO-APP-001', N'Điều chỉnh giá massage mùa cao điểm.', N'Trung bình', SYSDATETIME(), N'Chờ phê duyệt', NULL, NULL, DATEADD(DAY, 7, SYSDATETIME()), NULL),
    (2, N'ACCOUNTING', N'Điều chỉnh thanh toán', N'3',
     N'soTienChenhLech=-200000|lyDo=Khách VIP demo',
     CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(MAX), N'soTienChenhLech=-200000|lyDo=Khách VIP demo')), 2),
     200000.00, N'DEMO-APP-002', N'Giảm giá hỗ trợ khách VIP sau sự cố dịch vụ.', N'Thấp', SYSDATETIME(), N'Chờ phê duyệt', NULL, NULL, DATEADD(DAY, 7, SYSDATETIME()), NULL);
SET IDENTITY_INSERT YeuCauPheDuyet OFF;

INSERT INTO PhieuBaoTri
(maPhieuBaoTri, maPhong, loaiBaoTri, ngayDuKien, trangThai, moTa) VALUES
(N'WO001', N'702', N'Sửa điều hòa', N'2026-09-25', N'Chưa xử lý', N'Điều hòa không làm lạnh'),
(N'WO002', N'602', N'Kiểm tra sau vệ sinh', N'2026-09-26', N'Đã hoàn thành', N'Kiểm tra phòng sau khi khách trả');

INSERT INTO CaLamViecNhanVien
    (maNhanVien, ngayLamCa, maCa, thoiDiemBatDau, thoiDiemKetThuc, trangThai, nguoiTao)
SELECT maNhanVien, CAST(SYSDATETIME() AS date),
       CASE WHEN maNhanVien IN (N'TECHNICAL',N'ACCOUNTING') THEN N'Ca chiều' ELSE N'Ca sáng' END,
       CASE WHEN maNhanVien IN (N'TECHNICAL',N'ACCOUNTING') THEN DATEADD(SECOND, 50400, CAST(CAST(SYSDATETIME() AS date) AS datetime2)) ELSE DATEADD(SECOND, 21600, CAST(CAST(SYSDATETIME() AS date) AS datetime2)) END,
       CASE WHEN maNhanVien IN (N'TECHNICAL',N'ACCOUNTING') THEN DATEADD(SECOND, 79200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)) ELSE DATEADD(SECOND, 50400, CAST(CAST(SYSDATETIME() AS date) AS datetime2)) END,
       N'Đã bắt đầu', N'MANAGER'
FROM NhanVien
WHERE maNhanVien IN (N'FRONTDESK',N'HOUSEKEEP',N'TECHNICAL',N'ACCOUNTING',N'KITCHEN',N'MANAGER',N'HR',N'STAFF');
SET IDENTITY_INSERT NhiemVuBuongPhong ON;
INSERT INTO NhiemVuBuongPhong
    (maNhiemVuBuongPhong, maPhong, nguoiDuocPhanCong, trangThai, daHoanThanhChecklist, coSuCoChan, ghiChu, nguoiPhanCong, thoiDiemCapNhat)
VALUES
    (1, N'502', N'HOUSEKEEP', N'Cần dọn phòng', 0, 0, N'Chuẩn bị phòng cho lượt khách tiếp theo.', N'MANAGER', SYSDATETIME()),
    (2, N'602', N'HOUSEKEEP', N'Đang thực hiện', 0, 0, N'Đang vệ sinh phòng Deluxe.', N'MANAGER', SYSDATETIME()),
    (3, N'702', N'HOUSEKEEP', N'Chờ kỹ thuật', 1, 1, N'Chờ kỹ thuật xử lý điều hòa.', N'MANAGER', SYSDATETIME()),
    (4, N'701', N'HOUSEKEEP', N'Đã dọn xong', 1, 0, N'Đã dọn xong, chờ quản lý kiểm tra cuối.', N'MANAGER', SYSDATETIME());
SET IDENTITY_INSERT NhiemVuBuongPhong OFF;
SET IDENTITY_INSERT MauChecklistBuongPhong ON;
INSERT INTO MauChecklistBuongPhong (maMauChecklist, ten, dangHoatDong) VALUES
    (1, N'Vệ sinh phòng tiêu chuẩn', 1),
    (2, N'Kiểm tra minibar', 1),
    (3, N'Bàn giao thiết bị sau bảo trì', 1);
SET IDENTITY_INSERT MauChecklistBuongPhong OFF;

SET IDENTITY_INSERT KetQuaChecklistBuongPhong ON;
INSERT INTO KetQuaChecklistBuongPhong
    (maKetQuaChecklist, maNhiemVuBuongPhong, hangMuc, datYeuCau, ghiChu, nguoiHoanThanh, thoiDiemHoanThanh)
VALUES
    (1, 2, N'Ga giường và khăn tắm', 1, N'Đã thay mới.', N'HOUSEKEEP', SYSDATETIME()),
    (2, 2, N'Minibar và vật dụng phòng', 1, N'Đủ số lượng theo tiêu chuẩn.', N'HOUSEKEEP', SYSDATETIME()),
    (3, 3, N'Điều hòa hoạt động bình thường', 0, N'Đang chờ kỹ thuật xử lý.', N'HOUSEKEEP', SYSDATETIME()),
    (4, 4, N'Phòng sạch và không còn đồ thất lạc', 1, N'Đã kiểm tra.', N'HOUSEKEEP', SYSDATETIME());
SET IDENTITY_INSERT KetQuaChecklistBuongPhong OFF;

SET IDENTITY_INSERT KiemTraBuongPhong ON;
INSERT INTO KiemTraBuongPhong
    (maKiemTraBuongPhong, maNhiemVuBuongPhong, loaiKiemTra, hangMuc, soLuong, tinhTrangHangMuc, ghiChu, nguoiHoanThanh, thoiDiemHoanThanh)
VALUES
    (1, 2, N'Minibar', N'Nước suối', 4, N'Bình thường', N'Đủ 4 chai.', N'HOUSEKEEP', SYSDATETIME()),
    (2, 2, N'Minibar', N'Snack', 3, N'Đã bổ sung', N'Đã bổ sung đủ 3 gói.', N'HOUSEKEEP', SYSDATETIME()),
    (3, 3, N'Tài sản phòng', N'Điều hòa', 1, N'Hư hỏng', N'Không làm lạnh, đã tạo phiếu kỹ thuật.', N'HOUSEKEEP', SYSDATETIME()),
    (4, 4, N'Tài sản phòng', N'Không có', 0, N'Bình thường', N'Không phát hiện đồ thất lạc.', N'HOUSEKEEP', SYSDATETIME());
SET IDENTITY_INSERT KiemTraBuongPhong OFF;

INSERT INTO PhieuCongViecKyThuat
    (maPhong, maThietBiPhong, nguoiDuocPhanCong, doUuTien, thoiHanSla, vatTuSuDung, ghiChuKetQua, ghiChuNghiemThu, nguoiNghiemThu, thoiDiemNghiemThu, trangThai, nguoiTao, thoiDiemTao, thoiDiemCapNhat)
VALUES
    (N'702', (SELECT TOP 1 maThietBiPhong FROM ThietBiPhong WHERE maPhong = N'702' AND ten = N'Điều hòa' ORDER BY maThietBiPhong), N'TECHNICAL', N'Cao', DATEADD(HOUR, 4, SYSDATETIME()), N'Kiểm tra điều hòa không làm lạnh', NULL, NULL, NULL, NULL, N'Đang thực hiện', N'MANAGER', SYSDATETIME(), SYSDATETIME()),
    (N'602', (SELECT TOP 1 maThietBiPhong FROM ThietBiPhong WHERE maPhong = N'602' AND ten = N'Điều hòa' ORDER BY maThietBiPhong), N'TECHNICAL', N'Trung bình', DATEADD(DAY, 1, SYSDATETIME()), N'Kiểm tra thiết bị sau vệ sinh', NULL, NULL, NULL, NULL, N'Mới tạo', N'MANAGER', SYSDATETIME(), SYSDATETIME());
-- OTA nguonDuLieu/reconciliation demo. DIRECT remains the default for direct bookings.
UPDATE PhieuDatPhong SET nguonDatPhong=N'AGODA', doanhThuGopOta=1650000.00, hoaHongOta=247500.00,
    trangThaiDoiSoatOta=N'Chờ đối soát' WHERE maPhieuDatPhong=1;
UPDATE PhieuDatPhong SET nguonDatPhong=N'BOOKING_COM', doanhThuGopOta=2450000.00, hoaHongOta=367500.00,
    trangThaiDoiSoatOta=N'Đã khớp' WHERE maPhieuDatPhong=3;
UPDATE PhieuDatPhong SET nguonDatPhong=N'EXPEDIA', doanhThuGopOta=5800000.00, hoaHongOta=870000.00,
    trangThaiDoiSoatOta=N'Có tranh chấp' WHERE maPhieuDatPhong=4;

SET IDENTITY_INSERT HoaDonGiaTriGiaTang ON;
INSERT INTO HoaDonGiaTriGiaTang
    (maHoaDonGiaTriGiaTang, maHoaDon, soHoaDonGiaTriGiaTang, thueSuat, soTienChiuThue, loaiKhachHang, tenKhachHang, maSoThue, tenCongTy, diaChiCongTy, trangThai, trangThaiXml, nguoiTao)
VALUES
    (1, 1, N'VAT-2026-0001', 8.00, 3280000.00, N'Doanh nghiệp', N'Công ty TNHH Minh Anh', N'0312345678', N'Công ty TNHH Minh Anh', N'12 Nguyễn Huệ, Quận 1, TP.HCM', N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING'),
    (2, 3, N'VAT-2026-0002', 8.00, 1650000.00, N'Cá nhân', N'Trần Minh Khang', NULL, NULL, NULL, N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING'),
    (3, 4, N'VAT-2026-0003', 8.00, 5800000.00, N'Doanh nghiệp', N'Công ty CP Sài Gòn Xanh', N'0309876543', N'Công ty CP Sài Gòn Xanh', N'88 Lê Lợi, Quận 1, TP.HCM', N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING');
SET IDENTITY_INSERT HoaDonGiaTriGiaTang OFF;

SET IDENTITY_INSERT ChamCong ON;
INSERT INTO ChamCong
    (maChamCong, maNhanVien, ngayLamViec, thoiDiemVaoCa, thoiDiemRaCa, trangThai, nguonDuLieu, maSuKienThietBi, ghiChu, nguoiNhap)
VALUES
    (1, N'FRONTDESK', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 21720, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 50700, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Có mặt', N'Nhập từ máy chấm công', N'FP-DEMO-001', N'Import từ file máy vân tay demo', N'HR'),
    (2, N'HOUSEKEEP', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 22500, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 50400, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Đi muộn', N'Nhập từ máy chấm công', N'FP-DEMO-002', N'Import từ file máy vân tay demo', N'HR'),
    (3, N'ACCOUNTING', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 28800, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 61200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Có mặt', N'Nhập thủ công', NULL, N'Nhập thủ công để test khi chưa có phần cứng', N'HR'),
    (4, N'TECHNICAL', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 29100, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 61800, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Đi muộn', N'Nhập từ máy chấm công', N'FP-DEMO-004', N'Nhân viên đến muộn để kiểm thử cảnh báo', N'HR'),
    (5, N'KITCHEN', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 28500, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 59400, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Có mặt', N'Nhập từ máy chấm công', N'FP-DEMO-005', N'Import từ máy vân tay demo', N'HR'),
    (6, N'MANAGER', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 29400, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 63000, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Đi muộn', N'Nhập từ máy chấm công', N'FP-DEMO-006', N'Nhân viên đến muộn để kiểm thử cảnh báo', N'HR'),
    (7, N'DIRECTOR', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 28800, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 61200, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Có mặt', N'Nhập từ máy chấm công', N'FP-DEMO-007', N'Import từ máy vân tay demo', N'HR'),
    (8, N'ADMIN', CAST(SYSDATETIME() AS date), NULL, NULL, N'Vắng mặt', N'Nhập thủ công', NULL, N'Vắng không phép để kiểm thử trạng thái', N'HR'),
    (9, N'HR', CAST(SYSDATETIME() AS date), NULL, NULL, N'Nghỉ phép', N'Nhập thủ công', NULL, N'Nghỉ phép để kiểm thử trạng thái', N'HR'),
    (10, N'STAFF', CAST(SYSDATETIME() AS date), DATEADD(SECOND, 32700, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), DATEADD(SECOND, 64800, CAST(CAST(SYSDATETIME() AS date) AS datetime2)), N'Đi muộn', N'Nhập từ máy chấm công', N'FP-DEMO-010', N'Nhân viên đến muộn để kiểm thử cảnh báo', N'HR');
SET IDENTITY_INSERT ChamCong OFF;

SET IDENTITY_INSERT DonNghiPhep ON;
INSERT INTO DonNghiPhep
    (maDonNghiPhep, maNhanVien, loaiNghiPhep, ngayBatDau, ngayKetThuc, lyDo, trangThai, nguoiYeuCau, nguoiPheDuyet, thoiDiemQuyetDinh)
VALUES
    (1, N'HOUSEKEEP', N'Nghỉ phép năm', DATEADD(DAY, 3, CAST(SYSDATETIME() AS date)), DATEADD(DAY, 3, CAST(SYSDATETIME() AS date)), N'Giải quyết việc gia đình.', N'Chờ phê duyệt', N'HOUSEKEEP', NULL, NULL),
    (2, N'FRONTDESK', N'Nghỉ ốm', DATEADD(DAY, -2, CAST(SYSDATETIME() AS date)), DATEADD(DAY, -1, CAST(SYSDATETIME() AS date)), N'Nghỉ ốm có giấy xác nhận.', N'Đã phê duyệt', N'FRONTDESK', N'MANAGER', DATEADD(DAY, -1, SYSDATETIME())),
    (3, N'KITCHEN', N'Đổi ca trực', DATEADD(DAY, 5, CAST(SYSDATETIME() AS date)), DATEADD(DAY, 5, CAST(SYSDATETIME() AS date)), N'Đổi ca với đồng nghiệp.', N'Chờ phê duyệt', N'KITCHEN', NULL, NULL);
SET IDENTITY_INSERT DonNghiPhep OFF;

INSERT INTO MatHangTonKho
    (maMatHang, ten, danhMuc, donViTinh, soLuongHienTai, nguongAnToan, maDichVu, dangHoatDong)
VALUES
    (N'LINEN-KING', N'Ga trải giường King', N'Đồ vải', N'bộ', 45, 20, NULL, 1),
    (N'LINEN-TWIN', N'Ga trải giường Twin', N'Đồ vải', N'bộ', 38, 20, NULL, 1),
    (N'LINEN-PILLOW', N'Vỏ gối', N'Đồ vải', N'cái', 120, 60, NULL, 1),
    (N'LINEN-TOWEL-L', N'Khăn tắm lớn', N'Đồ vải', N'cái', 15, 40, NULL, 1),
    (N'LINEN-TOWEL-S', N'Khăn tắm nhỏ', N'Đồ vải', N'cái', 18, 40, NULL, 1),
    (N'GENERAL-WATER', N'Nước suối minibar', N'Khác', N'chai', 200, 80, N'BREAKFAST', 1);

SET IDENTITY_INSERT BienDongTonKho ON;
INSERT INTO BienDongTonKho (maBienDongTonKho, maMatHang, loaiBienDong, soLuong, maNguoiThucHien, lyDo)
VALUES
    (1, N'LINEN-KING', N'Nhập kho', 60, N'HOUSEKEEP', N'Nhập kho đồ vải đầu kỳ'),
    (2, N'LINEN-TOWEL-L', N'Xuất kho', 5, N'HOUSEKEEP', N'Cấp cho ca buồng phòng hôm nay');
SET IDENTITY_INSERT BienDongTonKho OFF;

INSERT INTO TaiSanKyThuat
    (maTaiSanKyThuat, ten, danhMuc, loaiViTri, maPhong, tang, viTri, thuongHieuMau, ngayLapDat, ngayBaoTriTiepTheo, trangThai, giaTriBanDau, ghiChu)
VALUES
    (N'AST-HVAC-001', N'Hệ thống điều hòa Chiller trung tâm', N'HVAC', N'Tòa nhà', NULL, 20, N'Tầng kỹ thuật mái', N'Daikin Modular 120RT', N'2023-01-15', DATEADD(DAY, 25, CAST(SYSDATETIME() AS date)), N'Tốt', 650000000.00, N'Tài sản tòa nhà'),
    (N'AST-GEN-001', N'Máy phát điện dự phòng 500kVA', N'Hệ thống điện', N'Tòa nhà', NULL, -2, N'Phòng kỹ thuật B2', N'Cummins PowerTech', N'2022-11-10', DATEADD(DAY, 10, CAST(SYSDATETIME() AS date)), N'Cần bảo trì', 480000000.00, N'Tài sản tòa nhà'),
    (N'AST-ELEV-001', N'Thang máy khách số 1', N'Thang máy', N'Tòa nhà', NULL, 0, N'Sảnh chính cánh Bắc', N'Mitsubishi NexWay 1000kg', N'2023-03-20', DATEADD(DAY, 60, CAST(SYSDATETIME() AS date)), N'Tốt', 520000000.00, N'Tài sản tòa nhà'),
    (N'AST-POOL-001', N'Hệ thống lọc hồ bơi', N'Hồ bơi', N'Tòa nhà', NULL, 21, N'Khu kỹ thuật hồ bơi', N'Emaux Commercial SB20', N'2023-04-15', DATEADD(DAY, 8, CAST(SYSDATETIME() AS date)), N'Tốt', 95000000.00, N'Tài sản tầng 21'),
    (N'AST-501-TV', N'TV 4K phòng 501', N'Thiết bị phòng', N'Phòng', N'501', 5, N'Phòng 501', N'Samsung 55 inch', DATEADD(MONTH, -12, CAST(SYSDATETIME() AS date)), DATEADD(DAY, 120, CAST(SYSDATETIME() AS date)), N'Tốt', 12000000.00, N'Liên kết tài sản phòng');

SET IDENTITY_INSERT ChiTietTienBanGiao ON;
INSERT INTO ChiTietTienBanGiao (maChiTietTienBanGiao, maBanGiaoTienCa, menhGia, soLuong)
VALUES
    (1, 1, 500000.00, 20),
    (2, 1, 200000.00, 10),
    (3, 1, 100000.00, 5),
    (4, 2, 500000.00, 12),
    (5, 2, 200000.00, 10),
    (6, 2, 100000.00, 2),
    (7, 2, 50000.00, 1);
SET IDENTITY_INSERT ChiTietTienBanGiao OFF;

UPDATE LoaiPhong
SET tenQuangBa = CASE maHangPhong
        WHEN N'STD' THEN N'Phòng Tiêu Chuẩn Nghỉ Dưỡng'
        WHEN N'SUP' THEN N'Phòng Cao Cấp Thanh Lịch'
        WHEN N'DLX' THEN N'Phòng Deluxe Thượng Hạng'
        WHEN N'SUT' THEN N'Phòng Suite Hoàng Gia'
        WHEN N'VIP' THEN N'Biệt Thự Hoàng Gia'
    END,
    moTaQuangBa = CASE maLoaiPhong
        WHEN N'RT001' THEN N'Không gian nghỉ thanh lịch với ánh sáng tự nhiên ngập tràn, giường queen êm ái cùng phòng tắm tiện nghi tinh tế được thiết kế để bạn trọn vẹn thả lỏng bên vịnh biển.'
        WHEN N'RT002' THEN N'Không gian nghỉ thanh lịch với ánh sáng tự nhiên ngập tràn, hai giường đơn êm ái cùng phòng tắm tiện nghi tinh tế, phù hợp cho những chuyến đi cùng gia đình hoặc bạn bè.'
        WHEN N'RT003' THEN N'Khung cảnh vịnh biển xanh mát hoặc vườn hoa mở ra từ ban công riêng biệt. Bồn tắm đá ngâm thảo mộc và đệm ngủ chuẩn 5 sao giúp giấc ngủ sâu lắng và thư thái trọn vẹn.'
        WHEN N'RT004' THEN N'Khung cảnh vịnh biển xanh mát mở ra từ ban công riêng biệt. Hai giường đơn rộng rãi, bồn tắm đá ngâm thảo mộc và đệm ngủ chuẩn 5 sao mang đến kỳ nghỉ thư thái trọn vẹn.'
        WHEN N'RT005' THEN N'Không gian mời bạn cảm nhận trọn vẹn nhịp sống thư thái với tầm nhìn thoáng đạt, bồn tắm đá cẩm thạch nhìn ra thiên nhiên cùng ban công rộng đón nắng bình minh.'
        WHEN N'RT006' THEN N'Không gian Deluxe rộng rãi với tầm nhìn thoáng đạt, khu vực sofa riêng cho những buổi chuyện trò thư thái, bồn tắm đá cẩm thạch và ban công rộng đón nắng bình minh.'
        WHEN N'RT007' THEN N'Phòng Suite hoàng gia tích hợp phòng khách biệt lập, ban công ngắm hoàng hôn, đệm Emperor bọc linen cao cấp và gói chăm sóc quản gia tận tâm cùng rượu vang đón chào.'
        WHEN N'RT008' THEN N'Phòng Suite hoàng gia rộng nhất hạng SUT với phòng khách biệt lập, ban công riêng ngắm hoàng hôn, đệm Emperor bọc linen cao cấp và dịch vụ đón tiếp tận tâm.'
        WHEN N'RT009' THEN N'Một căn biệt thự hoàn chỉnh dành riêng cho nhóm của bạn: phòng khách rộng để quây quần, khu ngủ êm ái, sân hiên hướng thiên nhiên và trải nghiệm hồ bơi riêng. Dịch vụ quản gia hỗ trợ đón tiếp, phục vụ bữa sáng tại villa và chuẩn bị những khoảnh khắc đáng nhớ cho tối đa 8 khách.'
    END
WHERE maLoaiPhong IN (N'RT001', N'RT002', N'RT003', N'RT004', N'RT005', N'RT006', N'RT007', N'RT008', N'RT009');

-- Chuẩn hóa toàn bộ ảnh phòng khách sạn theo đúng thứ hạng (STD, SUP, DLX, SUT, VIP)
-- Loại bỏ hoàn toàn ảnh bể bơi ngoài trời, mặt tiền villa/tòa nhà, bàn bóng bàn, góc phòng ăn rác.
-- Mỗi phòng có đúng 4 ảnh phòng ngủ và tiện nghi nội thất khép kín thực tế;
-- Ảnh laAnhBia được phân bổ riêng biệt theo đúng thứ hạng chất lượng và đặc trưng từng phòng.

DELETE FROM HinhAnhPhong;

INSERT INTO HinhAnhPhong (maPhong, duongDanTuongDoi, thuTuHienThi, laAnhBia, loaiNoiDung, kichThuocByte, dangHoatDong)
VALUES
    (N'501', N'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&h=800&q=80&room=501&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'501', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=501&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'501', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=501&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'501', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=501&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'502', N'https://images.unsplash.com/photo-1572987669554-0ba2ba9aee1f?auto=format&fit=crop&w=1200&h=800&q=80&room=502&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'502', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=502&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'502', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=502&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'502', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=502&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'601', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=601&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'601', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=601&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'601', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=601&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'601', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=601&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'602', N'https://images.unsplash.com/photo-1605346576608-92f1346b67d6?auto=format&fit=crop&w=1200&h=800&q=80&room=602&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'602', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=602&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'602', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=602&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'602', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=602&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'701', N'https://images.unsplash.com/photo-1631049421450-348ccd7f8949?auto=format&fit=crop&w=1200&h=800&q=80&room=701&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'701', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=701&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'701', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=701&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'701', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=701&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'702', N'https://images.pexels.com/photos/3754594/pexels-photo-3754594.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'702', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=702&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'702', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'702', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=702&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'801', N'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&h=800&q=80&room=801&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'801', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=801&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'801', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=801&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'801', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=801&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'802', N'https://images.pexels.com/photos/1457845/pexels-photo-1457845.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'802', N'https://images.unsplash.com/photo-1549638441-b787d2e11f14?auto=format&fit=crop&w=1200&h=800&q=80&room=802&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'802', N'https://images.pexels.com/photos/271672/pexels-photo-271672.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'802', N'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=802&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'503', N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&h=800&q=80&room=503&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'503', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=503&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'503', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=503&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'503', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=503&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'504', N'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'504', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=504&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'504', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'504', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=504&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'603', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=603&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'603', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=603&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'603', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=603&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'603', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=603&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'604', N'https://images.pexels.com/photos/271616/pexels-photo-271616.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'604', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=604&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'604', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'604', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=604&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'703', N'https://images.unsplash.com/photo-1702014859878-5d4743176d28?auto=format&fit=crop&w=1200&h=800&q=80&room=703&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'703', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=703&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'703', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=703&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'703', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=703&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'704', N'https://images.unsplash.com/photo-1667125095636-dce94dcbdd96?auto=format&fit=crop&w=1200&h=800&q=80&room=704&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'704', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=704&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'704', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=704&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'704', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=704&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'803', N'https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=1200&h=800&q=80&room=803&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'803', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=803&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'803', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=803&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'803', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=803&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'804', N'https://images.pexels.com/photos/271619/pexels-photo-271619.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'804', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=804&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'804', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'804', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=804&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'901', N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&h=800&q=80&room=901&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'901', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=901&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'901', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=901&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'901', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=901&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'902', N'https://images.pexels.com/photos/3659683/pexels-photo-3659683.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'902', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=902&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'902', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'902', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=902&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1001', N'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?auto=format&fit=crop&w=1200&h=800&q=80&room=1001&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1001', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1001&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1001', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1001&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1001', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1001&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1002', N'https://images.unsplash.com/photo-1605346434674-a440ca4dc4c0?auto=format&fit=crop&w=1200&h=800&q=80&room=1002&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1002', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1002&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1002', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1002&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1002', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1002&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1101', N'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1101', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1101&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1101', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1101', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1101&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1201', N'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1201', N'https://images.unsplash.com/photo-1578898886225-c7c894047899?auto=format&fit=crop&w=1200&h=800&q=80&room=1201&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1201', N'https://images.pexels.com/photos/271660/pexels-photo-271660.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1201', N'https://images.pexels.com/photos/271631/pexels-photo-271631.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1201&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'903', N'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&h=800&q=80&room=903&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'903', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=903&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'903', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=903&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'903', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=903&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'904', N'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&h=800&q=80&room=904&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'904', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=904&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'904', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=904&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'904', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=904&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1003', N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&h=800&q=80&room=1003&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1003', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1003&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1003', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1003&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1003', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1003&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1004', N'https://images.unsplash.com/photo-1737517302831-e7b8a8eaa97c?auto=format&fit=crop&w=1200&h=800&q=80&room=1004&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1004', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1004&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1004', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1004&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1004', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1004&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1102', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1102&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1102', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1102&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1102', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1102&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1102', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1102&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1103', N'https://images.pexels.com/photos/271643/pexels-photo-271643.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1103', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1103&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1103', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1103', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1103&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1202', N'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&h=800&q=80&room=1202&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1202', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1202&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1202', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1202&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1202', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1202&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1203', N'https://images.pexels.com/photos/271659/pexels-photo-271659.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1203', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1203&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1203', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1203', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1203&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1301', N'https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1200&h=800&q=80&room=1301&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1301', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1301&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1301', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1301&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1301', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1301&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1302', N'https://images.unsplash.com/photo-1576354302919-96748cb8299e?auto=format&fit=crop&w=1200&h=800&q=80&room=1302&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1302', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1302&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1302', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1302&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1302', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1302&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1401', N'https://images.unsplash.com/photo-1713762523087-41019a875741?auto=format&fit=crop&w=1200&h=800&q=80&room=1401&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1401', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1401&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1401', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1401&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1401', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1401&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1402', N'https://images.pexels.com/photos/1743231/pexels-photo-1743231.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1402', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1402&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1402', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1402', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1402&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1501', N'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1501', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1501&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1501', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1501', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1501&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1502', N'https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=1200&h=800&q=80&room=1502&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1502', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1502&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1502', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1502&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1502', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1502&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1601', N'https://images.pexels.com/photos/276671/pexels-photo-276671.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1601', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1601&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1601', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1601', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1601&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1602', N'https://images.unsplash.com/photo-1630660664869-c9d3cc676880?auto=format&fit=crop&w=1200&h=800&q=80&room=1602&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1602', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1602&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1602', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1602&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1602', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1602&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1701', N'https://images.pexels.com/photos/172872/pexels-photo-172872.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1701', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1701&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1701', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1701', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1701&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1801', N'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1801', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1801&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1801', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1801', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1801&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1901', N'https://images.pexels.com/photos/271674/pexels-photo-271674.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1901', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=1901&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1901', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1901', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1901&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'2001', N'https://images.unsplash.com/photo-1698927100805-2a32718a7e05?auto=format&fit=crop&w=1200&h=800&q=80&room=2001&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'2001', N'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1200&h=800&q=80&room=2001&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'2001', N'https://images.pexels.com/photos/271627/pexels-photo-271627.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2001&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'2001', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2001&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1104', N'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&h=800&q=80&room=1104&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1104', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1104&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1104', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1104&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1104', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1104&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1204', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1204&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1204', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1204&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1204', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1204&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1204', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1204&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1303', N'https://images.unsplash.com/photo-1731336478850-6bce7235e320?auto=format&fit=crop&w=1200&h=800&q=80&room=1303&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1303', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1303&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1303', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1303&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1303', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1303&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1304', N'https://images.unsplash.com/photo-1645619200527-c6786729c2da?auto=format&fit=crop&w=1200&h=800&q=80&room=1304&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1304', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1304&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1304', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1304&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1304', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1304&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1403', N'https://images.unsplash.com/photo-1776763018972-588e27bf6511?auto=format&fit=crop&w=1200&h=800&q=80&room=1403&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1403', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1403&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1403', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1403&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1403', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1403&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1404', N'https://images.unsplash.com/photo-1718851972754-6638b49b4775?auto=format&fit=crop&w=1200&h=800&q=80&room=1404&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1404', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1404&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1404', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1404&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1404', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1404&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1503', N'https://images.unsplash.com/photo-1592229505726-ca121723b8ef?auto=format&fit=crop&w=1200&h=800&q=80&room=1503&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1503', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1503&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1503', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1503&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1503', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1503&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1504', N'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=800&q=80&room=1504&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1504', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1504&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1504', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1504&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1504', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1504&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1603', N'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=800&q=80&room=1603&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1603', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1603&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1603', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1603&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1603', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1603&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1604', N'https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1604', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1604&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1604', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1604', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1604&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1702', N'https://images.unsplash.com/photo-1776763018821-8feeaeeee0a5?auto=format&fit=crop&w=1200&h=800&q=80&room=1702&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1702', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1702&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1702', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1702&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1702', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1702&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1703', N'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=800&q=80&room=1703&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1703', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1703&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1703', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1703&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1703', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1703&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1802', N'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=800&q=80&room=1802&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1802', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1802&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1802', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1802&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1802', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1802&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1803', N'https://images.unsplash.com/photo-1639678349557-ffe5bed73ce7?auto=format&fit=crop&w=1200&h=800&q=80&room=1803&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1803', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1803&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1803', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1803&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1803', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1803&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1902', N'https://images.unsplash.com/photo-1711059985570-4c32ed12a12c?auto=format&fit=crop&w=1200&h=800&q=80&room=1902&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1902', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1902&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1902', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1902&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1902', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1902&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1903', N'https://images.pexels.com/photos/271644/pexels-photo-271644.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1903', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=1903&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1903', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1903', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1903&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'2002', N'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1200&h=800&q=80&room=2002&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'2002', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=2002&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'2002', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2002&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'2002', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2002&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'2003', N'https://images.pexels.com/photos/775219/pexels-photo-775219.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'2003', N'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&h=800&q=80&room=2003&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'2003', N'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'2003', N'https://images.pexels.com/photos/271661/pexels-photo-271661.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2003&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1704', N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&h=800&q=80&room=1704&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1704', N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1704&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1704', N'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1704&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1704', N'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1704&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1804', N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1804&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1804', N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1804&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1804', N'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1804&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1804', N'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1804&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'1904', N'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'1904', N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=1904&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'1904', N'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'1904', N'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=1904&view=4', 3, 0, N'image/jpeg', 1, 1),
    (N'2004', N'https://images.pexels.com/photos/2506990/pexels-photo-2506990.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=1', 0, 1, N'image/jpeg', 1, 1),
    (N'2004', N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&h=800&q=80&room=2004&view=2', 1, 0, N'image/jpeg', 1, 1),
    (N'2004', N'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=3', 2, 0, N'image/jpeg', 1, 1),
    (N'2004', N'https://images.pexels.com/photos/271642/pexels-photo-271642.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop&room=2004&view=4', 3, 0, N'image/jpeg', 1, 1);
UPDATE LoaiPhong
SET duongDanAnhBia = CASE maHangPhong
    WHEN N'STD' THEN N'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1400&h=1000&fit=crop&auto=format'
    WHEN N'SUP' THEN N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1400&h=1000&fit=crop&auto=format'
    WHEN N'DLX' THEN N'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1400&h=1000&fit=crop&auto=format'
    WHEN N'SUT' THEN N'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1400&h=1000&fit=crop&auto=format'
    WHEN N'VIP' THEN N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1400&h=1000&fit=crop&auto=format'
    ELSE duongDanAnhBia
END;

UPDATE Phong
SET moTa = CASE ten
    WHEN N'1704' THEN N'Biệt thự Hoàng gia 1704 là không gian nguyên căn trên tầng 17 với phòng khách riêng, khu ngủ sang trọng, sân hiên riêng và góc ngắm hoàng hôn. Villa phù hợp tối đa 8 khách, có quản gia hỗ trợ chuẩn bị bữa sáng tại villa và các trải nghiệm riêng theo yêu cầu.'
    WHEN N'1804' THEN N'Biệt thự Hoàng gia 1804 mở ra một kỳ nghỉ riêng tư với phòng khách tách biệt, ban công rộng và khu nghỉ dưỡng trong nhà - ngoài trời liền mạch. Đây là một căn villa hoàn chỉnh cho tối đa 8 khách, thích hợp cho gia đình hoặc nhóm bạn muốn tận hưởng trọn vẹn không gian riêng.'
    WHEN N'1904' THEN N'Biệt thự Hoàng gia 1904 mang đến cảm giác như một ngôi nhà nghỉ dưỡng riêng giữa tầng cao: phòng khách, khu ngủ cao cấp, khu vực dùng bữa và sân hiên ngắm thành phố. Quản gia tận tâm đồng hành để kỳ nghỉ của tối đa 8 khách trở nên nhẹ nhàng và đáng nhớ.'
    WHEN N'2004' THEN N'Biệt thự Hoàng gia 2004 là căn villa đặc biệt ở tầng cao nhất của bộ sưu tập, nơi cả nhóm có thể tận hưởng phòng khách riêng, khu ngủ rộng, ban công riêng và không gian thư giãn biệt lập. Villa phục vụ tối đa 8 khách với dịch vụ quản gia và trải nghiệm cá nhân hóa.'
    ELSE moTa
END
WHERE maLoaiPhong = N'RT009';

COMMIT;
