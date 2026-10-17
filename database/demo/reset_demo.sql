-- Nạp lại dữ liệu demo sau khi Flyway đã chạy đủ V1–V6.
-- Script chỉ thay dữ liệu, gồm cả tài khoản nhân viên; không định nghĩa đối tượng SQL.
-- Các bước xóa, đặt lại ID và nạp dữ liệu nằm trong cùng một giao dịch.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- Một mốc thời gian nghiệp vụ chung cho toàn bộ dữ liệu demo, kể cả SQL Server chạy UTC.
DECLARE @demoNow DATETIME2(6) = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(6));
DECLARE @demoToday DATE = CAST(@demoNow AS DATE);
DECLARE @demoShift NVARCHAR(20) = CASE WHEN DATEPART(HOUR, @demoNow) BETWEEN 6 AND 13 THEN N'Ca sáng'
    WHEN DATEPART(HOUR, @demoNow) BETWEEN 14 AND 21 THEN N'Ca chiều' ELSE N'Ca đêm' END;
DECLARE @demoShiftStart DATETIME2(6) = CASE
    WHEN DATEPART(HOUR, @demoNow) BETWEEN 6 AND 13 THEN DATEADD(HOUR, 6, CAST(@demoToday AS DATETIME2))
    WHEN DATEPART(HOUR, @demoNow) BETWEEN 14 AND 21 THEN DATEADD(HOUR, 14, CAST(@demoToday AS DATETIME2))
    WHEN DATEPART(HOUR, @demoNow) >= 22 THEN DATEADD(HOUR, 22, CAST(@demoToday AS DATETIME2))
    ELSE DATEADD(HOUR, -2, CAST(@demoToday AS DATETIME2)) END;

-- =============================================================================
-- 1. Xóa dữ liệu phụ thuộc trước dữ liệu cha để thỏa khóa ngoại.
-- =============================================================================
DELETE FROM HangDoiThongBao;
DELETE FROM ChiTietTienBanGiao;
DELETE FROM TaiSanKyThuat;
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
DELETE FROM YeuCauThanhToanVnpay;
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
DELETE FROM YeuCauKho;
DELETE FROM BienDongKhoDichVu;
DELETE FROM LichSuGiaDichVu;
UPDATE DichVu SET maNguonTaiNguyen=NULL;
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
DELETE FROM DeNghiTiepNhanNhanVien;
DELETE FROM HoSoNhanSu;
DELETE FROM NhanVien;

