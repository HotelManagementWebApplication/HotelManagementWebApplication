-- V4__views.sql
-- Demo baseline: one final definition per object.
-- Edit this owning file; do not create additional migrations.
-- Contents:
--   vwChuyenPhong
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

-- =============================================================================
-- vwPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwPhongCongKhai AS
SELECT p.maPhong,p.ten AS tenPhong,p.tang,p.moTa,p.trangThai,l.maLoaiPhong,l.ten AS tenLoaiPhong,
       l.moTa AS moTaLoaiPhong,l.giaTheoNgay,l.giaTheoGio,l.dienTich,l.huongNhin,l.loaiGiuong,l.maHangPhong,
       l.soKhachToiDa,l.duongDanAnhBia,l.khauHieuQuangBa,l.tenQuangBa,l.moTaQuangBa
FROM dbo.Phong p JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong
WHERE l.trangThaiDanhMuc=N'Đang hoạt động';
GO

-- =============================================================================
-- vwDichVuCongKhai
-- =============================================================================
CREATE VIEW dbo.vwDichVuCongKhai
AS
SELECT maDichVu, ten, gia, donViTinh, danhMuc, moTa, duongDanAnh
FROM dbo.DichVu
WHERE dangHoatDong = 1;
GO

-- =============================================================================
-- vwDatPhongChiTiet
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
    phieu.lyDoHuy,phieu.ketQuaHuy,phieu.soPhutGiaHan,phieu.khoaChongTrung,
    phieu.maThanhToanDatCoc,phieu.thoiDiemHetHanThanhToanCoc,phieu.phuongThucBaoDam,
    phieu.loaiThayDoiDangCho,phieu.thoiDiemNhanPhongTruocThayDoi,phieu.thoiDiemTraPhongTruocThayDoi,
    phieu.tienDatCocTruocThayDoi,phieu.tienDatCocBoSung,phieu.emailXacNhan,
    phieu.nguonDatPhong,phieu.doanhThuGopOta,phieu.hoaHongOta,phieu.trangThaiDoiSoatOta,phieu.phienBan,
    chiTiet.maPhong,
    chiTiet.thoiDiemNhanPhong,
    chiTiet.thoiDiemTraPhong,
    chiTiet.thoiDiemTraPhongBanDau,
    chiTiet.trangThai AS trangThaiPhongTrongDatPhong,
    chiTiet.soLuongKhach,
    phong.ten AS tenPhong,loai.ten AS tenLoaiPhong,loai.giaTheoNgay,loai.giaTheoGio,
    dbo.fnTinhTongTienPhong(loai.giaTheoNgay,loai.giaTheoGio,chiTiet.thoiDiemNhanPhong,chiTiet.thoiDiemTraPhong,
     CASE WHEN phieu.hinhThucThue=N'Theo giờ' THEN 1 ELSE 0 END,3) AS tongTienPhongDuKien
FROM dbo.PhieuDatPhong AS phieu
INNER JOIN dbo.KhachLuuTru AS khach ON khach.maKhachLuuTru = phieu.maKhachLuuTru
INNER JOIN dbo.ChiTietDatPhong AS chiTiet ON chiTiet.maPhieuDatPhong = phieu.maPhieuDatPhong
JOIN dbo.Phong AS phong ON phong.maPhong=chiTiet.maPhong
JOIN dbo.LoaiPhong AS loai ON loai.maLoaiPhong=phong.maLoaiPhong;
GO

-- =============================================================================
-- Reservation service usage and financial-document links for timeline aggregation.
-- =============================================================================
CREATE VIEW dbo.vwSuDungDichVuDatPhong AS
SELECT suDung.maPhieuDatPhong,suDung.maDichVu,dichVu.ten,suDung.ngaySuDung,suDung.soLuong,suDung.donGia
FROM dbo.SuDungDichVu AS suDung JOIN dbo.DichVu AS dichVu ON dichVu.maDichVu=suDung.maDichVu;
GO
CREATE VIEW dbo.vwTaiLieuTaiChinhDatPhong AS
SELECT hoaDon.maPhieuDatPhong,N'INVOICE' AS loaiDoiTuong,hoaDon.maHoaDon AS maDoiTuong FROM dbo.HoaDon AS hoaDon
UNION ALL
SELECT hoaDon.maPhieuDatPhong,N'PAYMENT_TRANSACTION',giaoDich.maGiaoDichThanhToan
FROM dbo.HoaDon AS hoaDon JOIN dbo.GiaoDichThanhToan AS giaoDich ON giaoDich.maHoaDon=hoaDon.maHoaDon
UNION ALL
SELECT hoaDon.maPhieuDatPhong,N'RECEIPT',bienLai.maBienLai
FROM dbo.HoaDon AS hoaDon JOIN dbo.BienLai AS bienLai ON bienLai.maHoaDon=hoaDon.maHoaDon;
GO

