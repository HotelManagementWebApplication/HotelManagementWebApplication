-- V4__views.sql
-- Mỗi đối tượng có một định nghĩa cuối cùng; sửa trực tiếp trong file sở hữu.
-- Giữ nguyên tên, thứ tự tham số và các cột kết quả để bên gọi tiếp tục sử dụng.
-- View cung cấp dữ liệu đọc; quyền truy cập được kiểm tra tại backend.
-- Mục lục:
--   vwPhongCongKhai
--   vwDichVuCongKhai
--   vwDatPhongChiTiet
--   vwSuDungDichVuDatPhong
--   vwTaiLieuTaiChinhDatPhong
--   vwDashboardLeTan
--   vwHoaDonChiTiet
--   vwTonKhoHienTai
--   vwCongViecBuongPhong
--   vwCongViecKyThuat
--   vwLichLamViecNhanVien
--   vwDoanhThuTheoNgay
--   vwDatDichVuKhachSan
--   vwChuSoHuuDatPhong
--   vwTienNghiCongKhai
--   vwAnhPhongCongKhai
--   vwAnhLoaiPhongCongKhai
--   vwDoiSoatOta
--   vwHoaDonGiaTriGiaTang
--   vwChamCong
--   vwDonNghiPhep
--   vwTaiSanKyThuat
--   vwPhongNoiBo
--   vwSuCoLeTan
--   vwGiaoDichDoiSoat
--   vwHinhAnhPhongNoiBo
--   vwTienNghiNoiBo
--   vwTienNghiTheoLoaiPhong
--   vwBienDongKhoDichVu
--   vwTonKhoDichVu
--   vwThietBiPhong
--   vwPhieuBaoTri
--   vwPhamViNhiemVuBuongPhong
--   vwMauChecklistBuongPhong
--   vwKetQuaChecklistBuongPhong
--   vwKiemTraBuongPhong
--   vwThongBao
--   vwSuCoThietBi
--   vwNhatKyKiemSoat
--   vwYeuCauPheDuyet
--   vwBanGiaoTienCa
--   vwChiTietTienBanGiao
--   vwKhoanChi
--   vwCongNoDoiTac
--   vwThanhToanCongNoDoiTac
--   vwButToanTaiChinh
--   vwNhanVien
--   vwSuKienDangNhapNhanVien
--   vwMaLamMoiDangNhap
--   vwTaiKhoanKhachHang
--   vwKhachLuuTru
--   vwLichSuHangThanhVien
--   vwLoaiPhongNoiBo
--   vwLichSuGiaLoaiPhong
--   vwDichVuNoiBo
--   vwLichSuGiaDichVu
--   vwGiaoDichThanhToan
--   vwBienLai
--   vwSoDuTienCoc
--   vwYeuCauThanhToanVnpay
--   vwChuyenPhong

-- =============================================================================
-- vwPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwPhongCongKhai
AS
SELECT
    phong.maPhong,
    phong.ten AS tenPhong,
    phong.tang,
    phong.moTa,
    phong.trangThai,
    loaiPhong.maLoaiPhong,
    loaiPhong.ten AS tenLoaiPhong,
    loaiPhong.moTa AS moTaLoaiPhong,
    loaiPhong.giaTheoNgay,
    loaiPhong.giaTheoGio,
    loaiPhong.dienTich,
    loaiPhong.huongNhin,
    loaiPhong.loaiGiuong,
    loaiPhong.maHangPhong,
    loaiPhong.soKhachToiDa,
    loaiPhong.duongDanAnhBia,
    loaiPhong.khauHieuQuangBa,
    loaiPhong.tenQuangBa,
    loaiPhong.moTaQuangBa
FROM dbo.Phong phong
JOIN dbo.LoaiPhong loaiPhong
    ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
WHERE loaiPhong.trangThaiDanhMuc = N'Đang hoạt động';
GO

-- =============================================================================
-- vwDichVuCongKhai
-- =============================================================================
CREATE VIEW dbo.vwDichVuCongKhai
AS
SELECT
    maDichVu,
    ten,
    gia,
    donViTinh,
    danhMuc,
    moTa,
    duongDanAnh
, thoiLuongPhut,laTaiNguyen
FROM dbo.DichVu
WHERE dangHoatDong = 1;
GO

-- =============================================================================
-- vwDatPhongChiTiet
-- Mỗi dòng là một phòng trong booking, kèm hồ sơ khách và tiền phòng dự kiến.
-- Tiền dự kiến dùng giá loại phòng hiện tại; thuê giờ áp dụng tối thiểu 3 giờ.
-- =============================================================================
CREATE VIEW dbo.vwDatPhongChiTiet
AS
SELECT
    phieu.maPhieuDatPhong,
    phieu.maKhachLuuTru,
    khach.hoVaTen,
    khach.soDienThoai,
    phieu.maNhanVien,
    phieu.maTaiKhoanKhachHang,
    phieu.thoiDiemDat,
    phieu.trangThai,
    phieu.hinhThucThue,
    phieu.tienDatCoc,
    phieu.trangThaiThanhToanCoc,
    phieu.thoiDiemNhanPhongThucTe,
    phieu.thoiDiemTraPhongThucTe,
    phieu.lyDoHuy,
    phieu.ketQuaHuy,
    phieu.soPhutGiaHan,
    phieu.khoaChongTrung,
    phieu.maThanhToanDatCoc,
    phieu.thoiDiemHetHanThanhToanCoc,
    phieu.phuongThucBaoDam,
    phieu.loaiThayDoiDangCho,
    phieu.thoiDiemNhanPhongTruocThayDoi,
    phieu.thoiDiemTraPhongTruocThayDoi,
    phieu.tienDatCocTruocThayDoi,
    phieu.tienDatCocBoSung,
    phieu.emailXacNhan,
    phieu.nguonDatPhong,
    phieu.doanhThuGopOta,
    phieu.hoaHongOta,
    phieu.trangThaiDoiSoatOta,
    phieu.phienBan,
    chiTiet.maPhong,
    chiTiet.thoiDiemNhanPhong,
    chiTiet.thoiDiemTraPhong,
    chiTiet.thoiDiemTraPhongBanDau,
    chiTiet.trangThai AS trangThaiPhongTrongDatPhong,
    chiTiet.soLuongKhach,
    phong.ten AS tenPhong,
    loai.ten AS tenLoaiPhong,
    COALESCE(chiTiet.giaTheoNgayDaChot, loai.giaTheoNgay) AS giaTheoNgay,
    COALESCE(chiTiet.giaTheoGioDaChot, loai.giaTheoGio) AS giaTheoGio,
    dbo.fnTinhTongTienPhong(
        COALESCE(chiTiet.giaTheoNgayDaChot, loai.giaTheoNgay),
        COALESCE(chiTiet.giaTheoGioDaChot, loai.giaTheoGio),
        chiTiet.thoiDiemNhanPhong,
        chiTiet.thoiDiemTraPhong,
        CASE WHEN phieu.hinhThucThue = N'Theo giờ' THEN 1 ELSE 0 END,
        3
    ) AS tongTienPhongDuKien