-- =============================================================================
-- 2. Đặt lại bộ đếm ID để các liên kết trong fixture có mã ổn định.
-- =============================================================================
DBCC CHECKIDENT (N'KhachLuuTru', RESEED, 0);
DBCC CHECKIDENT (N'TaiKhoanKhachHang', RESEED, 0);
DBCC CHECKIDENT (N'PhieuDatPhong', RESEED, 0);
DBCC CHECKIDENT (N'YeuCauThanhToanVnpay', RESEED, 0);
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
DBCC CHECKIDENT (N'DonNghiPhep', RESEED, 0);
DBCC CHECKIDENT (N'ChamCong', RESEED, 0);
DBCC CHECKIDENT (N'HoaDonGiaTriGiaTang', RESEED, 0);
-- =============================================================================
-- 3. Nạp danh mục phòng, ảnh, tiện nghi, khách, tài khoản và dịch vụ.
-- =============================================================================
INSERT INTO LoaiPhong
(maLoaiPhong, ten, maHangPhong, giaTheoNgay, giaTheoGio, dienTich, huongNhin, loaiGiuong, soKhachToiDa, duongDanAnhBia, moTa, trangThaiDanhMuc, nguoiCapNhatDanhMuc, nguoiDuyetDanhMuc, thoiDiemCapNhatDanhMuc, thoiDiemDuyetDanhMuc)
VALUES
(N'RT001', N'Phòng Classic Queen', N'STD', 1200000.00, 180000.00, 18.00, N'Thành phố', N'Giường Queen', 2,
 N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=800&fit=crop&auto=format',
 N'Phòng Classic thanh lịch với giường Queen và tiện nghi chỉn chu cho tối đa 2 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT002', N'Phòng Classic Twin', N'STD', 1450000.00, 220000.00, 25.00, N'Thành phố', N'Hai giường đơn', 4,
 N'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=800&fit=crop&auto=format',
 N'Phòng Classic Twin với hai giường đơn và không gian thoải mái cho nhóm nhỏ tối đa 4 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT003', N'Phòng Superior King', N'SUP', 1800000.00, 260000.00, 28.00, N'Hướng vườn', N'Giường King', 2,
 N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=800&fit=crop&auto=format',
 N'Không gian SUP thoáng hơn, nội thất nâng cấp và cửa sổ hướng vườn.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT004', N'Phòng Superior Hai Giường Queen', N'SUP', 2100000.00, 300000.00, 35.00, N'Thành phố', N'Hai giường Queen', 4,
 N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&h=800&fit=crop&auto=format',
 N'Phòng SUP đôi rộng rãi với tầm nhìn thoáng, phù hợp gia đình tối đa 4 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT005', N'Phòng Deluxe King', N'DLX', 2600000.00, 380000.00, 45.00, N'Biển Vũng Tàu', N'Giường King', 4,
 N'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1200&h=800&fit=crop&auto=format',
 N'Phòng Deluxe tầng cao, diện tích rộng, tầm nhìn biển Vũng Tàu và trang thiết bị cao cấp.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT006', N'Phòng Deluxe Family', N'DLX', 3200000.00, 460000.00, 58.00, N'Toàn cảnh thành phố', N'Hai giường Queen + sofa', 6,
 N'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=1200&h=800&fit=crop&auto=format',
 N'DLX Family cho nhóm đông, có khu vực sofa và không gian nghỉ thoải mái tối đa 6 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT007', N'Suite Hoàng Gia Residence', N'SUT', 4500000.00, 650000.00, 78.00, N'Biển Vũng Tàu', N'Giường King + phòng khách', 8,
 N'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&h=800&fit=crop&auto=format',
 N'Suite Residence tầng cao với phòng khách riêng, bồn tắm và sức chứa tối đa 8 khách.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT008', N'Suite Hoàng Gia Executive', N'SUT', 5800000.00, 800000.00, 92.00, N'Toàn cảnh thành phố', N'Giường King + phòng khách', 8,
 N'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&h=800&fit=crop&auto=format',
 N'Suite Executive rộng nhất hạng SUT, ban công riêng và dịch vụ đón tiếp cao cấp.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow),
(N'RT009', N'Penthouse Tổng Thống', N'VIP', 9500000.00, 1200000.00, 120.00, N'Toàn cảnh thành phố', N'Giường King + phòng khách riêng', 8,
 N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&h=800&fit=crop&auto=format',
 N'Penthouse tầng cao dành cho tối đa 8 khách, gồm phòng khách riêng, khu ngủ sang trọng và tầm nhìn toàn cảnh thành phố.', N'Đang hoạt động', N'DEMO_SEED', N'DEMO_SEED', @demoNow, @demoNow);

UPDATE LoaiPhong
SET khauHieuQuangBa = CASE maLoaiPhong
    WHEN N'RT001' THEN N'Tinh tế trong từng chi tiết & trọn vẹn từng phút giây lưu trú'
    WHEN N'RT002' THEN N'Tinh tế trong từng chi tiết & trọn vẹn từng phút giây lưu trú'
    WHEN N'RT003' THEN N'Không gian thanh lịch & cảm hứng sống đầy phong cách'
    WHEN N'RT004' THEN N'Không gian thanh lịch & cảm hứng sống đầy phong cách'
    WHEN N'RT005' THEN N'Thiết kế sang trọng & không gian thư giãn rộng mở'
    WHEN N'RT006' THEN N'Thiết kế sang trọng & không gian thư giãn rộng mở'
    WHEN N'RT007' THEN N'Phòng khách riêng & phong cách lưu trú thượng lưu'
    WHEN N'RT008' THEN N'Phòng khách riêng & phong cách lưu trú thượng lưu'
    WHEN N'RT009' THEN N'Tầm nhìn thành phố từ tầng cao & không gian riêng tư đẳng cấp'
END;

INSERT INTO HinhAnhLoaiPhong(maLoaiPhong, duongDanAnh, thuTuHienThi)
SELECT
    t.maLoaiPhong,
    a.duongDanAnh,
    a.thuTuHienThi
FROM LoaiPhong t
JOIN (
    SELECT
        N'STD' maHangPhong,
        N'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&h=750&fit=crop&auto=format' duongDanAnh,
        0 thuTuHienThi
    UNION ALL
    SELECT
        N'STD',
        N'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=750&fit=crop&auto=format',
        1
    UNION ALL
    SELECT
        N'STD',
        N'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900&h=750&fit=crop&auto=format',
        2
    UNION ALL
    SELECT
        N'SUP',
        N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=750&fit=crop&auto=format',
        0
    UNION ALL
    SELECT
        N'SUP',
        N'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&h=750&fit=crop&auto=format',
        1
    UNION ALL
    SELECT
        N'SUP',
        N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format',
        2
    UNION ALL
    SELECT
        N'DLX',
        N'https://images.unsplash.com/photo-1591088398332-8a7791972843d?w=900&h=750&fit=crop&auto=format',
        0
    UNION ALL
    SELECT
        N'DLX',
        N'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=750&fit=crop&auto=format',
        1
    UNION ALL
    SELECT
        N'DLX',
        N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=750&fit=crop&auto=format',
        2
    UNION ALL
    SELECT
        N'SUT',
        N'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=900&h=750&fit=crop&auto=format',
        0
    UNION ALL
    SELECT
        N'SUT',
        N'https://images.unsplash.com/photo-1578898886225-c7c894047899?w=1200&h=750&fit=crop&auto=format',
        1
    UNION ALL
    SELECT
        N'SUT',
        N'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=900&h=750&fit=crop&auto=format',
        2
    UNION ALL
    SELECT
        N'VIP',
        N'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&h=800&fit=crop&auto=format',
        0
    UNION ALL
    SELECT
        N'VIP',
        N'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=1200&h=800&fit=crop&auto=format',
        1
    UNION ALL
    SELECT
        N'VIP',
        N'https://images.pexels.com/photos/271637/pexels-photo-271637.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop',
        2
) a
    ON a.maHangPhong = t.maHangPhong;

INSERT INTO Phong (maPhong, maLoaiPhong, trangThai, moTa, ten, tang, phienBan) VALUES
(N'501', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 5', N'501', 5, 0),
(N'502', N'RT002', N'Sẵn sàng', N'STD đôi · tầng 5', N'502', 5, 0),
(N'503', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 5', N'503', 5, 0),
(N'504', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 5', N'504', 5, 0),
(N'601', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 6', N'601', 6, 0),
(N'602', N'RT002', N'Đang dọn phòng', N'STD đôi · tầng 6', N'602', 6, 0),
(N'603', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 6', N'603', 6, 0),
(N'604', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 6', N'604', 6, 0),
(N'701', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 7', N'701', 7, 0),
(N'702', N'RT002', N'Đang bảo trì', N'STD đôi · tầng 7', N'702', 7, 0),
(N'703', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 7', N'703', 7, 0),
(N'704', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 7', N'704', 7, 0),
(N'801', N'RT001', N'Sẵn sàng', N'STD đơn · tầng 8', N'801', 8, 0),
(N'802', N'RT002', N'Đã giữ phòng', N'STD đôi · tầng 8', N'802', 8, 0),
(N'803', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 8', N'803', 8, 0),
(N'804', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 8', N'804', 8, 0),
(N'901', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 9', N'901', 9, 0),
(N'902', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 9', N'902', 9, 0),
(N'903', N'RT005', N'Sẵn sàng', N'DLX King · tầng 9', N'903', 9, 0),
(N'904', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 9', N'904', 9, 0),
(N'1001', N'RT003', N'Sẵn sàng', N'SUP đơn · tầng 10', N'1001', 10, 0),
(N'1002', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 10', N'1002', 10, 0),
(N'1003', N'RT005', N'Sẵn sàng', N'DLX King · tầng 10', N'1003', 10, 0),
(N'1004', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 10', N'1004', 10, 0),
(N'1101', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 11', N'1101', 11, 0),
(N'1102', N'RT005', N'Sẵn sàng', N'DLX King · tầng 11', N'1102', 11, 0),
(N'1103', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 11', N'1103', 11, 0),
(N'1104', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 11', N'1104', 11, 0),
(N'1201', N'RT004', N'Sẵn sàng', N'SUP đôi · tầng 12', N'1201', 12, 0),
(N'1202', N'RT005', N'Sẵn sàng', N'DLX King · tầng 12', N'1202', 12, 0),
(N'1203', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 12', N'1203', 12, 0),
(N'1204', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 12', N'1204', 12, 0),
(N'1301', N'RT005', N'Sẵn sàng', N'DLX King · tầng 13', N'1301', 13, 0),
(N'1302', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 13', N'1302', 13, 0),
(N'1303', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 13', N'1303', 13, 0),
(N'1304', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 13', N'1304', 13, 0),
(N'1401', N'RT005', N'Sẵn sàng', N'DLX King · tầng 14', N'1401', 14, 0),
(N'1402', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 14', N'1402', 14, 0),
(N'1403', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 14', N'1403', 14, 0),
(N'1404', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 14', N'1404', 14, 0),
(N'1501', N'RT005', N'Sẵn sàng', N'DLX King · tầng 15', N'1501', 15, 0),
(N'1502', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 15', N'1502', 15, 0),
(N'1503', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 15', N'1503', 15, 0),
(N'1504', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 15', N'1504', 15, 0),
(N'1601', N'RT005', N'Sẵn sàng', N'DLX King · tầng 16', N'1601', 16, 0),
(N'1602', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 16', N'1602', 16, 0),
(N'1603', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 16', N'1603', 16, 0),
(N'1604', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 16', N'1604', 16, 0),
(N'1701', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 17', N'1701', 17, 0),
(N'1702', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 17', N'1702', 17, 0),
(N'1703', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 17', N'1703', 17, 0),
(N'1704', N'RT009', N'Sẵn sàng', N'Penthouse Tổng Thống · tầng 17', N'1704', 17, 0),
(N'1801', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 18', N'1801', 18, 0),
(N'1802', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 18', N'1802', 18, 0),
(N'1803', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 18', N'1803', 18, 0),
(N'1804', N'RT009', N'Sẵn sàng', N'Penthouse Tổng Thống · tầng 18', N'1804', 18, 0),
(N'1901', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 19', N'1901', 19, 0),
(N'1902', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 19', N'1902', 19, 0),
(N'1903', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 19', N'1903', 19, 0),
(N'1904', N'RT009', N'Sẵn sàng', N'Penthouse Tổng Thống · tầng 19', N'1904', 19, 0),
(N'2001', N'RT006', N'Sẵn sàng', N'DLX Family · tầng 20', N'2001', 20, 0),
(N'2002', N'RT007', N'Sẵn sàng', N'Suite Residence · tầng 20', N'2002', 20, 0),
(N'2003', N'RT008', N'Sẵn sàng', N'Suite Executive · tầng 20', N'2003', 20, 0),
(N'2004', N'RT009', N'Sẵn sàng', N'Penthouse Tổng Thống · tầng 20', N'2004', 20, 0);

-- Nội dung quảng cáo và gallery được gắn theo từng phòng, không dùng chung theo loại phòng.
UPDATE r
SET moTa = CONCAT(N'Phòng ', r.ten, N' tại tầng ', r.tang, N' mang đến ', CASE (TRY_CONVERT(INT, r.ten) % 4)
    WHEN 0 THEN N'góc nhìn rộng mở và không gian yên tĩnh cho kỳ nghỉ riêng tư. '
    WHEN 1 THEN N'ánh sáng tự nhiên dịu nhẹ cùng góc nghỉ hướng thành phố. '
    WHEN 2 THEN N'không gian thoáng đãng, phù hợp cho những ngày nghỉ thư thái. '
    ELSE N'cảm giác ấm cúng với tầm nhìn đẹp và không gian lưu trú thanh lịch. '
END, CASE t.maHangPhong
    WHEN N'STD' THEN N'Thiết kế Classic thanh lịch, giường ngủ êm ái và đầy đủ tiện nghi thiết yếu cho chuyến lưu trú thoải mái.'
    WHEN N'SUP' THEN N'Diện tích rộng rãi hơn, nội thất nâng cấp và khu vực nghỉ ngơi tiện nghi cho gia đình hoặc nhóm bạn.'
    WHEN N'DLX' THEN N'Không gian cao cấp với khu vực thư giãn riêng, trang thiết bị chọn lọc và trải nghiệm lưu trú sang trọng.'
    WHEN N'SUT' THEN N'Phòng khách biệt lập, ban công riêng và tiện nghi cao cấp dành cho kỳ nghỉ dài ngày hoặc những dịp đặc biệt.'
    WHEN N'VIP' THEN N'Penthouse tầng cao riêng tư với phòng khách, khu ngủ sang trọng và dịch vụ đón tiếp tận tâm.'
    ELSE N'Không gian lưu trú được chuẩn bị chỉn chu với các tiện nghi cần thiết cho khách lưu trú.'
END, N' Mã phòng: ', r.ten, N'.')
FROM Phong r
JOIN LoaiPhong t
    ON t.maLoaiPhong = r.maLoaiPhong;

INSERT INTO HinhAnhPhong(
    maPhong,
    duongDanTuongDoi,
    thuTuHienThi,
    laAnhBia,
    loaiNoiDung,
    kichThuocByte,
    dangHoatDong
)
SELECT
    r.maPhong,
    CONCAT(N'https://images.unsplash.com/photo-', CASE t.maHangPhong
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
    END, N'?w=1200&h=800&fit=crop&auto=format&room=', r.maPhong, N'&view=', gallery.image_no + 1),
    gallery.image_no,
    CASE
        WHEN gallery.image_no = 0 THEN 1
        ELSE 0
    END,
    N'image/jpeg',
    1,
    1
FROM Phong r
JOIN LoaiPhong t
    ON t.maLoaiPhong = r.maLoaiPhong
CROSS JOIN (
    SELECT
        0 AS image_no
    UNION ALL
    SELECT
        1
    UNION ALL
    SELECT
        2
    UNION ALL
    SELECT
        3
) AS gallery;
INSERT INTO TienNghi (ten, dangHoatDong) VALUES
(N'WiFi', 1), (N'Điều hòa', 1), (N'TV 4K', 1), (N'Minibar', 1),
(N'Két an toàn', 1), (N'Bồn tắm', 1), (N'Máy pha cà phê', 1),
(N'Ban công', 1), (N'Phòng khách riêng', 1), (N'Quản gia riêng', 1),
(N'Bàn làm việc', 1), (N'Sofa thư giãn', 1), (N'Bếp nhỏ', 1), (N'Dịch vụ quản gia 24/7', 1);
INSERT INTO LoaiPhongTienNghi(maLoaiPhong, maTienNghi)
SELECT
    N'RT001',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bàn làm việc')
UNION ALL
SELECT
    N'RT002',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bàn làm việc')
UNION ALL
SELECT
    N'RT003',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Bàn làm việc')
UNION ALL
SELECT
    N'RT004',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc')
UNION ALL
SELECT
    N'RT005',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc', N'Sofa thư giãn')
UNION ALL
SELECT
    N'RT006',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Bàn làm việc', N'Sofa thư giãn')
UNION ALL
SELECT
    N'RT007',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Sofa thư giãn')
UNION ALL
SELECT
    N'RT008',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Sofa thư giãn')
UNION ALL
SELECT
    N'RT009',
    maTienNghi
FROM TienNghi
WHERE ten IN (N'WiFi', N'Điều hòa', N'TV 4K', N'Minibar', N'Két an toàn', N'Bồn tắm', N'Máy pha cà phê', N'Ban công', N'Phòng khách riêng', N'Quản gia riêng', N'Dịch vụ quản gia 24/7', N'Sofa thư giãn');

SET IDENTITY_INSERT KhachLuuTru ON;
INSERT INTO KhachLuuTru
(maKhachLuuTru, hoVaTen, diaChi, soDienThoai, email, soGiayToTuyThan, namSinh, hangThanhVien, tongChiTieu, soLanHuyMuon, soLanLuuTruHoanThanh, soLanTraPhongMuon, biChanDatPhong, phienBan)
VALUES
(1, N'Nguyễn Văn An', N'Quận 1, TP.HCM', N'0901234567', N'an.nguyen@example.test', N'012345678901',
  1990, N'Tiêu chuẩn', 0.00, 0, 0, 0, 0, 0),
(2, N'Trần Thị Bình', N'Quận 3, TP.HCM', N'0912345678', N'binh.tran@example.test', N'098765432109',
  1988, N'Bạch kim', 12000000.00, 0, 50, 0, 0, 0),
(3, N'Lê Hoàng Cường', N'Quận 7, TP.HCM', N'0923456789', N'cuong.le@example.test', N'112233445566',
  1995, N'Tiêu chuẩn', 500000.00, 1, 1, 0, 0, 0);
SET IDENTITY_INSERT KhachLuuTru OFF;
-- Mật khẩu demo hotel123 được lưu dưới dạng BCrypt, cost 12.
INSERT INTO TaiKhoanKhachHang(
    maKhachLuuTru,
    soDienThoai,
    matKhau,
    duocKichHoat,
    taiKhoanKhongBiKhoa
)
SELECT
    maKhachLuuTru,
    soDienThoai,
    N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO',
    1,
    1
FROM KhachLuuTru
WHERE soDienThoai = N'0901234567';
-- Tài khoản nhân viên demo dùng cho từng màn hình theo vai trò.
-- Mật khẩu demo hotel123 được lưu dưới dạng BCrypt, cost 12.
INSERT INTO NhanVien
    (maNhanVien, hoVaTen, matKhau, vaiTro, diaChi, soDienThoai, duocKichHoat, taiKhoanKhongBiKhoa, soLanDangNhapThatBai, trangThaiLamViec)
VALUES
    (N'FRONTDESK', N'Nguyễn Minh Lễ Tân', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Lễ tân', N'TP.HCM', N'0902000001', 1, 1, 0, N'Đang làm việc'),
    (N'HOUSEKEEP', N'Trần Thị Buồng Phòng', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Buồng phòng', N'TP.HCM', N'0902000002', 1, 1, 0, N'Đang làm việc'),
    (N'TECHNICAL', N'Lê Hoàng Kỹ Thuật', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Kỹ thuật', N'TP.HCM', N'0902000003', 1, 1, 0, N'Đang làm việc'),
    (N'ACCOUNTING', N'Phạm Thị Kế Toán', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Kế toán', N'TP.HCM', N'0902000004', 1, 1, 0, N'Đang làm việc'),
    (N'KITCHEN', N'Võ Minh Kho và Dịch vụ', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Nhà bếp', N'TP.HCM', N'0902000005', 1, 1, 0, N'Đang làm việc'),
    (N'MANAGER', N'Hoàng Minh Quản', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Quản lý', N'TP.HCM', N'0902000006', 1, 1, 0, N'Đang làm việc'),
    (N'DIRECTOR', N'Đỗ Thanh Giám Đốc', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Giám đốc', N'TP.HCM', N'0902000007', 1, 1, 0, N'Đang làm việc'),
    (N'ADMIN', N'Quản Trị Hệ Thống', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Quản trị viên', N'TP.HCM', N'0902000008', 1, 1, 0, N'Đang làm việc'),
    (N'HR', N'Nguyễn Thị Nhân Sự', N'$2a$12$5gNPcR6X5sTK6KSqi4PPKOgq6sXai.z77eMBmEDToFQCbOmVNGoiO', N'Nhân sự', N'TP.HCM', N'0902000009', 1, 1, 0, N'Đang làm việc')
;INSERT INTO DichVu
(maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong, danhMuc, moTa, duongDanAnh)
VALUES
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
 N'Bữa trưa hoặc bữa tối tại MaM Restaurant. Khách lưu trú qua đêm được miễn phí một bữa trưa và một bữa tối mỗi ngày cho mỗi khách.',
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
 N'https://images.unsplash.com/photo-1750271336429-8b0a507785c0?w=600&h=400&fit=crop&auto=format');

-- =============================================================================
-- 4. Tạo các tình huống demo: đang ở, sắp đến, đã trả phòng và chờ cọc.
-- ID cố định liên kết booking với phòng, hóa đơn, thanh toán và biên lai bên dưới.
-- DATEADD(SECOND, 50400/43200, ...) đặt mốc 14:00 nhận phòng / 12:00 trả phòng.
-- =============================================================================
SET IDENTITY_INSERT PhieuDatPhong ON;
INSERT INTO PhieuDatPhong(
    maPhieuDatPhong,
    maKhachLuuTru,
    maNhanVien,
    maTaiKhoanKhachHang,
    thoiDiemDat,
    tienDatCoc,
    trangThai,
    hinhThucThue,
    thoiDiemNhanPhongThucTe,
    thoiDiemTraPhongThucTe,
    soPhutGiaHan,
    khoaChongTrung,
    phienBan,
    maThanhToanDatCoc,
    thoiDiemHetHanThanhToanCoc,
    trangThaiThanhToanCoc
)
-- Booking 1: Khách online đang ở phòng 501.
VALUES (
    1,
    1,
    N'FRONTDESK',
    (
        SELECT
            maTaiKhoanKhachHang
        FROM TaiKhoanKhachHang
        WHERE soDienThoai = N'0901234567'
    ),
    DATEADD(DAY, - 2, @demoNow),
    1200000.00,
    N'Đã nhận phòng',
    N'Theo gói',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 1, CAST(@demoNow AS date)) AS datetime2)),
    NULL,
    0,
    N'DEMO-RES-001',
    0,
    NULL,
    NULL,
    N'Đã thanh toán'
),
-- Booking 2: Khách đặt qua lễ tân, sắp nhận phòng 502.
(
    2,
    2,
    N'FRONTDESK',
    NULL,
    DATEADD(DAY, - 3, @demoNow),
    0.00,
    N'Đã xác nhận',
    N'Theo gói',
    NULL,
    NULL,
    0,
    N'DEMO-RES-002',
    0,
    NULL,
    NULL,
    N'Không yêu cầu'
),
-- Booking 3: Khách đang ở phòng 601, có sự cố thiết bị.
(
    3,
    3,
    N'FRONTDESK',
    NULL,
    DATEADD(DAY, - 3, @demoNow),
    0.00,
    N'Đã nhận phòng',
    N'Theo gói',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 2, CAST(@demoNow AS date)) AS datetime2)),
    NULL,
    0,
    N'DEMO-RES-003',
    0,
    NULL,
    NULL,
    N'Không yêu cầu'
),
-- Booking 4: Booking phòng 701 đã trả phòng và thanh toán.
(
    4,
    2,
    N'FRONTDESK',
    NULL,
    DATEADD(DAY, - 7, @demoNow),
    1800000.00,
    N'Đã trả phòng',
    N'Theo gói',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 5, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 41400, CAST(DATEADD(DAY, - 2, CAST(@demoNow AS date)) AS datetime2)),
    0,
    N'DEMO-RES-004',
    0,
    NULL,
    NULL,
    N'Đã thanh toán'
),
-- Booking 5: Booking theo giờ phòng 801 đang chờ cọc VNPay.
(
    5,
    1,
    NULL,
    (
        SELECT
            maTaiKhoanKhachHang
        FROM TaiKhoanKhachHang
        WHERE soDienThoai = N'0901234567'
    ),
    @demoNow,
    270000.00,
    N'Chờ thanh toán',
    N'Theo giờ',
    NULL,
    NULL,
    0,
    N'DEMO-RES-005',
    0,
    N'DEMO-DEP-005',
    DATEADD(MINUTE, 10, @demoNow),
    N'Chờ thanh toán'
),
-- Booking 6: Booking phòng 1401 đã thanh toán cọc VNPay.
(
    6,
    1,
    NULL,
    (
        SELECT
            maTaiKhoanKhachHang
        FROM TaiKhoanKhachHang
        WHERE soDienThoai = N'0901234567'
    ),
    DATEADD(MINUTE, -15, @demoNow),
    3900000.00,
    N'Đã thanh toán cọc',
    N'Theo gói',
    NULL,
    NULL,
    0,
    N'DEMO-RES-006',
    0,
    N'DEMO-DEP-006',
    NULL,
    N'Đã thanh toán'
);
SET IDENTITY_INSERT PhieuDatPhong OFF;

INSERT INTO ChiTietDatPhong(
    maPhieuDatPhong,
    maPhong,
    thoiDiemNhanPhong,
    thoiDiemTraPhong,
    thoiDiemTraPhongBanDau,
    trangThai,
    soLanChuyenPhong,
    soLuongKhach
)
VALUES (
    1,
    N'501',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 1, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)),
    N'Đang có khách',
    0,
    2
),
(
    2,
    N'502',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, 1, @demoToday) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, CAST(@demoNow AS date)) AS datetime2)),
    N'Đã giữ phòng',
    0,
    1
),
(
    3,
    N'601',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 2, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(CAST(@demoNow AS date) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(CAST(@demoNow AS date) AS datetime2)),
    N'Đang có khách',
    0,
    1
),
(
    4,
    N'701',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, - 5, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, - 2, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, - 2, CAST(@demoNow AS date)) AS datetime2)),
    N'Đã trả phòng',
    0,
    2
),
(
    5,
    N'801',
    DATEADD(SECOND, 54000, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 64800, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)),
    DATEADD(SECOND, 64800, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)),
    N'Giữ tạm phòng',
    0,
    1
),
(
    6,
    N'1401',
    DATEADD(SECOND, 50400, CAST(DATEADD(DAY, 1, @demoToday) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, @demoToday) AS datetime2)),
    DATEADD(SECOND, 43200, CAST(DATEADD(DAY, 4, @demoToday) AS datetime2)),
    N'Đã giữ phòng',
    0,
    2
);

UPDATE Phong
SET trangThai = CASE maPhong
    WHEN N'501' THEN N'Đang có khách'
    WHEN N'502' THEN N'Đang dọn phòng'
    WHEN N'601' THEN N'Đang có khách'
    WHEN N'602' THEN N'Đang dọn phòng'
    WHEN N'701' THEN N'Đang dọn phòng'
    WHEN N'702' THEN N'Đang bảo trì'
    WHEN N'801' THEN N'Đã giữ phòng'
    WHEN N'802' THEN N'Sẵn sàng'
    ELSE trangThai
END;

-- Hai trạng thái thanh toán online: đang chờ và đã hoàn tất.
INSERT INTO YeuCauThanhToanVnpay
    (maPhieuDatPhong, maThamChieuMerchant, soTien, trangThai, thoiDiemTao, thoiDiemHetHan, thoiDiemHoanTat, maGiaoDichVnpay, maNganHang, loaiThe, maPhanHoi)
VALUES
    (5, N'DEMO-DEP-005', 270000.00, N'Chờ thanh toán', @demoNow, DATEADD(MINUTE, 10, @demoNow), NULL, NULL, NULL, NULL, NULL),
    (6, N'DEMO-DEP-006', 3900000.00, N'Thành công', DATEADD(MINUTE, -10, @demoNow), DATEADD(MINUTE, 20, @demoNow), @demoNow, N'DEMO-VNPAY-006', N'NCB', N'ATM', N'00');

-- Booking demo 5 và 6 có mã thanh toán cọc: gắn kênh VNPay cho luồng thanh toán online.
UPDATE PhieuDatPhong
SET phuongThucBaoDam = N'VNPay'
WHERE maPhieuDatPhong IN (5, 6)
    AND maThanhToanDatCoc IS NOT NULL;

INSERT INTO SuDungDichVu (maPhieuDatPhong, maDichVu, ngaySuDung, soLuong, donGia) VALUES
    (1, N'BREAKFAST', DATEADD(DAY, -1, CAST(@demoNow AS date)), 2, 0.00),
    (1, N'SPAMASS', CAST(@demoNow AS date), 1, 980000.00),
    (3, N'BREAKFAST', CAST(@demoNow AS date), 1, 0.00),
    (4, N'SPAFACIAL', DATEADD(DAY, -3, CAST(@demoNow AS date)), 1, 1350000.00);

INSERT INTO DatDichVuKhachSan
    (maPhieuDatPhong, maPhong, maDichVu, thoiDiemDuKien, buoiAn, soLuong, soLuongMienPhi, donGia, trangThai, khoaYeuCau, maBamYeuCau, nguoiTao, thoiDiemSuDung, nguoiXacNhanSuDung)
VALUES
    (1, N'501', N'MAMREST', DATEADD(SECOND, 43200, CAST(CAST(@demoNow AS date) AS datetime2)), N'Bữa trưa', 2, 2,
     250000.00, N'Đã sử dụng', N'DEMO-SERVICE-001', REPLICATE(N'0', 64), N'FRONTDESK', @demoNow, N'FRONTDESK'),
    (6, N'1401', N'SPAMASS', DATEADD(SECOND, 57600, CAST(DATEADD(DAY, 1, CAST(@demoNow AS date)) AS datetime2)), NULL, 1, 0,
     980000.00, N'Đã xác nhận', N'DEMO-SERVICE-002', REPLICATE(N'0', 64), N'customer:1', NULL, NULL);
SET IDENTITY_INSERT HoaDon ON;
INSERT INTO HoaDon(
    maHoaDon,
    maPhieuDatPhong,
    thoiDiemPhatHanh,
    tienGiamGia,
    tienDatCocDaTra,
    phuongThucThanhToan,
    trangThai,
    tongTienPhong,
    tongTienDichVu,
    soTienPhaiTra,
    tienPhuThu,
    tienBoiThuong,
    phiGiaHan,
    tongTienDieuChinh,
    phienBan
)
VALUES (
    1,
    1,
    DATEADD(DAY, -2, @demoNow),
    0.00,
    1200000.00,
    N'Tiền mặt',
    N'Chưa thanh toán',
    2400000.00,
    980000.00,
    2180000.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0
),
(
    3,
    3,
    DATEADD(DAY, -3, @demoNow),
    0.00,
    0.00,
    N'Tiền mặt',
    N'Chưa thanh toán',
    2400000.00,
    0.00,
    1700000.00,
    0.00,
    300000.00,
    0.00,
    0.00,
    0
),
(
    4,
    4,
    DATEADD(DAY, -7, @demoNow),
    540000.00,
    1800000.00,
    N'Thẻ',
    N'Đã thanh toán',
    3600000.00,
    1350000.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0
),
-- Booking 6 đã thu cọc online, còn tiền phòng phải thanh toán khi checkout.
(
    6, 6, @demoNow, 0.00, 3900000.00, N'Chuyển khoản ngân hàng', N'Chưa thanh toán',
    7800000.00, 0.00, 3900000.00, 0.00, 0.00, 0.00, 0.00, 0
);
SET IDENTITY_INSERT HoaDon OFF;

SET IDENTITY_INSERT GiaoDichThanhToan ON;
INSERT INTO GiaoDichThanhToan
    (maGiaoDichThanhToan, maHoaDon, soTien, phuongThuc, loai, trangThai, maThamChieu, thoiDiemPhatSinh, maNguoiThucHien, khoaChongTrung, maSuKienBenNgoai)
VALUES
    (1, 1, 1200000.00, N'Tiền mặt', N'Thanh toán', N'Đã hoàn tất', N'DEPOSIT:1', DATEADD(DAY, -1, @demoNow), N'FRONTDESK', N'DEMO-PAY-001', NULL),
    (2, 3, 1000000.00, N'Tiền mặt', N'Thanh toán', N'Đã hoàn tất', N'PAY:3:PARTIAL', DATEADD(HOUR, -1, @demoNow), N'FRONTDESK', N'DEMO-PAY-002', NULL),
    (3, 4, 1800000.00, N'Chuyển khoản ngân hàng', N'Thanh toán', N'Đã hoàn tất', N'DEPOSIT:4', DATEADD(DAY, -5, @demoNow), N'FRONTDESK', N'DEMO-PAY-003', NULL),
    (4, 4, 2610000.00, N'Thẻ', N'Thanh toán', N'Đã hoàn tất', N'FINAL:4', DATEADD(DAY, -2, @demoNow), N'ACCOUNTING', N'DEMO-PAY-004', NULL),
    (5, 6, 3900000.00, N'Chuyển khoản ngân hàng', N'Thanh toán', N'Đã hoàn tất', N'DEPOSIT:6', @demoNow, N'FRONTDESK', N'DEMO-PAY-006', N'DEMO-VNPAY-006');
SET IDENTITY_INSERT GiaoDichThanhToan OFF;

SET IDENTITY_INSERT BienLai ON;
INSERT INTO BienLai
    (maBienLai, soBienLai, maHoaDon, soTien, phuongThuc, thoiDiemPhatHanh, nguoiPhatHanh)
VALUES
    (1, N'DEP-DEMO-001', 1, 1200000.00, N'Tiền mặt', DATEADD(DAY, -1, @demoNow), N'FRONTDESK'),
    (2, N'RCPT-DEMO-003', 3, 1000000.00, N'Tiền mặt', DATEADD(HOUR, -1, @demoNow), N'FRONTDESK'),
    (3, N'DEP-DEMO-004', 4, 1800000.00, N'Chuyển khoản ngân hàng', DATEADD(DAY, -5, @demoNow), N'FRONTDESK'),
    (4, N'RCPT-DEMO-004', 4, 2610000.00, N'Thẻ', DATEADD(DAY, -2, @demoNow), N'ACCOUNTING'),
    (5, N'DEP-DEMO-006', 6, 3900000.00, N'Chuyển khoản ngân hàng', @demoNow, N'FRONTDESK');
SET IDENTITY_INSERT BienLai OFF;

SET IDENTITY_INSERT ThietBiPhong ON;
INSERT INTO ThietBiPhong
    (maThietBiPhong, maPhong, ten, giaTriBanDau, ngayMua, soLuong, dangHoatDong)
VALUES
    (1, N'501', N'Minibar', 6500000.00, DATEADD(MONTH, -18, CAST(@demoNow AS date)), 1, 1),
    (2, N'501', N'TV 4K', 12000000.00, DATEADD(MONTH, -12, CAST(@demoNow AS date)), 1, 1),
    (3, N'601', N'Máy sấy tóc', 800000.00, DATEADD(MONTH, -10, CAST(@demoNow AS date)), 1, 1),
    (4, N'602', N'Điều hòa', 18000000.00, DATEADD(MONTH, -14, CAST(@demoNow AS date)), 1, 1),
    (5, N'702', N'Điều hòa', 22000000.00, DATEADD(MONTH, -20, CAST(@demoNow AS date)), 1, 1),
    (6, N'702', N'Két an toàn', 9000000.00, DATEADD(MONTH, -15, CAST(@demoNow AS date)), 1, 1);
SET IDENTITY_INSERT ThietBiPhong OFF;

SET IDENTITY_INSERT SuCoThietBi ON;
INSERT INTO SuCoThietBi
    (maSuCoThietBi, maPhieuDatPhong, maPhong, tenThietBi, giaTriBanDau, ngayMua, soLuong, tienBoiThuong, thoiDiemTao, mucDoNghiemTrong, trangThaiBanGiao, ghiChuBanGiao)
VALUES
    (1, 3, N'601', N'Máy sấy tóc', 800000.00, DATEADD(MONTH, -10, CAST(@demoNow AS date)), 1, 300000.00,
     @demoNow, N'Trung bình', N'Đang mở', N'Chờ lễ tân xác nhận bồi thường khi khách trả phòng.'),
    (2, NULL, N'702', N'Điều hòa', 22000000.00, DATEADD(MONTH, -20, @demoToday), 1, 0.00,
     @demoNow, N'Cao', N'Đã tiếp nhận', N'Sự cố chặn bàn giao phòng; kỹ thuật đang xử lý.');
SET IDENTITY_INSERT SuCoThietBi OFF;

SET IDENTITY_INSERT BienDongKhoDichVu ON;
INSERT INTO BienDongKhoDichVu
    (maBienDongKhoDichVu, maDichVu, loai, soLuong, maNguoiThucHien, thoiDiemPhatSinh, lyDo)
VALUES
    (1, N'BREAKFAST', N'Nhập kho', 20, N'KITCHEN', DATEADD(DAY, -3, @demoNow), N'Nhập nguyên liệu bữa sáng demo'),
    (2, N'BREAKFAST', N'Xuất kho', 2, N'KITCHEN', DATEADD(DAY, -1, @demoNow), N'Phục vụ booking DEMO-RES-001'),
    (3, N'SPAMASS', N'Nhập kho', 10, N'KITCHEN', DATEADD(DAY, -4, @demoNow), N'Nhập dầu massage demo'),
    (4, N'SPAFACIAL', N'Xuất kho', 1, N'KITCHEN', DATEADD(DAY, -3, @demoNow), N'Phục vụ booking DEMO-RES-004'),
    (5, N'DECOR', N'Hao hụt', 1, N'KITCHEN', DATEADD(DAY, -2, @demoNow), N'Hao hụt vật tư trang trí');
SET IDENTITY_INSERT BienDongKhoDichVu OFF;

-- Số tồn sau các giao dịch bên trên = số đầu kỳ + nhập - xuất/hao hụt.
-- Giữ số dư khớp sổ biến động, không ghi đè bằng lượng tồn giả.
UPDATE DichVu
SET soLuongTonKho = CASE maDichVu
    WHEN N'BREAKFAST' THEN 48 -- 30 + 20 nhập - 2 xuất
    WHEN N'SPAMASS' THEN 28 -- 18 + 10 nhập
    WHEN N'SPAFACIAL' THEN 15 -- 16 - 1 xuất
    WHEN N'DECOR' THEN 7 -- 8 - 1 hao hụt
    ELSE soLuongTonKho
END;

SET IDENTITY_INSERT BanGiaoTienCa ON;
INSERT INTO BanGiaoTienCa
    (maBanGiaoTienCa, maCa, nguoiBanGiao, nguoiNhanBanGiao, soTienDuKien, soTienThucTe, thoiDiemBanGiao, ghiChu)
VALUES
    (1, @demoShift, N'FRONTDESK', N'ACCOUNTING', 1000000.00, 1000000.00, @demoNow, N'Đối soát tiền mặt đã thu một phần hóa đơn 3.'),
    (2, @demoShift, N'FRONTDESK', N'ACCOUNTING', 1200000.00, 1200000.00, DATEADD(DAY, -1, @demoNow), N'Đối soát tiền mặt cọc booking 1.');
SET IDENTITY_INSERT BanGiaoTienCa OFF;

SET IDENTITY_INSERT KhoanChi ON;
INSERT INTO KhoanChi
    (maKhoanChi, danhMuc, moTa, soTien, nguoiChiTra, thoiDiemChiTra, trangThai)
VALUES
    (1, N'Vệ sinh', N'Mua hóa chất và vật tư buồng phòng tháng này', 2350000.00, N'ACCOUNTING', DATEADD(DAY, -2, @demoNow), N'Đã phê duyệt'),
    (2, N'Bảo trì', N'Thay linh kiện điều hòa phòng 702', 4800000.00, N'ACCOUNTING', DATEADD(DAY, -1, @demoNow), N'Đã ghi nhận'),
    (3, N'Marketing', N'In tài liệu giới thiệu dịch vụ MaM Hotel', 1250000.00, N'ACCOUNTING', DATEADD(DAY, -4, @demoNow), N'Đã phê duyệt');
SET IDENTITY_INSERT KhoanChi OFF;
-- Chứng từ mẫu thanh toán bằng ngân hàng; không tự trừ vào két tiền mặt.
UPDATE KhoanChi SET phuongThucThanhToan=N'Chuyển khoản ngân hàng';

SET IDENTITY_INSERT CongNoDoiTac ON;
INSERT INTO CongNoDoiTac
    (maCongNoDoiTac, tenDoiTac, maThamChieu, soTien, soTienDaThanhToan, trangThai, thoiDiemGhiNhan)
VALUES
    (1, N'Nhà cung cấp thực phẩm MaM', N'DEMO-SUPPLIER-FNB-09', 53000000.00, 0.00, N'Chưa thanh toán', @demoNow),
    (2, N'Nhà cung cấp vật tư spa MaM', N'DEMO-SUPPLIER-SPA-09', 73000000.00, 12000000.00, N'Đã thanh toán một phần', DATEADD(DAY, -2, @demoNow));
SET IDENTITY_INSERT CongNoDoiTac OFF;

SET IDENTITY_INSERT ThanhToanCongNoDoiTac ON;
INSERT INTO ThanhToanCongNoDoiTac
    (maThanhToanCongNo, maCongNoDoiTac, soTien, nguoiThanhToan, thoiDiemThanhToan, ghiChu)
VALUES
    (1, 2, 12000000.00, N'ACCOUNTING', DATEADD(DAY, -1, @demoNow), N'Đã thanh toán nhà cung cấp đợt 1.');
SET IDENTITY_INSERT ThanhToanCongNoDoiTac OFF;
UPDATE ThanhToanCongNoDoiTac SET phuongThucThanhToan=N'Chuyển khoản ngân hàng';

SET IDENTITY_INSERT ButToanTaiChinh ON;
INSERT INTO ButToanTaiChinh
    (maButToanTaiChinh, loaiButToan, loaiNguon, maNguon, chieuButToan, soTien, maNguoiThucHien, thoiDiemPhatSinh, ghiChu, daChotSo)
VALUES
    (1, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'1', N'Ghi nợ', 1200000.00, N'FRONTDESK', DATEADD(DAY, -1, @demoNow), N'Thu cọc booking demo.', 1),
    (2, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'4', N'Ghi nợ', 2610000.00, N'ACCOUNTING', DATEADD(DAY, -2, @demoNow), N'Thu phần còn lại hóa đơn demo.', 1),
    (3, N'EXPENSE_RECORDED', N'EXPENSE', N'1', N'Ghi có', 2350000.00, N'ACCOUNTING', DATEADD(DAY, -2, @demoNow), N'Chi vật tư vệ sinh demo.', 1),
    (4, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'2', N'Ghi nợ', 1000000.00, N'FRONTDESK', DATEADD(HOUR, -1, @demoNow), N'Thu một phần hóa đơn 3.', 1),
    (5, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'3', N'Ghi nợ', 1800000.00, N'FRONTDESK', DATEADD(DAY, -5, @demoNow), N'Thu cọc booking 4.', 1),
    (6, N'PAYMENT_RECEIVED', N'PAYMENT_TRANSACTION', N'5', N'Ghi nợ', 3900000.00, N'FRONTDESK', @demoNow, N'Thu cọc VNPay demo booking 6.', 1),
    (7, N'EXPENSE_RECORDED', N'EXPENSE', N'2', N'Ghi có', 4800000.00, N'ACCOUNTING', DATEADD(DAY, -1, @demoNow), N'Chi sửa điều hòa demo.', 1),
    (8, N'EXPENSE_RECORDED', N'EXPENSE', N'3', N'Ghi có', 1250000.00, N'ACCOUNTING', DATEADD(DAY, -4, @demoNow), N'Chi marketing demo.', 1);

-- Booking đã checkout ghi nhận doanh thu tại thời điểm trả phòng, trên tổng sau
-- giảm giá (không trừ tiền cọc/tiền đã thu). Cùng nguyên tắc với luồng checkout.
INSERT INTO ButToanTaiChinh
    (maButToanTaiChinh, loaiButToan, loaiNguon, maNguon, chieuButToan, soTien, maNguoiThucHien, thoiDiemPhatSinh, ghiChu, daChotSo)
SELECT 8 + ROW_NUMBER() OVER (ORDER BY h.maHoaDon), N'REVENUE_RECOGNIZED', N'INVOICE',
    CONVERT(NVARCHAR(100), h.maHoaDon), N'Ghi có', amount.total,
    N'FRONTDESK', b.thoiDiemTraPhongThucTe, N'CHECKOUT', 1
FROM HoaDon h JOIN PhieuDatPhong b ON b.maPhieuDatPhong = h.maPhieuDatPhong
CROSS APPLY (SELECT ROUND((h.tongTienPhong + h.tongTienDichVu + h.tienPhuThu + h.tienBoiThuong
    + h.phiGiaHan + h.tongTienDieuChinh - h.tienGiamGia) / 1000.0, 0) * 1000 AS total) amount
WHERE b.trangThai = N'Đã trả phòng' AND b.thoiDiemTraPhongThucTe IS NOT NULL AND amount.total > 0;
SET IDENTITY_INSERT ButToanTaiChinh OFF;


SET IDENTITY_INSERT LichSuHangThanhVien ON;
INSERT INTO LichSuHangThanhVien
    (maLichSuHangThanhVien, maKhachLuuTru, hangCu, hangMoi, lyDo, thoiDiemThayDoi)
VALUES
    (1, 2, N'Tiêu chuẩn', N'Bạch kim', N'Đã đủ 50 lượt lưu trú hoàn tất trước kỳ demo.', DATEADD(DAY, -30, @demoNow));
SET IDENTITY_INSERT LichSuHangThanhVien OFF;

SET IDENTITY_INSERT YeuCauPheDuyet ON;
INSERT INTO YeuCauPheDuyet
    (maYeuCauPheDuyet, nguoiYeuCau, hanhDong, maDoiTuong, duLieuThayDoi, dauVanTayDuLieu, soTien, khoaLienKet, lyDo, mucDoRuiRo, thoiDiemYeuCau, trangThai, nguoiPheDuyet, thoiDiemQuyetDinh, thoiDiemHetHan, thoiDiemSuDung)
VALUES
    (1, N'KITCHEN', N'Thay đổi giá dịch vụ', N'SPAMASS',
     N'{"maDichVu":"SPAMASS","gia":1100000,"lyDo":"Giá mùa cao điểm"}',
     CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(MAX), N'{"maDichVu":"SPAMASS","gia":1100000,"lyDo":"Giá mùa cao điểm"}')), 2),
     1100000.00, N'DEMO-APP-001', N'Điều chỉnh giá massage mùa cao điểm.', N'Trung bình', @demoNow, N'Chờ phê duyệt', NULL, NULL, DATEADD(DAY, 7, @demoNow), NULL),
    (2, N'ACCOUNTING', N'Điều chỉnh thanh toán', N'3',
     N'soTienChenhLech=-200000|lyDo=Khách VIP demo',
     CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(MAX), N'soTienChenhLech=-200000|lyDo=Khách VIP demo')), 2),
     200000.00, N'DEMO-APP-002', N'Giảm giá hỗ trợ khách VIP sau sự cố dịch vụ.', N'Thấp', @demoNow, N'Chờ phê duyệt', NULL, NULL, DATEADD(DAY, 7, @demoNow), NULL);
SET IDENTITY_INSERT YeuCauPheDuyet OFF;

INSERT INTO PhieuBaoTri
(maPhieuBaoTri, maPhong, loaiBaoTri, ngayDuKien, trangThai, moTa) VALUES
(N'WO001', N'702', N'Sửa điều hòa', @demoToday, N'Chưa xử lý', N'Điều hòa không làm lạnh'),
(N'WO002', N'602', N'Kiểm tra sau vệ sinh', DATEADD(DAY, -1, @demoToday), N'Đã hoàn thành', N'Kiểm tra phòng sau khi khách trả');

INSERT INTO CaLamViecNhanVien(
    maNhanVien,
    ngayLamCa,
    maCa,
    thoiDiemBatDau,
    thoiDiemKetThuc,
    trangThai,
    nguoiTao
)
SELECT
    maNhanVien,
    CAST(@demoShiftStart AS date),
    @demoShift,
    @demoShiftStart,
    DATEADD(HOUR, 8, @demoShiftStart),
    N'Đã bắt đầu',
    N'MANAGER'
FROM NhanVien
WHERE maNhanVien IN (N'FRONTDESK', N'HOUSEKEEP', N'TECHNICAL', N'ACCOUNTING', N'KITCHEN', N'MANAGER', N'HR');
SET IDENTITY_INSERT NhiemVuBuongPhong ON;
INSERT INTO NhiemVuBuongPhong
    (maNhiemVuBuongPhong, maPhong, nguoiDuocPhanCong, trangThai, daHoanThanhChecklist, coSuCoChan, ghiChu, nguoiPhanCong, thoiDiemCapNhat)
VALUES
    (1, N'502', N'HOUSEKEEP', N'Cần dọn phòng', 0, 0, N'Chuẩn bị phòng cho lượt khách tiếp theo.', N'MANAGER', @demoNow),
    (2, N'602', N'HOUSEKEEP', N'Đang thực hiện', 0, 0, N'Đã vệ sinh phòng; cần kiểm tra minibar và thiết bị.', N'MANAGER', @demoNow),
    (3, N'702', N'HOUSEKEEP', N'Chờ kỹ thuật', 1, 1, N'Đã hoàn thành vệ sinh, phát hiện điều hòa hỏng; chờ kỹ thuật xử lý.', N'MANAGER', @demoNow),
    (4, N'701', N'HOUSEKEEP', N'Đã dọn xong', 1, 0, N'Đã dọn xong, chờ quản lý kiểm tra cuối.', N'MANAGER', @demoNow),
    (5, N'802', N'HOUSEKEEP', N'Sẵn sàng', 1, 0, N'Đã nghiệm thu, sẵn sàng đón khách.', N'MANAGER', @demoNow);
SET IDENTITY_INSERT NhiemVuBuongPhong OFF;
SET IDENTITY_INSERT MauChecklistBuongPhong ON;
INSERT INTO MauChecklistBuongPhong (maMauChecklist, ten, dangHoatDong) VALUES
    (1, N'Vệ sinh phòng tiêu chuẩn', 1),
    (2, N'Kiểm tra minibar', 1),
    (3, N'Kiểm tra thiết bị phòng', 1);
SET IDENTITY_INSERT MauChecklistBuongPhong OFF;

SET IDENTITY_INSERT KetQuaChecklistBuongPhong ON;
INSERT INTO KetQuaChecklistBuongPhong
    (maKetQuaChecklist, maNhiemVuBuongPhong, hangMuc, datYeuCau, ghiChu, nguoiHoanThanh, thoiDiemHoanThanh)
VALUES
    (1, 2, N'Vệ sinh phòng tiêu chuẩn', 1, N'Đã thay ga và khăn tắm.', N'HOUSEKEEP', @demoNow),
    (2, 2, N'Kiểm tra minibar', 0, N'Chưa hoàn tất.', N'HOUSEKEEP', @demoNow),
    (3, 2, N'Kiểm tra thiết bị phòng', 0, N'Chưa hoàn tất.', N'HOUSEKEEP', @demoNow),
    (4, 3, N'Vệ sinh phòng tiêu chuẩn', 1, N'Đã vệ sinh.', N'HOUSEKEEP', @demoNow),
    (5, 3, N'Kiểm tra minibar', 1, N'Đã kiểm kê.', N'HOUSEKEEP', @demoNow),
    (6, 3, N'Kiểm tra thiết bị phòng', 1, N'Đã kiểm tra; điều hòa hỏng được ghi riêng trong phiếu sự cố.', N'HOUSEKEEP', @demoNow),
    (7, 4, N'Vệ sinh phòng tiêu chuẩn', 1, N'Đã vệ sinh.', N'HOUSEKEEP', @demoNow),
    (8, 4, N'Kiểm tra minibar', 1, N'Đủ số lượng.', N'HOUSEKEEP', @demoNow),
    (9, 4, N'Kiểm tra thiết bị phòng', 1, N'Thiết bị hoạt động bình thường.', N'HOUSEKEEP', @demoNow),
    (10, 5, N'Vệ sinh phòng tiêu chuẩn', 1, N'Đã nghiệm thu.', N'HOUSEKEEP', @demoNow),
    (11, 5, N'Kiểm tra minibar', 1, N'Đã nghiệm thu.', N'HOUSEKEEP', @demoNow),
    (12, 5, N'Kiểm tra thiết bị phòng', 1, N'Đã nghiệm thu.', N'HOUSEKEEP', @demoNow);
SET IDENTITY_INSERT KetQuaChecklistBuongPhong OFF;

SET IDENTITY_INSERT KiemTraBuongPhong ON;
INSERT INTO KiemTraBuongPhong
    (maKiemTraBuongPhong, maNhiemVuBuongPhong, loaiKiemTra, hangMuc, soLuong, tinhTrangHangMuc, ghiChu, nguoiHoanThanh, thoiDiemHoanThanh)
VALUES
    (1, 2, N'Minibar', N'Nước suối', 4, N'Bình thường', N'Đủ 4 chai.', N'HOUSEKEEP', @demoNow),
    (2, 2, N'Minibar', N'Snack', 3, N'Đã bổ sung', N'Đã bổ sung đủ 3 gói.', N'HOUSEKEEP', @demoNow),
    (3, 3, N'Tài sản phòng', N'Điều hòa', 1, N'Hư hỏng', N'Không làm lạnh, đã tạo phiếu kỹ thuật.', N'HOUSEKEEP', @demoNow),
    (4, 4, N'Tài sản phòng', N'Không có', 0, N'Bình thường', N'Không phát hiện đồ thất lạc.', N'HOUSEKEEP', @demoNow);
SET IDENTITY_INSERT KiemTraBuongPhong OFF;

INSERT INTO PhieuCongViecKyThuat
    (maPhong, maThietBiPhong, nguoiDuocPhanCong, doUuTien, thoiHanSla, vatTuSuDung, ghiChuKetQua, ghiChuNghiemThu, nguoiNghiemThu, thoiDiemNghiemThu, trangThai, nguoiTao, thoiDiemTao, thoiDiemCapNhat)
VALUES
    (N'702', (SELECT TOP 1 maThietBiPhong FROM ThietBiPhong WHERE maPhong = N'702' AND ten = N'Điều hòa' ORDER BY maThietBiPhong), N'TECHNICAL', N'Cao', DATEADD(HOUR, 4, @demoNow), N'Kiểm tra điều hòa không làm lạnh', NULL, NULL, NULL, NULL, N'Đang thực hiện', N'TECHNICAL', @demoNow, @demoNow);
-- =============================================================================
-- 5. Bổ sung đối soát OTA, hóa đơn VAT, nhân sự, tồn kho và tài sản.
-- =============================================================================
UPDATE PhieuDatPhong
SET nguonDatPhong = N'AGODA',
    doanhThuGopOta = 2400000.00,
    hoaHongOta = 360000.00,
    trangThaiDoiSoatOta = N'Chờ đối soát'
WHERE maPhieuDatPhong = 1;
UPDATE PhieuDatPhong
SET nguonDatPhong = N'BOOKING_COM',
    doanhThuGopOta = 2400000.00,
    hoaHongOta = 360000.00,
    trangThaiDoiSoatOta = N'Đã khớp'
WHERE maPhieuDatPhong = 3;
UPDATE PhieuDatPhong
SET nguonDatPhong = N'EXPEDIA',
    doanhThuGopOta = 3600000.00,
    hoaHongOta = 540000.00,
    trangThaiDoiSoatOta = N'Có tranh chấp'
WHERE maPhieuDatPhong = 4;

SET IDENTITY_INSERT HoaDonGiaTriGiaTang ON;
INSERT INTO HoaDonGiaTriGiaTang
    (maHoaDonGiaTriGiaTang, maHoaDon, soHoaDonGiaTriGiaTang, thueSuat, soTienChiuThue, loaiKhachHang, tenKhachHang, maSoThue, tenCongTy, diaChiCongTy, trangThai, trangThaiXml, nguoiTao)
VALUES
    (1, 1, N'VAT-DEMO-0001', 8.00, 3380000.00, N'Cá nhân', N'Nguyễn Văn An', NULL, NULL, NULL, N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING'),
    (2, 3, N'VAT-DEMO-0002', 8.00, 2700000.00, N'Cá nhân', N'Lê Hoàng Cường', NULL, NULL, NULL, N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING'),
    (3, 4, N'VAT-DEMO-0003', 8.00, 4410000.00, N'Cá nhân', N'Trần Thị Bình', NULL, NULL, NULL, N'Đã phát hành', N'Chưa xuất', N'ACCOUNTING');
SET IDENTITY_INSERT HoaDonGiaTriGiaTang OFF;
-- Giá demo đã gồm VAT; tiền cọc và các lần thu không giảm cơ sở tính thuế.
UPDATE vat SET soTienChiuThue=ROUND(GREATEST(ROUND((hoaDon.tongTienPhong+hoaDon.tongTienDichVu
    +hoaDon.tienPhuThu+hoaDon.tienBoiThuong+hoaDon.phiGiaHan+hoaDon.tongTienDieuChinh-hoaDon.tienGiamGia)/1000.0,0)*1000,0)/1.08,2)
FROM HoaDonGiaTriGiaTang vat JOIN HoaDon hoaDon ON hoaDon.maHoaDon=vat.maHoaDon;

SET IDENTITY_INSERT ChamCong ON;
INSERT INTO ChamCong
    (maChamCong, maNhanVien, ngayLamViec, thoiDiemVaoCa, thoiDiemRaCa, trangThai, nguonDuLieu, maSuKienThietBi, ghiChu, nguoiNhap)
SELECT ROW_NUMBER() OVER (ORDER BY maNhanVien), maNhanVien, ngayLamCa,
    DATEADD(MINUTE, -2, thoiDiemBatDau), NULL, N'Có mặt', N'Nhập thủ công', NULL,
    N'Đã vào ca demo hiện tại, chưa kết thúc ca.', N'HR'
FROM CaLamViecNhanVien;
SET IDENTITY_INSERT ChamCong OFF;

SET IDENTITY_INSERT DonNghiPhep ON;
INSERT INTO DonNghiPhep
    (maDonNghiPhep, maNhanVien, loaiNghiPhep, ngayBatDau, ngayKetThuc, lyDo, trangThai, nguoiYeuCau, nguoiPheDuyet, thoiDiemQuyetDinh)
VALUES
    (1, N'HOUSEKEEP', N'Nghỉ phép năm', DATEADD(DAY, 3, CAST(@demoNow AS date)), DATEADD(DAY, 3, CAST(@demoNow AS date)), N'Giải quyết việc gia đình.', N'Chờ phê duyệt', N'HOUSEKEEP', NULL, NULL),
    (2, N'FRONTDESK', N'Nghỉ ốm', DATEADD(DAY, -2, CAST(@demoNow AS date)), DATEADD(DAY, -1, CAST(@demoNow AS date)), N'Nghỉ ốm có giấy xác nhận.', N'Đã phê duyệt', N'FRONTDESK', N'MANAGER', DATEADD(DAY, -1, @demoNow)),
    (3, N'KITCHEN', N'Đổi ca trực', DATEADD(DAY, 5, CAST(@demoNow AS date)), DATEADD(DAY, 5, CAST(@demoNow AS date)), N'Đổi ca với đồng nghiệp.', N'Chờ phê duyệt', N'KITCHEN', NULL, NULL);
SET IDENTITY_INSERT DonNghiPhep OFF;

-- Hàng vật tư và đồ vải thuộc cùng danh mục kho, không giữ tồn riêng theo nhân viên.
INSERT INTO DichVu(maDichVu,ten,danhMuc,donViTinh,gia,soLuongTonKho,nguongAnToan,dangHoatDong,laTaiNguyen)
VALUES
 (N'LINENKING',N'Ga trải giường King',N'Vật dụng phòng',N'bộ',0,135,45,0,0),
 (N'LINENTWIN',N'Ga trải giường Twin',N'Vật dụng phòng',N'bộ',0,110,40,0,0),
 (N'PILLOW',N'Vỏ gối sạch',N'Vật dụng phòng',N'cái',0,180,60,0,0),
 (N'TOWELCLEAN',N'Khăn tắm lớn sạch luân chuyển',N'Vật dụng phòng',N'cái',0,160,60,0,0),
 (N'TOWELSMALL',N'Khăn tắm nhỏ sạch',N'Vật dụng phòng',N'cái',0,180,60,0,0),
 (N'WATER330',N'Nước suối minibar 330 ml',N'Thức uống',N'chai',12000,18,80,0,0);

INSERT INTO TaiSanKyThuat
    (maTaiSanKyThuat, ten, danhMuc, loaiViTri, maPhong, tang, viTri, thuongHieuMau, ngayLapDat, ngayBaoTriTiepTheo, trangThai, giaTriBanDau, ghiChu)
VALUES
    (N'AST-HVAC-001', N'Hệ thống điều hòa Chiller trung tâm', N'HVAC', N'Tòa nhà', NULL, 20, N'Tầng kỹ thuật mái', N'Daikin Modular 120RT', N'2023-01-15', DATEADD(DAY, 25, CAST(@demoNow AS date)), N'Tốt', 650000000.00, N'Tài sản tòa nhà'),
    (N'AST-GEN-001', N'Máy phát điện dự phòng 500kVA', N'Hệ thống điện', N'Tòa nhà', NULL, -2, N'Phòng kỹ thuật B2', N'Cummins PowerTech', N'2022-11-10', DATEADD(DAY, 10, CAST(@demoNow AS date)), N'Cần bảo trì', 480000000.00, N'Tài sản tòa nhà'),
    (N'AST-ELEV-001', N'Thang máy khách số 1', N'Thang máy', N'Tòa nhà', NULL, 0, N'Sảnh chính cánh Bắc', N'Mitsubishi NexWay 1000kg', N'2023-03-20', DATEADD(DAY, 60, CAST(@demoNow AS date)), N'Tốt', 520000000.00, N'Tài sản tòa nhà'),
    (N'AST-POOL-001', N'Hệ thống lọc hồ bơi', N'Hồ bơi', N'Tòa nhà', NULL, 21, N'Khu kỹ thuật hồ bơi', N'Emaux Commercial SB20', N'2023-04-15', DATEADD(DAY, 8, CAST(@demoNow AS date)), N'Tốt', 95000000.00, N'Tài sản tầng 21'),
    (N'AST-501-TV', N'TV 4K phòng 501', N'Thiết bị phòng', N'Phòng', N'501', 5, N'Phòng 501', N'Samsung 55 inch', DATEADD(MONTH, -12, CAST(@demoNow AS date)), DATEADD(DAY, 120, CAST(@demoNow AS date)), N'Tốt', 12000000.00, N'Liên kết tài sản phòng');

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
    WHEN N'STD' THEN N'Phòng Classic'
    WHEN N'SUP' THEN N'Phòng Superior'
    WHEN N'DLX' THEN N'Phòng Deluxe'
    WHEN N'SUT' THEN N'Suite Hoàng Gia'
    WHEN N'VIP' THEN N'Penthouse Tổng Thống'
END,
    moTaQuangBa = CASE maLoaiPhong
        WHEN N'RT001' THEN N'Phòng Classic Queen kết hợp ánh sáng tự nhiên, giường Queen êm ái và nội thất thanh lịch, mang đến không gian lưu trú tinh tế cho từng chuyến đi.'
        WHEN N'RT002' THEN N'Phòng Classic Twin với hai giường đơn, bố cục gọn gàng và tiện nghi chỉn chu, phù hợp cho những chuyến lưu trú cùng gia đình hoặc bạn bè.'
        WHEN N'RT003' THEN N'Phòng Superior King mang đến không gian thoáng đãng, giường King và nội thất được chọn lọc cho những phút giây nghỉ ngơi thư thái.'
        WHEN N'RT004' THEN N'Phòng Superior Hai Giường Queen kết hợp không gian rộng rãi, hai giường Queen và tầm nhìn thành phố, đáp ứng nhu cầu lưu trú thoải mái của gia đình hoặc nhóm bạn.'
        WHEN N'RT005' THEN N'Phòng Deluxe King nổi bật với giường King, diện tích rộng và tầm nhìn biển Vũng Tàu, tạo nên trải nghiệm lưu trú sang trọng tại MaM Hotel.'
        WHEN N'RT006' THEN N'Phòng Deluxe Family có hai giường Queen cùng khu vực sofa, mở ra không gian thư giãn và quây quần thoải mái dành cho gia đình.'
        WHEN N'RT007' THEN N'Suite Hoàng Gia Residence sở hữu phòng khách riêng và khu ngủ với giường King, kết hợp sự riêng tư cùng phong cách sống thượng lưu trên tầng cao.'
        WHEN N'RT008' THEN N'Suite Hoàng Gia Executive mang đến phòng khách biệt lập, ban công riêng và nội thất thanh lịch, dành cho những chuyến lưu trú đòi hỏi sự thoải mái và riêng tư.'
        WHEN N'RT009' THEN N'Penthouse Tổng Thống là không gian lưu trú tầng cao với phòng khách riêng, khu ngủ sang trọng và tầm nhìn toàn cảnh thành phố, dành cho tối đa 8 khách.'
    END
WHERE maLoaiPhong IN (N'RT001', N'RT002', N'RT003', N'RT004', N'RT005', N'RT006', N'RT007', N'RT008', N'RT009');

-- =============================================================================
-- 6. Thay gallery cuối cùng theo từng phòng và cập nhật nội dung quảng bá.
-- =============================================================================
-- Chuẩn hóa toàn bộ ảnh phòng khách sạn theo đúng thứ hạng (STD, SUP, DLX, SUT, VIP)
-- Chỉ dùng ảnh phòng ngủ và nội thất phù hợp với khách sạn cao cấp.
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
    WHEN N'1704' THEN N'Penthouse Tổng Thống 1704 tại tầng 17 mang đến phòng khách riêng, khu ngủ sang trọng và tầm nhìn thành phố, tạo nên không gian lưu trú riêng tư cho tối đa 8 khách.'
    WHEN N'1804' THEN N'Penthouse Tổng Thống 1804 tại tầng 18 kết hợp phòng khách tách biệt, giường King và không gian thư giãn thanh lịch dành cho gia đình hoặc nhóm bạn, tối đa 8 khách.'
    WHEN N'1904' THEN N'Penthouse Tổng Thống 1904 tại tầng 19 sở hữu phòng khách riêng và khu ngủ cao cấp với tầm nhìn toàn cảnh thành phố, dành cho tối đa 8 khách tận hưởng phong cách lưu trú thượng lưu.'
    WHEN N'2004' THEN N'Penthouse Tổng Thống 2004 tại tầng 20 là không gian lưu trú ở tầng cao nhất của MaM Hotel, với phòng khách riêng, khu ngủ sang trọng và sức chứa tối đa 8 khách.'
    ELSE moTa
END
WHERE maLoaiPhong = N'RT009';

-- =============================================================================
-- 6. Kiểm tra dữ liệu trước COMMIT; sai liên kết thì toàn bộ reset bị rollback.
-- =============================================================================
IF EXISTS (
    SELECT 1 FROM KetQuaChecklistBuongPhong k
    WHERE NOT EXISTS (SELECT 1 FROM MauChecklistBuongPhong m
        WHERE m.dangHoatDong = 1 AND m.ten COLLATE Latin1_General_100_BIN2 = k.hangMuc COLLATE Latin1_General_100_BIN2)
)
    THROW 51001, N'Dữ liệu demo: kết quả checklist không khớp danh mục đang hoạt động.', 1;

IF EXISTS (
    SELECT 1 FROM NhiemVuBuongPhong n
    WHERE n.daHoanThanhChecklist <> CASE WHEN EXISTS (
        SELECT 1 FROM MauChecklistBuongPhong m
        OUTER APPLY (SELECT TOP (1) k.datYeuCau FROM KetQuaChecklistBuongPhong k
            WHERE k.maNhiemVuBuongPhong = n.maNhiemVuBuongPhong
                AND k.hangMuc COLLATE Latin1_General_100_BIN2 = m.ten COLLATE Latin1_General_100_BIN2
            ORDER BY k.maKetQuaChecklist DESC) latest
        WHERE m.dangHoatDong = 1 AND ISNULL(latest.datYeuCau, 0) = 0
    ) THEN 0 ELSE 1 END
)
    THROW 51002, N'Dữ liệu demo: cờ hoàn thành checklist không khớp kết quả.', 1;

IF EXISTS (
    SELECT 1 FROM NhiemVuBuongPhong n JOIN Phong p ON p.maPhong = n.maPhong
    WHERE p.trangThai <> CASE n.trangThai
        WHEN N'Sẵn sàng' THEN N'Sẵn sàng'
        WHEN N'Chờ kỹ thuật' THEN N'Đang bảo trì'
        ELSE N'Đang dọn phòng' END
        OR (n.trangThai IN (N'Đã dọn xong', N'Sẵn sàng') AND (n.daHoanThanhChecklist = 0 OR n.coSuCoChan = 1))
        OR n.coSuCoChan <> CASE WHEN EXISTS (SELECT 1 FROM SuCoThietBi s
            WHERE s.maPhong = n.maPhong AND s.mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                AND s.trangThaiBanGiao <> N'Đã xử lý') THEN 1 ELSE 0 END
)
    THROW 51003, N'Dữ liệu demo: trạng thái phòng, nhiệm vụ hoặc sự cố không khớp.', 1;

IF EXISTS (
    SELECT 1 FROM ChiTietDatPhong c JOIN PhieuDatPhong b ON b.maPhieuDatPhong = c.maPhieuDatPhong
    JOIN Phong p ON p.maPhong = c.maPhong
    WHERE c.trangThai = N'Đang có khách' AND (b.trangThai <> N'Đã nhận phòng' OR p.trangThai <> N'Đang có khách')
)
    THROW 51004, N'Dữ liệu demo: phòng đang có khách không khớp booking.', 1;

IF EXISTS (
    SELECT 1 FROM ChiTietDatPhong a JOIN ChiTietDatPhong b ON a.maPhong = b.maPhong
        AND a.maPhieuDatPhong < b.maPhieuDatPhong
        AND a.thoiDiemNhanPhong < b.thoiDiemTraPhong AND b.thoiDiemNhanPhong < a.thoiDiemTraPhong
    WHERE a.trangThai IN (N'Đã giữ phòng', N'Đang có khách') AND b.trangThai IN (N'Đã giữ phòng', N'Đang có khách')
)
    THROW 51005, N'Dữ liệu demo: booking bị chồng thời gian.', 1;

IF EXISTS (
    SELECT 1 FROM HoaDon h
    OUTER APPLY (SELECT SUM(CASE WHEN g.loai = N'Hoàn tiền' THEN -g.soTien ELSE g.soTien END) paid
        FROM GiaoDichThanhToan g WHERE g.maHoaDon = h.maHoaDon AND g.trangThai = N'Đã hoàn tất') payments
    WHERE h.soTienPhaiTra <> h.tongTienPhong + h.tongTienDichVu + h.tienPhuThu + h.tienBoiThuong
        + h.phiGiaHan + h.tongTienDieuChinh - h.tienGiamGia - ISNULL(payments.paid, 0)
)
    THROW 51006, N'Dữ liệu demo: số tiền hóa đơn không khớp sổ thanh toán.', 1;

IF EXISTS (
    SELECT 1 FROM HoaDon h JOIN PhieuDatPhong b ON b.maPhieuDatPhong = h.maPhieuDatPhong
    OUTER APPLY (SELECT COUNT(*) entries, SUM(t.soTien) amount FROM ButToanTaiChinh t
        WHERE t.loaiButToan = N'REVENUE_RECOGNIZED' AND t.loaiNguon = N'INVOICE'
            AND t.maNguon = CONVERT(NVARCHAR(100), h.maHoaDon) AND t.chieuButToan = N'Ghi có' AND t.daChotSo = 1) revenue
    WHERE b.trangThai = N'Đã trả phòng'
        AND h.tongTienPhong + h.tongTienDichVu + h.tienPhuThu + h.tienBoiThuong
            + h.phiGiaHan + h.tongTienDieuChinh - h.tienGiamGia > 0
        AND (b.thoiDiemTraPhongThucTe IS NULL OR revenue.entries <> 1
        OR revenue.amount <> ROUND((h.tongTienPhong + h.tongTienDichVu + h.tienPhuThu + h.tienBoiThuong
            + h.phiGiaHan + h.tongTienDieuChinh - h.tienGiamGia) / 1000.0, 0) * 1000)
)
    THROW 51007, N'Dữ liệu demo: doanh thu checkout chưa khớp hóa đơn sau giảm giá.', 1;

-- Cấu hình demo: một lượt chiếm một tài nguyên trong thời lượng của dịch vụ.
UPDATE DichVu SET laTaiNguyen=CASE WHEN danhMuc IN(N'Món ăn',N'Thức uống',N'Vật dụng phòng')
 OR maDichVu IN(N'BREAKFAST',N'MAMREST',N'MINIBAR',N'DECOR') THEN 0 ELSE 1 END,
 thoiLuongPhut=CASE WHEN maDichVu IN(N'TENNIS',N'BADMINTON',N'PINGPONG',N'MEETING',N'BOARDROOM',N'LIMO') THEN 120
 WHEN maDichVu=N'SPAFACIAL' THEN 75 WHEN maDichVu=N'LNDRYEXP' THEN 240 WHEN maDichVu=N'LNDRYSTD' THEN 600 ELSE 60 END;
UPDATE DichVu SET soLuongTonKho=CASE maDichVu WHEN N'MEETING' THEN 2 WHEN N'BOARDROOM' THEN 1
 WHEN N'TENNIS' THEN 2 WHEN N'BADMINTON' THEN 2 WHEN N'PINGPONG' THEN 2 WHEN N'LIMO' THEN 3
 WHEN N'LNDRYEXP' THEN 40 WHEN N'LNDRYSTD' THEN 40 ELSE soLuongTonKho END
WHERE laTaiNguyen=1;
UPDATE DichVu SET donViTinh=N'lượt',gia=CASE WHEN maDichVu=N'TENNIS' THEN 400000
 WHEN maDichVu=N'BADMINTON' THEN 300000 WHEN maDichVu=N'PINGPONG' THEN 200000 ELSE gia END
WHERE maDichVu IN(N'TENNIS',N'BADMINTON',N'PINGPONG',N'MEETING',N'BOARDROOM');
UPDATE b SET thoiDiemKetThuc=DATEADD(MINUTE,d.thoiLuongPhut,b.thoiDiemDuKien)
FROM DatDichVuKhachSan b JOIN DichVu d ON d.maDichVu=b.maDichVu;
INSERT YeuCauKho(maDichVu,loai,soLuong,nguoiGui,lyDo,khoaChongTrung,ngayGui)
VALUES(N'WATER330',N'Cấp hàng',24,N'HOUSEKEEP',N'Bổ sung nước minibar cho ca hiện tại',N'demo-supply',@demoNow),
 (N'PILLOW',N'Trả hàng',3,N'HOUSEKEEP',N'Vỏ gối sạch còn nguyên chưa sử dụng',N'demo-return',@demoNow),
 (N'TOWELCLEAN',N'Báo hỏng',2,N'HOUSEKEEP',N'Khăn rách, báo Kho kiểm tra',N'demo-damage',@demoNow);

UPDATE DichVu SET donViTaiNguyen=CASE WHEN maDichVu IN(N'TENNIS',N'BADMINTON') THEN N'sân' WHEN maDichVu=N'PINGPONG' THEN N'bàn' WHEN maDichVu IN(N'MEETING',N'BOARDROOM') THEN N'phòng' WHEN maDichVu IN(N'LNDRYEXP',N'LNDRYSTD',N'PRESSING') THEN N'máy' WHEN maDichVu IN(N'LIMO',N'CITYTOUR') THEN N'xe' WHEN maDichVu=N'EXTRABED' THEN N'giường' ELSE N'chỗ' END WHERE laTaiNguyen=1;

-- Giặt nhanh và giặt tiêu chuẩn dùng chung 40 máy; thời lượng từng gói riêng.
UPDATE dbo.DichVu SET maNguonTaiNguyen=N'LNDRYSTD' WHERE maDichVu=N'LNDRYEXP';


-- Dữ liệu minh họa lượt đang dùng, giữ chỗ và đã hủy nhưng không hoàn tiền.
-- Đi qua đúng các lệnh nghiệp vụ để hóa đơn, biên lai và ledger khớp nhau.
DECLARE @serviceDemoReservation BIGINT,@serviceDemoCustomer BIGINT,@serviceDemoRoom NVARCHAR(10);
SELECT TOP(1) @serviceDemoReservation=p.maPhieuDatPhong,@serviceDemoCustomer=p.maTaiKhoanKhachHang,@serviceDemoRoom=c.maPhong
FROM PhieuDatPhong p JOIN ChiTietDatPhong c ON c.maPhieuDatPhong=p.maPhieuDatPhong
JOIN HoaDon h ON h.maPhieuDatPhong=p.maPhieuDatPhong
WHERE p.trangThai=N'Đã nhận phòng' AND p.maTaiKhoanKhachHang IS NOT NULL
 AND c.thoiDiemNhanPhong<DATEADD(HOUR,-1,@demoNow) AND c.thoiDiemTraPhong>DATEADD(HOUR,12,@demoNow)
ORDER BY p.maPhieuDatPhong;
IF @serviceDemoReservation IS NOT NULL
BEGIN
 DECLARE @serviceDemoCreated DATETIME2(6)=DATEADD(MINUTE,-20,@demoNow),
  @serviceDemoStart DATETIME2(6)=DATEADD(MINUTE,-15,@demoNow),@serviceDemoPaid DATETIME2(6)=DATEADD(MINUTE,-19,@demoNow),
  @serviceDemoActor NVARCHAR(50)=N'customer:'+CONVERT(NVARCHAR(20),@serviceDemoCustomer),
  @serviceDemoId BIGINT,@serviceDemoMerchant NVARCHAR(100),@serviceDemoAmount DECIMAL(12,2);
 EXEC dbo.uspDatDichVuKhachSan @serviceDemoReservation,@serviceDemoRoom,N'TENNIS',@serviceDemoStart,1,NULL,
  N'Demo: sân đang sử dụng',N'demo-service-active',N'demo-active',@serviceDemoActor,@serviceDemoCustomer,0,@serviceDemoCreated;
 SELECT @serviceDemoId=maDatDichVuKhachSan,@serviceDemoAmount=donGia*(soLuong-soLuongMienPhi) FROM DatDichVuKhachSan WHERE khoaYeuCau=N'demo-service-active';
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,@serviceDemoCustomer,NULL,NULL,NULL,NULL,0,@serviceDemoCreated;
 SET @serviceDemoMerchant=N'SVC-'+CONVERT(NVARCHAR(20),@serviceDemoId);
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,NULL,@serviceDemoMerchant,@serviceDemoAmount,N'DEMO-TENNIS-PAID',N'00',1,@serviceDemoPaid;
 EXEC dbo.uspXacNhanSuDungDichVu @serviceDemoId,N'KITCHEN',@demoNow,@serviceDemoReservation;

 EXEC dbo.uspDatDichVuKhachSan @serviceDemoReservation,@serviceDemoRoom,N'LNDRYEXP',@serviceDemoStart,2,NULL,
  N'Demo: một lượt giặt 2 món chiếm một máy',N'demo-laundry-active',N'demo-laundry',@serviceDemoActor,@serviceDemoCustomer,0,@serviceDemoCreated;
 SELECT @serviceDemoId=maDatDichVuKhachSan,@serviceDemoAmount=donGia*(soLuong-soLuongMienPhi) FROM DatDichVuKhachSan WHERE khoaYeuCau=N'demo-laundry-active';
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,@serviceDemoCustomer,NULL,NULL,NULL,NULL,0,@serviceDemoCreated;
 SET @serviceDemoMerchant=N'SVC-'+CONVERT(NVARCHAR(20),@serviceDemoId);
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,NULL,@serviceDemoMerchant,@serviceDemoAmount,N'DEMO-LAUNDRY-PAID',N'00',1,@serviceDemoPaid;

 SET @serviceDemoStart=DATEADD(HOUR,1,@demoNow);
 EXEC dbo.uspDatDichVuKhachSan @serviceDemoReservation,@serviceDemoRoom,N'BOARDROOM',@serviceDemoStart,1,NULL,
  N'Demo: giữ chỗ chờ thanh toán 10 phút',N'demo-service-pending',N'demo-pending',@serviceDemoActor,@serviceDemoCustomer,0,@demoNow;
 EXEC dbo.uspDatDichVuKhachSan @serviceDemoReservation,@serviceDemoRoom,N'BADMINTON',@serviceDemoStart,1,NULL,
  N'Demo: khách tự hủy sau khi thanh toán',N'demo-service-cancelled',N'demo-cancel',@serviceDemoActor,@serviceDemoCustomer,0,@demoNow;
 SELECT @serviceDemoId=maDatDichVuKhachSan,@serviceDemoAmount=donGia*(soLuong-soLuongMienPhi) FROM DatDichVuKhachSan WHERE khoaYeuCau=N'demo-service-cancelled';
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,@serviceDemoCustomer,NULL,NULL,NULL,NULL,0,@demoNow;
 SET @serviceDemoMerchant=N'SVC-'+CONVERT(NVARCHAR(20),@serviceDemoId);
 EXEC dbo.uspThanhToanDichVu @serviceDemoId,NULL,@serviceDemoMerchant,@serviceDemoAmount,N'DEMO-CANCELLED-PAID',N'00',1,@demoNow;
 EXEC dbo.uspHuyDatDichVu @serviceDemoId,@serviceDemoActor,@serviceDemoCustomer;
END;

COMMIT;