-- =============================================================================
-- vwDashboardLeTan
-- =============================================================================
CREATE VIEW dbo.vwDashboardLeTan AS
SELECT p.maPhieuDatPhong,p.trangThai,p.trangThaiThanhToanCoc,p.tienDatCoc,k.maKhachLuuTru,k.hoVaTen,k.soDienThoai,
       MIN(c.thoiDiemNhanPhong) AS thoiDiemNhanPhong,MAX(c.thoiDiemTraPhong) AS thoiDiemTraPhong,
       MIN(CASE WHEN c.trangThai=N'Đã giữ phòng' THEN c.thoiDiemNhanPhong END) AS thoiDiemNhanPhongDangGiu,
       h.maHoaDon,COALESCE(h.soTienPhaiTra,0) AS soTienPhaiTra
FROM dbo.PhieuDatPhong p JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=p.maKhachLuuTru
LEFT JOIN dbo.ChiTietDatPhong c ON c.maPhieuDatPhong=p.maPhieuDatPhong
LEFT JOIN dbo.HoaDon h ON h.maPhieuDatPhong=p.maPhieuDatPhong
GROUP BY p.maPhieuDatPhong,p.trangThai,p.trangThaiThanhToanCoc,p.tienDatCoc,k.maKhachLuuTru,k.hoVaTen,k.soDienThoai,h.maHoaDon,h.soTienPhaiTra;
GO

-- =============================================================================
-- vwHoaDonChiTiet
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
JOIN dbo.PhieuDatPhong AS phieu ON phieu.maPhieuDatPhong=hoaDon.maPhieuDatPhong;
GO

-- =============================================================================
-- vwTonKhoHienTai
-- =============================================================================
CREATE VIEW dbo.vwTonKhoHienTai
AS
SELECT maMatHang, ten, danhMuc, donViTinh, soLuongHienTai, nguongAnToan,
       maDichVu, dangHoatDong,
       CAST(CASE WHEN soLuongHienTai <= nguongAnToan THEN 1 ELSE 0 END AS BIT) AS duoiNguongAnToan
FROM dbo.MatHangTonKho;
GO

-- =============================================================================
-- vwCongViecBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwCongViecBuongPhong
AS
SELECT nhiemVu.maNhiemVuBuongPhong, nhiemVu.maPhong, nhiemVu.nguoiDuocPhanCong,
       nhiemVu.trangThai, nhiemVu.daHoanThanhChecklist, nhiemVu.coSuCoChan,
       nhiemVu.ghiChu, nhiemVu.nguoiPhanCong, nhiemVu.thoiDiemCapNhat,
       phong.tang, phong.ten AS tenPhong
FROM dbo.NhiemVuBuongPhong AS nhiemVu
INNER JOIN dbo.Phong AS phong ON phong.maPhong = nhiemVu.maPhong;
GO

-- =============================================================================
-- vwCongViecKyThuat
-- =============================================================================
CREATE VIEW dbo.vwCongViecKyThuat AS
SELECT maPhieuCongViecKyThuat,maPhong,maThietBiPhong,nguoiDuocPhanCong,doUuTien,thoiHanSla,
 vatTuSuDung,ghiChuKetQua,ghiChuNghiemThu,nguoiNghiemThu,thoiDiemNghiemThu,trangThai,nguoiTao,thoiDiemTao,thoiDiemCapNhat
FROM dbo.PhieuCongViecKyThuat;
GO

-- =============================================================================
-- vwLichLamViecNhanVien
-- =============================================================================
CREATE VIEW dbo.vwLichLamViecNhanVien AS
SELECT ca.maCaLamViecNhanVien,ca.maNhanVien,nv.hoVaTen,nv.vaiTro,ca.ngayLamCa,ca.maCa,
       ca.thoiDiemBatDau,ca.thoiDiemKetThuc,ca.trangThai,ca.nguoiTao,
       nv.duocKichHoat,nv.trangThaiLamViec,nv.ngayBatDauNghi,nv.ngayKetThucNghi