FROM dbo.PhieuDatPhong AS phieu
INNER JOIN dbo.KhachLuuTru AS khach
    ON khach.maKhachLuuTru = phieu.maKhachLuuTru
INNER JOIN dbo.ChiTietDatPhong AS chiTiet
    ON chiTiet.maPhieuDatPhong = phieu.maPhieuDatPhong
JOIN dbo.Phong AS phong
    ON phong.maPhong = chiTiet.maPhong
JOIN dbo.LoaiPhong AS loai
    ON loai.maLoaiPhong = phong.maLoaiPhong;
GO

-- =============================================================================
-- vwSuDungDichVuDatPhong
-- Dịch vụ đã ghi nhận của booking, kèm tên dịch vụ để dựng dòng thời gian.
-- =============================================================================
CREATE VIEW dbo.vwSuDungDichVuDatPhong
AS
SELECT
    suDung.maPhieuDatPhong,
    suDung.maDichVu,
    dichVu.ten,
    suDung.ngaySuDung,
    suDung.soLuong,
    suDung.donGia
FROM dbo.SuDungDichVu AS suDung
JOIN dbo.DichVu AS dichVu
    ON dichVu.maDichVu = suDung.maDichVu;
GO

-- =============================================================================
-- vwTaiLieuTaiChinhDatPhong
-- Liên kết booking với hóa đơn, giao dịch và biên lai để dựng dòng thời gian.
-- UNION ALL giữ từng liên kết; loaiDoiTuong cho biết cách đọc maDoiTuong.
-- =============================================================================
CREATE VIEW dbo.vwTaiLieuTaiChinhDatPhong
AS
SELECT
    hoaDon.maPhieuDatPhong,
    N'INVOICE' AS loaiDoiTuong,
    hoaDon.maHoaDon AS maDoiTuong
FROM dbo.HoaDon AS hoaDon
UNION ALL
SELECT
    hoaDon.maPhieuDatPhong,
    N'PAYMENT_TRANSACTION',
    giaoDich.maGiaoDichThanhToan
FROM dbo.HoaDon AS hoaDon
JOIN dbo.GiaoDichThanhToan AS giaoDich
    ON giaoDich.maHoaDon = hoaDon.maHoaDon
UNION ALL
SELECT
    hoaDon.maPhieuDatPhong,
    N'RECEIPT',
    bienLai.maBienLai
FROM dbo.HoaDon AS hoaDon
JOIN dbo.BienLai AS bienLai
    ON bienLai.maHoaDon = hoaDon.maHoaDon;
GO

-- =============================================================================
-- vwDashboardLeTan
-- Gộp thời gian nhận/trả và hóa đơn theo booking để hiển thị dashboard lễ tân.
-- thoiDiemNhanPhongDangGiu chỉ xét chi tiết còn ở trạng thái Đã giữ phòng.
-- =============================================================================
CREATE VIEW dbo.vwDashboardLeTan
AS
SELECT
    phieu.maPhieuDatPhong,
    phieu.trangThai,
    phieu.trangThaiThanhToanCoc,
    phieu.tienDatCoc,
    khach.maKhachLuuTru,
    khach.hoVaTen,
    khach.soDienThoai,
    MIN(chiTiet.thoiDiemNhanPhong) AS thoiDiemNhanPhong,
    MAX(chiTiet.thoiDiemTraPhong) AS thoiDiemTraPhong,
    MIN(CASE
        WHEN chiTiet.trangThai = N'Đã giữ phòng' THEN chiTiet.thoiDiemNhanPhong
    END) AS thoiDiemNhanPhongDangGiu,
    hoaDon.maHoaDon,
    COALESCE(dbo.fnTinhSoDuHoaDon(hoaDon.maHoaDon), 0) AS soTienPhaiTra
FROM dbo.PhieuDatPhong phieu
JOIN dbo.KhachLuuTru khach
    ON khach.maKhachLuuTru = phieu.maKhachLuuTru
LEFT JOIN dbo.ChiTietDatPhong chiTiet
    ON chiTiet.maPhieuDatPhong = phieu.maPhieuDatPhong
LEFT JOIN dbo.HoaDon hoaDon
    ON hoaDon.maPhieuDatPhong = phieu.maPhieuDatPhong
GROUP BY phieu.maPhieuDatPhong,
    phieu.trangThai,
    phieu.trangThaiThanhToanCoc,
    phieu.tienDatCoc,
    khach.maKhachLuuTru,
    khach.hoVaTen,
    khach.soDienThoai,
    hoaDon.maHoaDon,
    hoaDon.soTienPhaiTra;
GO

-- =============================================================================
-- vwHoaDonChiTiet
-- Chi tiết hóa đơn kèm số dư cọc và số còn phải thu được tính từ giao dịch.
-- =============================================================================
CREATE VIEW dbo.vwHoaDonChiTiet
AS
SELECT
    hoaDon.maHoaDon,
    hoaDon.maPhieuDatPhong,
    hoaDon.thoiDiemPhatHanh,
    hoaDon.trangThai,
    hoaDon.phuongThucThanhToan,
    hoaDon.tongTienPhong,
    hoaDon.tongTienDichVu,
    hoaDon.tienPhuThu,
    hoaDon.tienBoiThuong,
    hoaDon.phiGiaHan,
    hoaDon.tongTienDieuChinh,
    hoaDon.tienGiamGia,
    dbo.fnSoDuTienCoc(hoaDon.maHoaDon) AS tienDatCocDaTra,
    dbo.fnTinhSoDuHoaDon(hoaDon.maHoaDon) AS soDuConLai,
    phieu.maNhanVien,
    phieu.maTaiKhoanKhachHang
FROM dbo.HoaDon AS hoaDon
JOIN dbo.PhieuDatPhong AS phieu
    ON phieu.maPhieuDatPhong = hoaDon.maPhieuDatPhong;
GO

-- =============================================================================
-- vwTonKhoHienTai
-- =============================================================================

-- =============================================================================
-- vwCongViecBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwCongViecBuongPhong
AS
SELECT
    nhiemVu.maNhiemVuBuongPhong,
    nhiemVu.maPhong,
    nhiemVu.nguoiDuocPhanCong,
    nhiemVu.trangThai,
    nhiemVu.daHoanThanhChecklist,
    nhiemVu.coSuCoChan,
    nhiemVu.ghiChu,
    nhiemVu.nguoiPhanCong,
    nhiemVu.thoiDiemCapNhat,
    phong.tang,
    phong.ten AS tenPhong
FROM dbo.NhiemVuBuongPhong AS nhiemVu
INNER JOIN dbo.Phong AS phong
    ON phong.maPhong = nhiemVu.maPhong;
GO

-- =============================================================================
-- vwCongViecKyThuat
-- =============================================================================
CREATE VIEW dbo.vwCongViecKyThuat
AS
SELECT
    maPhieuCongViecKyThuat,
    maPhong,
    maThietBiPhong,
    nguoiDuocPhanCong,
    doUuTien,
    thoiHanSla,
    vatTuSuDung,
    ghiChuKetQua,
    ghiChuNghiemThu,
    nguoiNghiemThu,
    thoiDiemNghiemThu,
    trangThai,
    nguoiTao,
    thoiDiemTao,
    thoiDiemCapNhat
FROM dbo.PhieuCongViecKyThuat;
GO

-- =============================================================================
-- vwLichLamViecNhanVien
-- =============================================================================
CREATE VIEW dbo.vwLichLamViecNhanVien
AS
SELECT
    ca.maCaLamViecNhanVien,
    ca.maNhanVien,
    nhanVien.hoVaTen,
    nhanVien.vaiTro,
    ca.ngayLamCa,
    ca.maCa,
    ca.thoiDiemBatDau,
    ca.thoiDiemKetThuc,
    ca.trangThai,
    ca.nguoiTao,
    nhanVien.duocKichHoat,
    nhanVien.trangThaiLamViec,
    nhanVien.ngayBatDauNghi,
    nhanVien.ngayKetThucNghi
FROM dbo.CaLamViecNhanVien ca
JOIN dbo.NhanVien nhanVien
    ON nhanVien.maNhanVien = ca.maNhanVien;
GO

-- =============================================================================
-- vwDoanhThuTheoNgay
-- Chỉ cộng doanh thu đã ghi nhận; thu tiền, biên lai, tiền cọc và chi phí là dòng tiền riêng.
-- =============================================================================
CREATE VIEW dbo.vwDoanhThuTheoNgay
AS
SELECT
    CAST(thoiDiemPhatSinh AS DATE) AS ngay,
    SUM(CASE
        WHEN chieuButToan = N'Ghi có' THEN soTien
        ELSE 0
    END) AS tongGhiCo,
    SUM(CASE
        WHEN chieuButToan = N'Ghi nợ' THEN soTien
        ELSE 0
    END) AS tongGhiNo,
    SUM(CASE
        WHEN chieuButToan = N'Ghi có' THEN soTien
        ELSE - soTien
    END) AS doanhThuRong
FROM dbo.ButToanTaiChinh
WHERE daChotSo = 1
    AND loaiButToan = N'REVENUE_RECOGNIZED'
GROUP BY CAST(thoiDiemPhatSinh AS DATE);
GO

-- =============================================================================
-- vwDatDichVuKhachSan
-- =============================================================================
CREATE VIEW dbo.vwDatDichVuKhachSan
AS
SELECT
    datDichVu.maDatDichVuKhachSan,
    datDichVu.maPhieuDatPhong,
    datDichVu.maPhong,
    datDichVu.maDichVu,
    COALESCE(dichVu.ten, datDichVu.maDichVu) AS tenDichVu,
    dichVu.danhMuc,
    datDichVu.thoiDiemDuKien,
    datDichVu.soLuong,
    datDichVu.soLuongMienPhi,
    datDichVu.donGia,
    datDichVu.buoiAn,
    CASE WHEN datDichVu.trangThai=N'Chờ thanh toán' AND datDichVu.hanThanhToan<=CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(6)) THEN N'Hết hạn' ELSE datDichVu.trangThai END COLLATE Vietnamese_100_CS_AS AS trangThai,
    datDichVu.ghiChu,
    datDichVu.khoaYeuCau,
    datDichVu.maBamYeuCau,
    datDichVu.nguoiTao,
    datDichVu.thoiDiemKetThuc, datDichVu.hanThanhToan, datDichVu.soTienDaThanhToan,
    datDichVu.maThamChieuThanhToan,datDichVu.maGiaoDichVnpay,datDichVu.maPhanHoiThanhToan,datDichVu.thoiDiemThanhToan,
    datDichVu.thoiDiemTao
FROM dbo.DatDichVuKhachSan datDichVu
LEFT JOIN dbo.DichVu dichVu
    ON dichVu.maDichVu = datDichVu.maDichVu;
GO

-- =============================================================================
-- vwChuSoHuuDatPhong
-- =============================================================================
CREATE VIEW dbo.vwChuSoHuuDatPhong
AS
SELECT
    maPhieuDatPhong,
    maTaiKhoanKhachHang,
    trangThai
FROM dbo.PhieuDatPhong;
GO

-- =============================================================================
-- vwTienNghiCongKhai
-- =============================================================================
CREATE VIEW dbo.vwTienNghiCongKhai
AS
SELECT
    lienKet.maLoaiPhong,
    tienNghi.maTienNghi,
    tienNghi.ten