FROM dbo.CaLamViecNhanVien ca JOIN dbo.NhanVien nv ON nv.maNhanVien=ca.maNhanVien;
GO

-- =============================================================================
-- vwDoanhThuTheoNgay
-- =============================================================================
CREATE VIEW dbo.vwDoanhThuTheoNgay
AS
SELECT CAST(thoiDiemPhatSinh AS DATE) AS ngay,
       SUM(CASE WHEN chieuButToan = N'Ghi có' THEN soTien ELSE 0 END) AS tongGhiCo,
       SUM(CASE WHEN chieuButToan = N'Ghi nợ' THEN soTien ELSE 0 END) AS tongGhiNo,
       SUM(CASE WHEN chieuButToan = N'Ghi có' THEN soTien ELSE -soTien END) AS doanhThuRong
FROM dbo.ButToanTaiChinh
WHERE daChotSo = 1
GROUP BY CAST(thoiDiemPhatSinh AS DATE);
GO

-- =============================================================================
-- vwDatDichVuKhachSan
-- =============================================================================
CREATE VIEW dbo.vwDatDichVuKhachSan AS
SELECT b.maDatDichVuKhachSan,b.maPhieuDatPhong,b.maPhong,b.maDichVu,
       COALESCE(s.ten,b.maDichVu) AS tenDichVu,s.danhMuc,
       b.thoiDiemDuKien,b.soLuong,b.soLuongMienPhi,b.donGia,b.buoiAn,b.trangThai,b.ghiChu,
       b.khoaYeuCau,b.maBamYeuCau,b.nguoiTao
FROM dbo.DatDichVuKhachSan b LEFT JOIN dbo.DichVu s ON s.maDichVu=b.maDichVu;
GO

-- =============================================================================
-- vwChuSoHuuDatPhong
-- =============================================================================
CREATE VIEW dbo.vwChuSoHuuDatPhong AS
SELECT maPhieuDatPhong,maTaiKhoanKhachHang,trangThai FROM dbo.PhieuDatPhong;
GO

-- =============================================================================
-- vwTienNghiCongKhai
-- =============================================================================
CREATE VIEW dbo.vwTienNghiCongKhai AS
SELECT l.maLoaiPhong,a.maTienNghi,a.ten FROM dbo.LoaiPhongTienNghi l
JOIN dbo.TienNghi a ON a.maTienNghi=l.maTienNghi
JOIN dbo.LoaiPhong t ON t.maLoaiPhong=l.maLoaiPhong
WHERE a.dangHoatDong=1 AND t.trangThaiDanhMuc=N'Đang hoạt động';
GO

-- =============================================================================
-- vwAnhPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwAnhPhongCongKhai AS
SELECT a.maPhong,a.maHinhAnhPhong,a.duongDanTuongDoi,a.thuTuHienThi
FROM dbo.HinhAnhPhong a JOIN dbo.vwPhongCongKhai p ON p.maPhong=a.maPhong WHERE a.dangHoatDong=1;
GO

-- =============================================================================
-- vwAnhLoaiPhongCongKhai
-- =============================================================================
CREATE VIEW dbo.vwAnhLoaiPhongCongKhai AS
SELECT a.maLoaiPhong,a.maHinhAnhLoaiPhong,a.duongDanAnh,a.thuTuHienThi
FROM dbo.HinhAnhLoaiPhong a JOIN dbo.LoaiPhong l ON l.maLoaiPhong=a.maLoaiPhong WHERE l.trangThaiDanhMuc=N'Đang hoạt động';
GO

-- =============================================================================
-- vwDoiSoatOta
-- =============================================================================
CREATE VIEW dbo.vwDoiSoatOta AS
SELECT r.maPhieuDatPhong,g.hoVaTen,COALESCE(MIN(rr.maPhong),N'') AS maPhong,r.nguonDatPhong,
       CASE WHEN r.doanhThuGopOta>0 THEN r.doanhThuGopOta ELSE COALESCE(i.soTienPhaiTra,0) END AS doanhThuGop,
       r.hoaHongOta,
       GREATEST(CASE WHEN r.doanhThuGopOta>0 THEN r.doanhThuGopOta ELSE COALESCE(i.soTienPhaiTra,0) END-r.hoaHongOta,0) AS doanhThuRong,
       r.trangThaiDoiSoatOta,r.thoiDiemDat
FROM dbo.PhieuDatPhong r JOIN dbo.KhachLuuTru g ON g.maKhachLuuTru=r.maKhachLuuTru
LEFT JOIN dbo.ChiTietDatPhong rr ON rr.maPhieuDatPhong=r.maPhieuDatPhong
LEFT JOIN dbo.HoaDon i ON i.maPhieuDatPhong=r.maPhieuDatPhong
WHERE r.nguonDatPhong<>N'Trực tiếp'
GROUP BY r.maPhieuDatPhong,g.hoVaTen,r.nguonDatPhong,r.doanhThuGopOta,r.hoaHongOta,r.trangThaiDoiSoatOta,r.thoiDiemDat,i.soTienPhaiTra;
GO

-- =============================================================================
-- vwHoaDonGiaTriGiaTang
-- =============================================================================
CREATE VIEW dbo.vwHoaDonGiaTriGiaTang AS
SELECT maHoaDonGiaTriGiaTang,maHoaDon,soHoaDonGiaTriGiaTang,thueSuat,soTienChiuThue,loaiKhachHang,
       tenKhachHang,maSoThue,tenCongTy,diaChiCongTy,trangThai,trangThaiXml,thoiDiemPhatHanh,nguoiTao
FROM dbo.HoaDonGiaTriGiaTang;
GO

-- =============================================================================
-- vwChamCong
-- =============================================================================
CREATE VIEW dbo.vwChamCong AS
SELECT maChamCong,maNhanVien,ngayLamViec,thoiDiemVaoCa,thoiDiemRaCa,trangThai,nguonDuLieu,maSuKienThietBi,ghiChu FROM dbo.ChamCong;
GO

-- =============================================================================
-- vwDonNghiPhep
-- =============================================================================
CREATE VIEW dbo.vwDonNghiPhep AS
SELECT maDonNghiPhep,maNhanVien,loaiNghiPhep,ngayBatDau,ngayKetThuc,lyDo,maNhanVienDoiCa,trangThai,nguoiYeuCau,nguoiPheDuyet,thoiDiemQuyetDinh,thoiDiemTao FROM dbo.DonNghiPhep;
GO

-- =============================================================================
-- vwTaiSanKyThuat
-- =============================================================================
CREATE VIEW dbo.vwTaiSanKyThuat AS
SELECT maTaiSanKyThuat,ten,danhMuc,loaiViTri,maPhong,tang,viTri,thuongHieuMau,ngayLapDat,ngayBaoTriTiepTheo,trangThai,giaTriBanDau,ghiChu,dangHoatDong FROM dbo.TaiSanKyThuat;
GO

-- =============================================================================
-- vwPhongNoiBo
-- =============================================================================
CREATE VIEW dbo.vwPhongNoiBo AS
SELECT p.maPhong,p.ten,p.trangThai,p.maLoaiPhong,l.ten AS tenLoaiPhong,p.tang,l.giaTheoNgay,l.loaiGiuong,p.moTa,p.phienBan
FROM dbo.Phong p JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong;
GO

-- =============================================================================
-- vwSuCoLeTan
-- =============================================================================
CREATE VIEW dbo.vwSuCoLeTan AS
SELECT maSuCoThietBi,maPhieuDatPhong,maPhong,tienBoiThuong FROM dbo.SuCoThietBi;
GO

-- =============================================================================
-- vwGiaoDichDoiSoat
-- =============================================================================
CREATE VIEW dbo.vwGiaoDichDoiSoat AS
SELECT maGiaoDichThanhToan,maHoaDon,phuongThuc,loai,soTien,thoiDiemPhatSinh,maNguoiThucHien
FROM dbo.GiaoDichThanhToan WHERE trangThai=N'Đã hoàn tất';
GO

-- =============================================================================
-- vwHinhAnhPhongNoiBo
-- =============================================================================
CREATE VIEW dbo.vwHinhAnhPhongNoiBo AS
SELECT maHinhAnhPhong,maPhong,duongDanTuongDoi,thuTuHienThi,laAnhBia,loaiNoiDung,kichThuocByte,dangHoatDong FROM dbo.HinhAnhPhong;
GO