FROM dbo.LoaiPhongTienNghi lienKet
JOIN dbo.TienNghi tienNghi
    ON tienNghi.maTienNghi = lienKet.maTienNghi
JOIN dbo.LoaiPhong loaiPhong
    ON loaiPhong.maLoaiPhong = lienKet.maLoaiPhong
WHERE tienNghi.dangHoatDong = 1
    AND loaiPhong.trangThaiDanhMuc = N'Đang hoạt động';
GO

-- =============================================================================
-- vwAnhPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwAnhPhongCongKhai
AS
SELECT
    anh.maPhong,
    anh.maHinhAnhPhong,
    anh.duongDanTuongDoi,
    anh.thuTuHienThi
FROM dbo.HinhAnhPhong anh
JOIN dbo.vwPhongCongKhai phong
    ON phong.maPhong = anh.maPhong
WHERE anh.dangHoatDong = 1;
GO

-- =============================================================================
-- vwAnhLoaiPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwAnhLoaiPhongCongKhai
AS
SELECT
    anh.maLoaiPhong,
    anh.maHinhAnhLoaiPhong,
    anh.duongDanAnh,
    anh.thuTuHienThi
FROM dbo.HinhAnhLoaiPhong anh
JOIN dbo.LoaiPhong loaiPhong
    ON loaiPhong.maLoaiPhong = anh.maLoaiPhong
WHERE loaiPhong.trangThaiDanhMuc = N'Đang hoạt động';
GO

-- =============================================================================
-- vwDoiSoatOta
-- Booking từ OTA, doanh thu gộp, hoa hồng và doanh thu ròng không âm.
-- Nếu chưa có doanh thu gộp OTA thì dùng tổng sau giảm giá, trước cọc và các lần thanh toán.
-- =============================================================================
CREATE VIEW dbo.vwDoiSoatOta
AS
SELECT
    phieu.maPhieuDatPhong,
    khach.hoVaTen,
    COALESCE(MIN(chiTiet.maPhong), N'') AS maPhong,
    phieu.nguonDatPhong,
    CASE
        WHEN phieu.doanhThuGopOta > 0 THEN phieu.doanhThuGopOta
        ELSE GREATEST(ROUND(COALESCE(hoaDon.tongTienPhong + hoaDon.tongTienDichVu + hoaDon.tienPhuThu
            + hoaDon.tienBoiThuong + hoaDon.phiGiaHan + hoaDon.tongTienDieuChinh - hoaDon.tienGiamGia,0)/1000.0,0)*1000,0)
    END AS doanhThuGop,
    phieu.hoaHongOta,
    GREATEST(CASE
        WHEN phieu.doanhThuGopOta > 0 THEN phieu.doanhThuGopOta
        ELSE GREATEST(ROUND(COALESCE(hoaDon.tongTienPhong + hoaDon.tongTienDichVu + hoaDon.tienPhuThu
            + hoaDon.tienBoiThuong + hoaDon.phiGiaHan + hoaDon.tongTienDieuChinh - hoaDon.tienGiamGia,0)/1000.0,0)*1000,0)
    END - phieu.hoaHongOta, 0) AS doanhThuRong,
    phieu.trangThaiDoiSoatOta,
    phieu.thoiDiemDat
FROM dbo.PhieuDatPhong phieu
JOIN dbo.KhachLuuTru khach
    ON khach.maKhachLuuTru = phieu.maKhachLuuTru
LEFT JOIN dbo.ChiTietDatPhong chiTiet
    ON chiTiet.maPhieuDatPhong = phieu.maPhieuDatPhong
LEFT JOIN dbo.HoaDon hoaDon
    ON hoaDon.maPhieuDatPhong = phieu.maPhieuDatPhong
WHERE phieu.nguonDatPhong <> N'Trực tiếp'
GROUP BY phieu.maPhieuDatPhong,
    khach.hoVaTen,
    phieu.nguonDatPhong,
    phieu.doanhThuGopOta,
    phieu.hoaHongOta,
    phieu.trangThaiDoiSoatOta,
    phieu.thoiDiemDat,
    hoaDon.tongTienPhong,hoaDon.tongTienDichVu,hoaDon.tienPhuThu,hoaDon.tienBoiThuong,
    hoaDon.phiGiaHan,hoaDon.tongTienDieuChinh,hoaDon.tienGiamGia;
GO

-- =============================================================================
-- vwHoaDonGiaTriGiaTang
-- =============================================================================
CREATE VIEW dbo.vwHoaDonGiaTriGiaTang
AS
SELECT
    maHoaDonGiaTriGiaTang,
    maHoaDon,
    soHoaDonGiaTriGiaTang,
    thueSuat,
    soTienChiuThue,
    loaiKhachHang,
    tenKhachHang,
    maSoThue,
    tenCongTy,
    diaChiCongTy,
    trangThai,
    trangThaiXml,
    thoiDiemPhatHanh,
    nguoiTao
FROM dbo.HoaDonGiaTriGiaTang;
GO

-- =============================================================================
-- vwChamCong
-- =============================================================================
CREATE VIEW dbo.vwChamCong
AS
SELECT
    maChamCong,
    maNhanVien,
    ngayLamViec,
    thoiDiemVaoCa,
    thoiDiemRaCa,
    trangThai,
    nguonDuLieu,
    maSuKienThietBi,
    ghiChu
FROM dbo.ChamCong;
GO

-- =============================================================================
-- vwDonNghiPhep
-- =============================================================================
CREATE VIEW dbo.vwDonNghiPhep
AS
SELECT
    maDonNghiPhep,
    maNhanVien,
    loaiNghiPhep,
    ngayBatDau,
    ngayKetThuc,
    lyDo,
    maNhanVienDoiCa,
    trangThai,
    nguoiYeuCau,
    nguoiPheDuyet,
    thoiDiemQuyetDinh,
    thoiDiemTao
FROM dbo.DonNghiPhep;
GO

-- =============================================================================
-- vwTaiSanKyThuat
-- =============================================================================
CREATE VIEW dbo.vwTaiSanKyThuat
AS
SELECT
    maTaiSanKyThuat,
    ten,
    danhMuc,
    loaiViTri,
    maPhong,
    tang,
    viTri,
    thuongHieuMau,
    ngayLapDat,
    ngayBaoTriTiepTheo,
    trangThai,
    giaTriBanDau,
    ghiChu,
    dangHoatDong