-- =============================================================================
-- vwTienNghiNoiBo
-- =============================================================================
CREATE VIEW dbo.vwTienNghiNoiBo AS
SELECT maTienNghi,ten,dangHoatDong FROM dbo.TienNghi;
GO

-- =============================================================================
-- vwTienNghiTheoLoaiPhong
-- =============================================================================
CREATE VIEW dbo.vwTienNghiTheoLoaiPhong AS
SELECT l.maLoaiPhong,t.maTienNghi,t.ten,t.dangHoatDong FROM dbo.LoaiPhongTienNghi l JOIN dbo.TienNghi t ON t.maTienNghi=l.maTienNghi;
GO

-- =============================================================================
-- vwBienDongKhoDichVu
-- =============================================================================
CREATE VIEW dbo.vwBienDongKhoDichVu AS
SELECT maBienDongKhoDichVu,maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo FROM dbo.BienDongKhoDichVu;
GO

-- =============================================================================
-- vwTonKhoDichVu
-- =============================================================================
CREATE VIEW dbo.vwTonKhoDichVu AS
SELECT maDichVu,soLuongTonKho,nguongAnToan,dangHoatDong FROM dbo.DichVu;
GO

-- =============================================================================
-- vwThietBiPhong
-- =============================================================================
CREATE VIEW dbo.vwThietBiPhong AS
SELECT maThietBiPhong,maPhong,ten,giaTriBanDau,ngayMua,soLuong,dangHoatDong FROM dbo.ThietBiPhong;
GO

-- =============================================================================
-- vwPhieuBaoTri
-- =============================================================================
CREATE VIEW dbo.vwPhieuBaoTri AS
SELECT maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa FROM dbo.PhieuBaoTri;
GO

-- =============================================================================
-- vwPhamViNhiemVuBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwPhamViNhiemVuBuongPhong AS
SELECT maNhiemVuBuongPhong,nguoiDuocPhanCong,trangThai FROM dbo.NhiemVuBuongPhong;
GO

-- =============================================================================
-- vwMauChecklistBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwMauChecklistBuongPhong AS
SELECT maMauChecklist,ten,dangHoatDong FROM dbo.MauChecklistBuongPhong;
GO

-- =============================================================================
-- vwKetQuaChecklistBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwKetQuaChecklistBuongPhong AS
SELECT maKetQuaChecklist,maNhiemVuBuongPhong,hangMuc,datYeuCau,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh FROM dbo.KetQuaChecklistBuongPhong;
GO

-- =============================================================================
-- vwKiemTraBuongPhong
-- =============================================================================
CREATE VIEW dbo.vwKiemTraBuongPhong AS
SELECT maKiemTraBuongPhong,maNhiemVuBuongPhong,loaiKiemTra,hangMuc,soLuong,tinhTrangHangMuc,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh FROM dbo.KiemTraBuongPhong;
GO

-- =============================================================================
-- vwThongBao
-- =============================================================================
CREATE VIEW dbo.vwThongBao AS
SELECT maThongBao,chuDe,vaiTroNguoiNhan,noiDung,trangThai,khoaChongLap,thoiDiemCoTheGui,thoiDiemTao,thoiDiemGui FROM dbo.HangDoiThongBao;
GO

-- =============================================================================
-- vwSuCoThietBi: explicit incident projection, including unoccupied-room reports.
-- =============================================================================
CREATE VIEW dbo.vwSuCoThietBi AS
SELECT maSuCoThietBi,maPhieuDatPhong,maPhong,tenThietBi,tienBoiThuong,mucDoNghiemTrong,trangThaiBanGiao,ghiChuBanGiao FROM dbo.SuCoThietBi;
GO

-- =============================================================================
-- vwNhatKyKiemSoat: immutable audit read projection.
-- =============================================================================
CREATE VIEW dbo.vwNhatKyKiemSoat AS
SELECT maNhatKyKiemSoat,nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,
 duLieuTruoc,duLieuSau,lyDo,khoaLienKet,thoiDiemTao FROM dbo.NhatKyKiemSoat;
GO