FROM dbo.TaiSanKyThuat;
GO

-- =============================================================================
-- vwPhongNoiBo
-- =============================================================================
CREATE VIEW dbo.vwPhongNoiBo
AS
SELECT
    phong.maPhong,
    phong.ten,
    phong.trangThai,
    phong.maLoaiPhong,
    loaiPhong.ten AS tenLoaiPhong,
    phong.tang,
    loaiPhong.giaTheoNgay,
    loaiPhong.loaiGiuong,
    phong.moTa,
    phong.phienBan
FROM dbo.Phong phong
JOIN dbo.LoaiPhong loaiPhong
    ON loaiPhong.maLoaiPhong = phong.maLoaiPhong;
GO

-- =============================================================================
-- vwSuCoLeTan
-- =============================================================================
CREATE VIEW dbo.vwSuCoLeTan
AS
SELECT
    maSuCoThietBi,
    maPhieuDatPhong,
    maPhong,
    tienBoiThuong
FROM dbo.SuCoThietBi;
GO

-- =============================================================================
-- vwGiaoDichDoiSoat
-- =============================================================================
CREATE VIEW dbo.vwGiaoDichDoiSoat
AS
SELECT
    maGiaoDichThanhToan,
    maHoaDon,
    phuongThuc,
    loai,
    soTien,
    thoiDiemPhatSinh,
    maNguoiThucHien
FROM dbo.GiaoDichThanhToan
WHERE trangThai = N'Đã hoàn tất';
GO

-- =============================================================================
-- vwHinhAnhPhongNoiBo
-- =============================================================================
CREATE VIEW dbo.vwHinhAnhPhongNoiBo
AS
SELECT
    maHinhAnhPhong,
    maPhong,
    duongDanTuongDoi,
    thuTuHienThi,
    laAnhBia,
    loaiNoiDung,
    kichThuocByte,
    dangHoatDong
FROM dbo.HinhAnhPhong;
GO

-- =============================================================================
-- vwTienNghiNoiBo
-- =============================================================================
CREATE VIEW dbo.vwTienNghiNoiBo
AS
SELECT
    maTienNghi,
    ten,
    dangHoatDong
FROM dbo.TienNghi;
GO

-- =============================================================================
-- vwTienNghiTheoLoaiPhong
-- =============================================================================
CREATE VIEW dbo.vwTienNghiTheoLoaiPhong
AS
SELECT
    lienKet.maLoaiPhong,
    tienNghi.maTienNghi,
    tienNghi.ten,
    tienNghi.dangHoatDong
FROM dbo.LoaiPhongTienNghi lienKet
JOIN dbo.TienNghi tienNghi
    ON tienNghi.maTienNghi = lienKet.maTienNghi;
GO

-- =============================================================================
-- vwBienDongKhoDichVu
-- =============================================================================
CREATE VIEW dbo.vwBienDongKhoDichVu
AS
SELECT
    maBienDongKhoDichVu,
    maDichVu,
    loai,
    soLuong,
    maNguoiThucHien,
    thoiDiemPhatSinh,
    lyDo
FROM dbo.BienDongKhoDichVu;
GO

-- =============================================================================
-- vwTonKhoDichVu
-- =============================================================================
CREATE VIEW dbo.vwTonKhoDichVu
AS
SELECT
    maDichVu,
    soLuongTonKho,
    nguongAnToan,
    dangHoatDong
FROM dbo.DichVu;
GO

-- =============================================================================
-- vwThietBiPhong
-- =============================================================================
CREATE VIEW dbo.vwThietBiPhong
AS
SELECT
    maThietBiPhong,
    maPhong,
    ten,
    giaTriBanDau,
    ngayMua,
    soLuong,
    dangHoatDong
FROM dbo.ThietBiPhong;
GO

-- =============================================================================
-- vwPhieuBaoTri
-- =============================================================================
CREATE VIEW dbo.vwPhieuBaoTri
AS
SELECT
    maPhieuBaoTri,
    maPhong,
    loaiBaoTri,
    ngayDuKien,
    trangThai,
    moTa
FROM dbo.PhieuBaoTri;
GO

-- =============================================================================
-- vwPhamViNhiemVuBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwPhamViNhiemVuBuongPhong
AS
SELECT
    maNhiemVuBuongPhong,
    nguoiDuocPhanCong,
    trangThai
FROM dbo.NhiemVuBuongPhong;
GO

-- =============================================================================
-- vwMauChecklistBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwMauChecklistBuongPhong
AS
SELECT
    maMauChecklist,
    ten,
    dangHoatDong
FROM dbo.MauChecklistBuongPhong;
GO

-- =============================================================================
-- vwKetQuaChecklistBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwKetQuaChecklistBuongPhong
AS
SELECT
    maKetQuaChecklist,
    maNhiemVuBuongPhong,
    hangMuc,
    datYeuCau,
    ghiChu,
    nguoiHoanThanh,
    thoiDiemHoanThanh
FROM dbo.KetQuaChecklistBuongPhong;
GO

-- =============================================================================
-- vwKiemTraBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwKiemTraBuongPhong
AS
SELECT
    maKiemTraBuongPhong,
    maNhiemVuBuongPhong,
    loaiKiemTra,
    hangMuc,
    soLuong,
    tinhTrangHangMuc,
    ghiChu,
    nguoiHoanThanh,
    thoiDiemHoanThanh
FROM dbo.KiemTraBuongPhong;
GO

-- =============================================================================
-- vwThongBao
-- =============================================================================
CREATE VIEW dbo.vwThongBao
AS
SELECT
    maThongBao,
    chuDe,
    vaiTroNguoiNhan,
    noiDung,
    trangThai,
    khoaChongLap,
    thoiDiemCoTheGui,
    thoiDiemTao,
    thoiDiemGui
FROM dbo.HangDoiThongBao;
GO

-- =============================================================================
-- vwSuCoThietBi
-- =============================================================================
CREATE VIEW dbo.vwSuCoThietBi
AS
SELECT
    maSuCoThietBi,
    maPhieuDatPhong,
    maPhong,
    tenThietBi,
    tienBoiThuong,
    mucDoNghiemTrong,
    trangThaiBanGiao,
    ghiChuBanGiao