-- =============================================================================
-- vwYeuCauPheDuyet: public fields only; mutation fingerprint remains command-private.
-- =============================================================================
CREATE VIEW dbo.vwYeuCauPheDuyet AS
SELECT maYeuCauPheDuyet,nguoiYeuCau,hanhDong,maDoiTuong,duLieuThayDoi,soTien,lyDo,mucDoRuiRo,
 trangThai,nguoiPheDuyet,thoiDiemQuyetDinh,thoiDiemHetHan,thoiDiemSuDung,thoiDiemYeuCau,khoaLienKet
FROM dbo.YeuCauPheDuyet;
GO

-- =============================================================================
-- Finance read models: explicit fields, append-only ledger and ordered cash lines.
-- =============================================================================
CREATE VIEW dbo.vwBanGiaoTienCa AS
SELECT maBanGiaoTienCa,maCa,nguoiBanGiao,nguoiNhanBanGiao,soTienDuKien,soTienThucTe,
 soTienThucTe-soTienDuKien AS chenhLech,thoiDiemBanGiao,ghiChu FROM dbo.BanGiaoTienCa;
GO
CREATE VIEW dbo.vwChiTietTienBanGiao AS
SELECT maChiTietTienBanGiao,maBanGiaoTienCa,menhGia,soLuong FROM dbo.ChiTietTienBanGiao;
GO
CREATE VIEW dbo.vwKhoanChi AS
SELECT maKhoanChi,danhMuc,moTa,soTien,nguoiChiTra,thoiDiemChiTra,trangThai FROM dbo.KhoanChi;
GO
CREATE VIEW dbo.vwCongNoDoiTac AS
SELECT maCongNoDoiTac,tenDoiTac,maThamChieu,soTien,soTienDaThanhToan,trangThai,thoiDiemGhiNhan FROM dbo.CongNoDoiTac;
GO
CREATE VIEW dbo.vwThanhToanCongNoDoiTac AS
SELECT maThanhToanCongNo,maCongNoDoiTac,soTien,nguoiThanhToan,thoiDiemThanhToan,ghiChu FROM dbo.ThanhToanCongNoDoiTac;
GO
CREATE VIEW dbo.vwButToanTaiChinh AS
SELECT maButToanTaiChinh,loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo FROM dbo.ButToanTaiChinh;
GO

-- =============================================================================
-- Identity projections: credentials stay inside database access, never API serialization.
-- =============================================================================
CREATE VIEW dbo.vwNhanVien AS
SELECT maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai,diaChi,email,phaiDoiMatKhau,
 duocKichHoat,taiKhoanKhongBiKhoa,soLanDangNhapThatBai,thoiDiemDangNhapGanNhat,
 thoiDiemDangNhapThatBaiGanNhat,trangThaiLamViec,ngayBatDauNghi,ngayKetThucNghi FROM dbo.NhanVien;
GO
CREATE VIEW dbo.vwSuKienDangNhapNhanVien AS
SELECT maSuKienDangNhap,maNhanVien,thoiDiemPhatSinh,ketQua FROM dbo.SuKienDangNhapNhanVien;
GO
CREATE VIEW dbo.vwMaLamMoiDangNhap AS
SELECT maMaLamMoiDangNhap,maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,
 thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maBamThayThe FROM dbo.MaLamMoiDangNhap;
GO

-- =============================================================================
-- Customer and guest projections: credentials are private to authentication DAO.
-- =============================================================================
CREATE VIEW dbo.vwTaiKhoanKhachHang AS
SELECT a.maTaiKhoanKhachHang,a.maKhachLuuTru,a.soDienThoai,a.matKhau,a.duocKichHoat,a.taiKhoanKhongBiKhoa,g.email
FROM dbo.TaiKhoanKhachHang a JOIN dbo.KhachLuuTru g ON g.maKhachLuuTru=a.maKhachLuuTru;
GO
CREATE VIEW dbo.vwKhachLuuTru AS
SELECT maKhachLuuTru,hoVaTen,namSinh,soGiayToTuyThan,soDienThoai,email,diaChi,hangThanhVien,tongChiTieu,soLanHuyMuon,soLanTraPhongMuon,biChanDatPhong,soLanLuuTruHoanThanh,phienBan FROM dbo.KhachLuuTru;
GO
CREATE VIEW dbo.vwLichSuHangThanhVien AS
SELECT maLichSuHangThanhVien,maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi FROM dbo.LichSuHangThanhVien;
GO

-- =============================================================================
-- Room-type catalog and approved-price history projections.
-- =============================================================================
CREATE VIEW dbo.vwLoaiPhongNoiBo AS
SELECT maLoaiPhong,ten,giaTheoNgay,moTa,dienTich,huongNhin,giaTheoGio,loaiGiuong,trangThaiDanhMuc,
 nguoiCapNhatDanhMuc,nguoiDuyetDanhMuc,thoiDiemCapNhatDanhMuc,thoiDiemDuyetDanhMuc,maLoaiPhongGoc,maLoaiPhongThayThe,
 maHangPhong,soKhachToiDa,duongDanAnhBia,khauHieuQuangBa,tenQuangBa,moTaQuangBa FROM dbo.LoaiPhong;
GO
CREATE VIEW dbo.vwLichSuGiaLoaiPhong AS
SELECT maLichSuGiaLoaiPhong,maLoaiPhong,giaTheoNgay,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc FROM dbo.LichSuGiaLoaiPhong;
GO

-- =============================================================================
-- Internal service catalog and approved-price history (explicit read models).
-- =============================================================================
CREATE VIEW dbo.vwDichVuNoiBo AS
SELECT maDichVu,ten,gia,donViTinh,danhMuc,moTa,duongDanAnh,soLuongTonKho,nguongAnToan,dangHoatDong FROM dbo.DichVu;
GO
CREATE VIEW dbo.vwLichSuGiaDichVu AS
SELECT maLichSuGiaDichVu,maDichVu,gia,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc FROM dbo.LichSuGiaDichVu;
GO

-- =============================================================================
-- Payment and receipt ledgers: immutable read models.
-- =============================================================================
CREATE VIEW dbo.vwGiaoDichThanhToan AS
SELECT maGiaoDichThanhToan,maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,
 thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung,maSuKienBenNgoai FROM dbo.GiaoDichThanhToan;
GO
CREATE VIEW dbo.vwBienLai AS
SELECT maBienLai,soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh FROM dbo.BienLai;
GO

-- Net refundable deposits, with refunds bound to their original tender.
CREATE VIEW dbo.vwSoDuTienCoc AS
SELECT p.maHoaDon,p.maGiaoDichThanhToan,p.phuongThuc,p.thoiDiemPhatSinh,
 p.soTien-COALESCE((SELECT SUM(r.soTien) FROM dbo.GiaoDichThanhToan r
  WHERE r.maHoaDon=p.maHoaDon AND r.loai=N'Hoàn tiền' AND r.trangThai=N'Đã hoàn tất'
   AND r.maThamChieu LIKE N'REFUND_OF:'+CONVERT(NVARCHAR(30),p.maGiaoDichThanhToan)+N':%'),0) AS soDu
FROM dbo.GiaoDichThanhToan p WHERE p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất'
 AND(p.maThamChieu LIKE N'DEPOSIT:%' OR p.maSuKienBenNgoai IS NOT NULL OR p.maNguoiThucHien=N'PAYMENT_GATEWAY');
GO

-- =============================================================================
-- vwYeuCauThanhToanVnpay
-- Customer-owned VNPay attempts and their immutable checkout/status projection.
-- =============================================================================
CREATE VIEW dbo.vwYeuCauThanhToanVnpay AS
SELECT yeuCau.maYeuCauThanhToanVnpay,yeuCau.maPhieuDatPhong,phieu.maTaiKhoanKhachHang,
 yeuCau.maThamChieuMerchant,yeuCau.soTien,yeuCau.trangThai,yeuCau.thoiDiemTao,
 yeuCau.thoiDiemHetHan,yeuCau.thoiDiemHoanTat,yeuCau.maGiaoDichVnpay,
 yeuCau.maNganHang,yeuCau.loaiThe,yeuCau.maPhanHoi,yeuCau.phienBan
FROM dbo.YeuCauThanhToanVnpay AS yeuCau
JOIN dbo.PhieuDatPhong AS phieu ON phieu.maPhieuDatPhong=yeuCau.maPhieuDatPhong;
GO

-- =============================================================================
-- vwChuyenPhong
-- Committed transfer result projection; authorization stays in the backend.
-- =============================================================================
CREATE VIEW dbo.vwChuyenPhong AS
SELECT maChuyenPhong,maPhieuDatPhong,maPhongCu,maPhongMoi,thoiDiemChuyenPhong,lyDo
FROM dbo.ChuyenPhong;
GO