FROM dbo.SuCoThietBi;
GO

-- =============================================================================
-- vwNhatKyKiemSoat
-- =============================================================================
CREATE VIEW dbo.vwNhatKyKiemSoat
AS
SELECT
    maNhatKyKiemSoat,
    nguoiThucHien,
    hanhDong,
    loaiDoiTuong,
    maDoiTuong,
    duLieuTruoc,
    duLieuSau,
    lyDo,
    khoaLienKet,
    thoiDiemTao
FROM dbo.NhatKyKiemSoat;
GO

-- =============================================================================
-- vwYeuCauPheDuyet
-- Các trường dùng để đọc yêu cầu phê duyệt; mã băm nội dung thay đổi chỉ dùng ở lệnh.
-- =============================================================================
CREATE VIEW dbo.vwYeuCauPheDuyet
AS
SELECT
    maYeuCauPheDuyet,
    nguoiYeuCau,
    hanhDong,
    maDoiTuong,
    duLieuThayDoi,
    soTien,
    lyDo,
    mucDoRuiRo,
    trangThai,
    nguoiPheDuyet,
    thoiDiemQuyetDinh,
    thoiDiemHetHan,
    thoiDiemSuDung,
    thoiDiemYeuCau,
    khoaLienKet
FROM dbo.YeuCauPheDuyet;
GO

-- =============================================================================
-- vwBanGiaoTienCa
-- Bàn giao tiền ca; chênh lệch = số thực tế - số dự kiến.
-- =============================================================================
CREATE VIEW dbo.vwBanGiaoTienCa
AS
SELECT
    maBanGiaoTienCa,
    maCa,
    nguoiBanGiao,
    nguoiNhanBanGiao,
    soTienDuKien,
    soTienThucTe,
    soTienThucTe - soTienDuKien AS chenhLech,
    thoiDiemBanGiao,
    ghiChu, nguoiXacNhan,thoiDiemXacNhan
FROM dbo.BanGiaoTienCa;
GO

-- =============================================================================
-- vwChiTietTienBanGiao
-- =============================================================================
CREATE VIEW dbo.vwChiTietTienBanGiao
AS
SELECT
    maChiTietTienBanGiao,
    maBanGiaoTienCa,
    menhGia,
    soLuong
FROM dbo.ChiTietTienBanGiao;
GO

-- =============================================================================
-- vwKhoanChi
-- =============================================================================
CREATE VIEW dbo.vwKhoanChi
AS
SELECT
    maKhoanChi,
    danhMuc,
    moTa,
    soTien,
    nguoiChiTra,
    thoiDiemChiTra,
    trangThai,phuongThucThanhToan
FROM dbo.KhoanChi;
GO

-- =============================================================================
-- vwCongNoDoiTac
-- =============================================================================
CREATE VIEW dbo.vwCongNoDoiTac
AS
SELECT
    maCongNoDoiTac,
    tenDoiTac,
    maThamChieu,
    soTien,
    soTienDaThanhToan,
    trangThai,
    thoiDiemGhiNhan
FROM dbo.CongNoDoiTac;
GO

-- =============================================================================
-- vwThanhToanCongNoDoiTac
-- =============================================================================
CREATE VIEW dbo.vwThanhToanCongNoDoiTac
AS
SELECT
    maThanhToanCongNo,
    maCongNoDoiTac,
    soTien,
    nguoiThanhToan,
    thoiDiemThanhToan,
    ghiChu,phuongThucThanhToan
FROM dbo.ThanhToanCongNoDoiTac;
GO

-- =============================================================================
-- vwButToanTaiChinh
-- =============================================================================
CREATE VIEW dbo.vwButToanTaiChinh
AS
SELECT
    maButToanTaiChinh,
    loaiButToan,
    loaiNguon,
    maNguon,
    chieuButToan,
    soTien,
    maNguoiThucHien,
    thoiDiemPhatSinh,
    ghiChu,
    daChotSo
FROM dbo.ButToanTaiChinh;
GO

-- =============================================================================
-- vwNhanVien
-- Hồ sơ nhân viên dùng nội bộ, gồm dữ liệu xác thực.
-- DAO xác thực sử dụng matKhau; không đưa trường này vào phản hồi API.
-- =============================================================================
CREATE VIEW dbo.vwNhanVien
AS
SELECT
    maNhanVien,
    hoVaTen,
    matKhau,
    vaiTro,
    soDienThoai,
    diaChi,
    email,
    phaiDoiMatKhau,
    duocKichHoat,
    taiKhoanKhongBiKhoa,
    soLanDangNhapThatBai,
    thoiDiemDangNhapGanNhat,
    thoiDiemDangNhapThatBaiGanNhat,
    trangThaiLamViec,
    ngayBatDauNghi,
    ngayKetThucNghi
FROM dbo.NhanVien;
GO

-- =============================================================================
-- vwHoSoNhanSu: DTO hồ sơ, không chứa mật khẩu hay thông tin lương.
-- =============================================================================
CREATE VIEW dbo.vwHoSoNhanSu
AS
SELECT n.maNhanVien,n.vaiTro,n.trangThaiLamViec,n.duocKichHoat,
    COALESCE(h.phienBan,0) AS phienBan,h.nguoiCapNhat,h.thoiDiemCapNhat,
    (SELECT n.hoVaTen AS full_name,n.soDienThoai AS phone,n.email,n.diaChi AS address,
        CASE h.gioiTinh WHEN N'Nam' THEN 'MALE' WHEN N'Nữ' THEN 'FEMALE' WHEN N'Khác' THEN 'OTHER' WHEN N'Không cung cấp' THEN 'UNDISCLOSED' END AS gender,
        h.ngaySinh AS birth_date,h.soGiayToTuyThan AS identity_number,h.ngayVaoLam AS hire_date,
        CASE h.loaiHopDong WHEN N'Thử việc' THEN 'PROBATION' WHEN N'Không thời hạn' THEN 'PERMANENT' WHEN N'Có thời hạn' THEN 'FIXED_TERM' WHEN N'Thời vụ' THEN 'SEASONAL' END AS contract_type
     FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER) AS duLieuHoSo
FROM dbo.NhanVien n LEFT JOIN dbo.HoSoNhanSu h ON h.maNhanVien=n.maNhanVien;
GO

-- =============================================================================
-- vwDeNghiNhanVien
-- =============================================================================
CREATE VIEW dbo.vwDeNghiNhanVien AS
SELECT maDeNghi,duLieuHoSo,vaiTroDeXuat,lyDo,trangThai,nguoiDeNghi,nguoiXetDuyet,
    lyDoQuyetDinh,maNhanVien,phienBan,thoiDiemTao,thoiDiemGui,thoiDiemQuyetDinh
FROM dbo.DeNghiTiepNhanNhanVien;
GO

-- =============================================================================
-- vwSuKienDangNhapNhanVien
-- =============================================================================
CREATE VIEW dbo.vwSuKienDangNhapNhanVien
AS
SELECT
    maSuKienDangNhap,
    maNhanVien,
    thoiDiemPhatSinh,
    ketQua
FROM dbo.SuKienDangNhapNhanVien;
GO

-- =============================================================================
-- vwMaLamMoiDangNhap
-- Dữ liệu refresh token đã băm và vòng đời phiên, dùng nội bộ cho xác thực.
-- =============================================================================
CREATE VIEW dbo.vwMaLamMoiDangNhap
AS
SELECT
    maMaLamMoiDangNhap,
    maNhanVien,
    maTaiKhoanKhachHang,
    maBamToken,
    maNhomPhien,
    thoiDiemPhatHanh,
    thoiDiemHetHan,
    thoiDiemThuHoi,
    maBamThayThe
FROM dbo.MaLamMoiDangNhap;
GO

-- =============================================================================
-- vwTaiKhoanKhachHang
-- Tài khoản khách gắn hồ sơ lưu trú, dùng nội bộ cho xác thực.
-- DAO xác thực sử dụng matKhau; không đưa trường này vào phản hồi API.
-- =============================================================================
CREATE VIEW dbo.vwTaiKhoanKhachHang
AS
SELECT
    taiKhoan.maTaiKhoanKhachHang,
    taiKhoan.maKhachLuuTru,
    taiKhoan.soDienThoai,
    taiKhoan.matKhau,
    taiKhoan.duocKichHoat,
    taiKhoan.taiKhoanKhongBiKhoa,
    khach.email
FROM dbo.TaiKhoanKhachHang taiKhoan
JOIN dbo.KhachLuuTru khach
    ON khach.maKhachLuuTru = taiKhoan.maKhachLuuTru;
GO

-- =============================================================================
-- vwKhachLuuTru
-- =============================================================================
CREATE VIEW dbo.vwKhachLuuTru
AS
SELECT
    maKhachLuuTru,
    hoVaTen,
    namSinh,
    soGiayToTuyThan,
    soDienThoai,
    email,
    diaChi,
    hangThanhVien,
    tongChiTieu,
    soLanHuyMuon,
    soLanTraPhongMuon,
    biChanDatPhong,
    soLanLuuTruHoanThanh,
    phienBan
FROM dbo.KhachLuuTru;
GO

-- =============================================================================
-- vwLichSuHangThanhVien
-- =============================================================================
CREATE VIEW dbo.vwLichSuHangThanhVien
AS
SELECT
    maLichSuHangThanhVien,
    maKhachLuuTru,
    hangCu,
    hangMoi,
    lyDo,
    thoiDiemThayDoi
FROM dbo.LichSuHangThanhVien;
GO

-- =============================================================================
-- vwLoaiPhongNoiBo
-- =============================================================================
CREATE VIEW dbo.vwLoaiPhongNoiBo
AS
SELECT
    maLoaiPhong,
    ten,
    giaTheoNgay,
    moTa,
    dienTich,
    huongNhin,
    giaTheoGio,
    loaiGiuong,
    trangThaiDanhMuc,
    nguoiCapNhatDanhMuc,
    nguoiDuyetDanhMuc,
    thoiDiemCapNhatDanhMuc,
    thoiDiemDuyetDanhMuc,
    maLoaiPhongGoc,
    maLoaiPhongThayThe,
    maHangPhong,
    soKhachToiDa,
    duongDanAnhBia,
    khauHieuQuangBa,
    tenQuangBa,
    moTaQuangBa
FROM dbo.LoaiPhong;
GO

-- =============================================================================
-- vwLichSuGiaLoaiPhong
-- =============================================================================
CREATE VIEW dbo.vwLichSuGiaLoaiPhong
AS
SELECT
    maLichSuGiaLoaiPhong,
    maLoaiPhong,
    giaTheoNgay,
    nguoiThayDoi,
    maYeuCauPheDuyet,
    thoiDiemHieuLuc
FROM dbo.LichSuGiaLoaiPhong;
GO

-- =============================================================================
-- vwDichVuNoiBo
-- =============================================================================
CREATE VIEW dbo.vwDichVuNoiBo
AS
SELECT
    maDichVu,
    ten,
    gia,
    donViTinh,
    danhMuc,
    moTa,
    duongDanAnh,
    soLuongTonKho,
    nguongAnToan,
    dangHoatDong
, thoiLuongPhut,laTaiNguyen
FROM dbo.DichVu;
GO

-- =============================================================================
-- vwLichSuGiaDichVu
-- =============================================================================
CREATE VIEW dbo.vwLichSuGiaDichVu
AS
SELECT
    maLichSuGiaDichVu,
    maDichVu,
    gia,
    nguoiThayDoi,
    maYeuCauPheDuyet,
    thoiDiemHieuLuc
FROM dbo.LichSuGiaDichVu;
GO

-- =============================================================================
-- vwGiaoDichThanhToan
-- =============================================================================
CREATE VIEW dbo.vwGiaoDichThanhToan
AS
SELECT
    maGiaoDichThanhToan,
    maHoaDon,
    soTien,
    phuongThuc,
    loai,
    trangThai,
    maThamChieu,
    thoiDiemPhatSinh,
    maNguoiThucHien,
    khoaChongTrung,
    maSuKienBenNgoai
FROM dbo.GiaoDichThanhToan;
GO

-- =============================================================================
-- vwBienLai
-- =============================================================================
CREATE VIEW dbo.vwBienLai
AS
SELECT
    maBienLai,
    soBienLai,
    maHoaDon,
    soTien,
    phuongThuc,
    thoiDiemPhatHanh,
    nguoiPhatHanh
FROM dbo.BienLai;
GO

-- =============================================================================
-- vwSoDuTienCoc
-- Mỗi dòng là một giao dịch cọc hoàn tất và số dư sau các khoản hoàn của nó.
-- REFUND_OF:<mã giao dịch>:... gắn hoàn tiền với đúng lần thu cọc và phương thức gốc.
-- Cọc được nhận diện qua DEPOSIT:..., hoặc sự kiện ngoài không thuộc tiền dịch vụ (SVC:...).
-- =============================================================================
CREATE VIEW dbo.vwSoDuTienCoc
AS
SELECT
    tienCoc.maHoaDon,
    tienCoc.maGiaoDichThanhToan,
    tienCoc.phuongThuc,
    tienCoc.thoiDiemPhatSinh,
    tienCoc.soTien - COALESCE((
        SELECT
            SUM(hoanTien.soTien)
        FROM dbo.GiaoDichThanhToan hoanTien
        WHERE hoanTien.maHoaDon = tienCoc.maHoaDon
            AND hoanTien.loai = N'Hoàn tiền'
            AND hoanTien.trangThai = N'Đã hoàn tất'
            AND hoanTien.maThamChieu LIKE N'REFUND_OF:' + CONVERT(NVARCHAR(30), tienCoc.maGiaoDichThanhToan) + N':%'
    ), 0) AS soDu
FROM dbo.GiaoDichThanhToan tienCoc
WHERE tienCoc.loai = N'Thanh toán'
    AND tienCoc.trangThai = N'Đã hoàn tất'
    AND (
        tienCoc.maThamChieu LIKE N'DEPOSIT:%'
        OR (
            tienCoc.maSuKienBenNgoai IS NOT NULL
            AND tienCoc.maSuKienBenNgoai NOT LIKE N'SVC:%'
        )
        OR (
            tienCoc.maNguoiThucHien = N'PAYMENT_GATEWAY'
            AND COALESCE(tienCoc.maSuKienBenNgoai, N'') NOT LIKE N'SVC:%'
        )
    );
GO

-- =============================================================================
-- vwYeuCauThanhToanVnpay
-- Các lần yêu cầu thanh toán VNPay kèm tài khoản sở hữu booking và kết quả xử lý.
-- =============================================================================
CREATE VIEW dbo.vwYeuCauThanhToanVnpay
AS
SELECT
    yeuCau.maYeuCauThanhToanVnpay,
    yeuCau.maPhieuDatPhong,
    phieu.maTaiKhoanKhachHang,
    yeuCau.maThamChieuMerchant,
    yeuCau.soTien,
    yeuCau.trangThai,
    yeuCau.thoiDiemTao,
    yeuCau.thoiDiemHetHan,
    yeuCau.thoiDiemHoanTat,
    yeuCau.maGiaoDichVnpay,
    yeuCau.maNganHang,
    yeuCau.loaiThe,
    yeuCau.maPhanHoi,
    yeuCau.phienBan
FROM dbo.YeuCauThanhToanVnpay AS yeuCau
JOIN dbo.PhieuDatPhong AS phieu
    ON phieu.maPhieuDatPhong = yeuCau.maPhieuDatPhong;
GO

-- =============================================================================
-- vwChuyenPhong
-- Kết quả chuyển phòng đã ghi nhận; backend kiểm tra quyền truy cập.
-- =============================================================================
CREATE VIEW dbo.vwChuyenPhong
AS
SELECT
    maChuyenPhong,
    maPhieuDatPhong,
    maPhongCu,
    maPhongMoi,
    thoiDiemChuyenPhong,
    lyDo
FROM dbo.ChuyenPhong;
GO


CREATE VIEW dbo.vwYeuCauKho AS
SELECT r.*,d.ten,d.donViTinh FROM dbo.YeuCauKho r JOIN dbo.DichVu d ON d.maDichVu=r.maDichVu;
GO

-- =============================================================================
-- vwTonKhoBuongPhong: danh mục vật tư với số tồn riêng, kể cả mặt hàng chưa nhận.
-- =============================================================================
CREATE VIEW dbo.vwTonKhoBuongPhong AS
SELECT d.maDichVu,d.ten,d.gia,d.donViTinh,d.danhMuc,d.moTa,d.duongDanAnh,
    COALESCE(k.soLuongTon,0) AS soLuongTonKho,d.nguongAnToan,d.dangHoatDong,
    d.thoiLuongPhut,d.laTaiNguyen
FROM dbo.DichVu d
LEFT JOIN dbo.TonKhoBuongPhong k ON k.maDichVu=d.maDichVu
WHERE d.danhMuc IN(N'Món ăn',N'Thức uống',N'Vật dụng phòng') AND d.laTaiNguyen=0;
GO

CREATE VIEW dbo.vwTieuThuDichVu AS
SELECT N'BOOKING:'+CONVERT(NVARCHAR(30),b.maDatDichVuKhachSan) AS maLuot,
    b.maDichVu,COALESCE(b.thoiDiemSuDung,b.thoiDiemDuKien) AS thoiDiem,
    b.soLuong,b.soLuongMienPhi,b.donGia,
    CONVERT(DECIMAL(19,2),(CONVERT(BIGINT,b.soLuong)-b.soLuongMienPhi)*b.donGia) AS thanhTien
FROM dbo.DatDichVuKhachSan b WHERE b.trangThai=N'Đã sử dụng'
UNION ALL
SELECT N'DIRECT:'+CONVERT(NVARCHAR(30),s.maPhieuDatPhong)+N':'+s.maDichVu+N':'+CONVERT(NVARCHAR(10),s.ngaySuDung,23),
    s.maDichVu,CONVERT(DATETIME2(6),s.ngaySuDung),s.soLuong,
    CASE WHEN s.donGia=0 THEN s.soLuong ELSE 0 END,s.donGia,
    CONVERT(DECIMAL(19,2),CONVERT(BIGINT,s.soLuong)*s.donGia)
FROM dbo.SuDungDichVu s;
GO
