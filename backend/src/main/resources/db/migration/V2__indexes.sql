-- Standalone indexes moved verbatim from the SQL Server baseline.
-- Primary-key and unique-constraint backing indexes remain owned by V1.

CREATE INDEX idxLoaiPhong01 ON LoaiPhong (trangThaiDanhMuc, maLoaiPhong);

CREATE INDEX idxLoaiPhong02 ON LoaiPhong (maLoaiPhongGoc);

CREATE INDEX idxLoaiPhong03 ON LoaiPhong (maHangPhong);

CREATE INDEX idxPhong01 ON Phong (maLoaiPhong);

CREATE INDEX idxPhong02 ON Phong (trangThai);

CREATE INDEX idxKhachLuuTru01 ON KhachLuuTru (hoVaTen, soDienThoai, soGiayToTuyThan);

CREATE UNIQUE INDEX ukKhachLuuTru02 ON KhachLuuTru (email)
    WHERE email IS NOT NULL;

CREATE INDEX idxNhanVien01 ON NhanVien (trangThaiLamViec, duocKichHoat);

CREATE INDEX idxPhieuDatPhong01 ON PhieuDatPhong (maKhachLuuTru, thoiDiemDat);

CREATE INDEX idxPhieuDatPhong02 ON PhieuDatPhong (maNhanVien, thoiDiemDat);

CREATE INDEX idxPhieuDatPhong03 ON PhieuDatPhong (trangThai);

CREATE INDEX idxPhieuDatPhong04 ON PhieuDatPhong (maTaiKhoanKhachHang, thoiDiemDat);

CREATE UNIQUE INDEX ukPhieuDatPhong01 ON PhieuDatPhong (khoaChongTrung)
    WHERE khoaChongTrung IS NOT NULL;

CREATE UNIQUE INDEX ukPhieuDatPhong02 ON PhieuDatPhong (maThanhToanDatCoc)
    WHERE maThanhToanDatCoc IS NOT NULL;

CREATE INDEX idxChiTietDatPhong01 ON ChiTietDatPhong (maPhong, thoiDiemNhanPhong, thoiDiemTraPhong);

CREATE INDEX idxChuyenPhong01 ON ChuyenPhong (maPhieuDatPhong);

CREATE INDEX idxChuyenPhong02 ON ChuyenPhong (maPhongCu);

CREATE INDEX idxChuyenPhong03 ON ChuyenPhong (maPhongMoi);

CREATE INDEX idxDichVu01 ON DichVu (dangHoatDong, ten);

CREATE INDEX idxDichVu02 ON DichVu (dangHoatDong, danhMuc, ten);

CREATE INDEX idxSuDungDichVu01 ON SuDungDichVu (maDichVu, ngaySuDung);

CREATE INDEX idxHoaDon01 ON HoaDon (trangThai, thoiDiemPhatHanh);

CREATE INDEX idxDieuChinhHoaDon01 ON DieuChinhHoaDon (maHoaDon, thoiDiemPhatSinh);

CREATE INDEX idxPhieuBaoTri01 ON PhieuBaoTri (maPhong, trangThai);

CREATE INDEX idxSuCoThietBi01 ON SuCoThietBi (maPhieuDatPhong);

CREATE INDEX idxSuCoThietBi02 ON SuCoThietBi (maPhong);

CREATE INDEX idxYeuCauPheDuyet01 ON YeuCauPheDuyet (trangThai);

CREATE INDEX idxYeuCauPheDuyet02 ON YeuCauPheDuyet (maDoiTuong);

CREATE INDEX idxYeuCauPheDuyet03 ON YeuCauPheDuyet (trangThai, mucDoRuiRo, thoiDiemYeuCau);

CREATE INDEX idxNhatKyKiemSoat01 ON NhatKyKiemSoat (nguoiThucHien, thoiDiemTao);

CREATE INDEX idxNhatKyKiemSoat02 ON NhatKyKiemSoat (hanhDong, thoiDiemTao);

CREATE INDEX idxMaLamMoiDangNhap01 ON MaLamMoiDangNhap (maNhanVien);

CREATE INDEX idxMaLamMoiDangNhap02 ON MaLamMoiDangNhap (thoiDiemHetHan);

CREATE INDEX idxMaLamMoiDangNhap03 ON MaLamMoiDangNhap (thoiDiemThuHoi, thoiDiemHetHan);

CREATE INDEX idxMaLamMoiDangNhap04 ON MaLamMoiDangNhap (maTaiKhoanKhachHang);

CREATE INDEX idxYeuCauThanhToanVnpay01
    ON YeuCauThanhToanVnpay (maPhieuDatPhong, thoiDiemTao DESC);

CREATE INDEX idxYeuCauThanhToanVnpay02
    ON YeuCauThanhToanVnpay (trangThai, thoiDiemHetHan);

CREATE UNIQUE INDEX ukGiaoDichThanhToan01 ON GiaoDichThanhToan (khoaChongTrung)
    WHERE khoaChongTrung IS NOT NULL;

CREATE UNIQUE INDEX ukGiaoDichThanhToan02 ON GiaoDichThanhToan (maSuKienBenNgoai)
    WHERE maSuKienBenNgoai IS NOT NULL;

CREATE INDEX idxGiaoDichThanhToan01 ON GiaoDichThanhToan (maHoaDon, thoiDiemPhatSinh);

CREATE INDEX idxBienLai01 ON BienLai (maHoaDon, thoiDiemPhatHanh);

CREATE INDEX idxBienDongKhoDichVu01 ON BienDongKhoDichVu (maDichVu, thoiDiemPhatSinh);

CREATE INDEX idxThietBiPhong01 ON ThietBiPhong (maPhong, dangHoatDong);

CREATE INDEX idxLichSuHangThanhVien01 ON LichSuHangThanhVien (maKhachLuuTru, thoiDiemThayDoi);

CREATE INDEX idxLoaiPhongTienNghi01 ON LoaiPhongTienNghi (maTienNghi);

CREATE INDEX idxHinhAnhPhong01 ON HinhAnhPhong (maPhong, dangHoatDong, thuTuHienThi);

CREATE INDEX idxBanGhiChongTrung01 ON BanGhiChongTrung (thoiDiemTao);

CREATE INDEX idxLichSuGiaLoaiPhong01
    ON LichSuGiaLoaiPhong (maLoaiPhong, thoiDiemHieuLuc, maLichSuGiaLoaiPhong);

CREATE INDEX idxNhiemVuBuongPhong01 ON NhiemVuBuongPhong (maPhong, trangThai);

CREATE INDEX idxNhiemVuBuongPhong02 ON NhiemVuBuongPhong (nguoiDuocPhanCong, trangThai);

CREATE INDEX idxPhieuCongViecKyThuat01 ON PhieuCongViecKyThuat (maPhong, trangThai);

CREATE INDEX idxPhieuCongViecKyThuat02 ON PhieuCongViecKyThuat (nguoiDuocPhanCong, trangThai);

CREATE INDEX idxLichSuGiaDichVu01
    ON LichSuGiaDichVu (maDichVu, thoiDiemHieuLuc, maLichSuGiaDichVu);

CREATE INDEX idxHangDoiThongBao01 ON HangDoiThongBao (trangThai, thoiDiemCoTheGui, maThongBao);

CREATE INDEX idxCaLamViecNhanVien01 ON CaLamViecNhanVien (ngayLamCa, maNhanVien);

CREATE INDEX idxKetQuaChecklistBuongPhong01 ON KetQuaChecklistBuongPhong (maNhiemVuBuongPhong, maKetQuaChecklist);

CREATE INDEX idxKiemTraBuongPhong01 ON KiemTraBuongPhong (maNhiemVuBuongPhong, thoiDiemHoanThanh);

CREATE INDEX idxThanhToanCongNoDoiTac01
    ON ThanhToanCongNoDoiTac (maCongNoDoiTac, thoiDiemThanhToan);

CREATE INDEX idxButToanTaiChinh01
    ON ButToanTaiChinh (thoiDiemPhatSinh, loaiButToan);

CREATE INDEX idxSuKienDangNhapNhanVien01
    ON SuKienDangNhapNhanVien (maNhanVien, thoiDiemPhatSinh);

CREATE INDEX idxDonNghiPhep01 ON DonNghiPhep (trangThai, ngayBatDau);

CREATE INDEX idxBienDongTonKho01 ON BienDongTonKho (maMatHang, thoiDiemPhatSinh);

CREATE INDEX idxTaiSanKyThuat01 ON TaiSanKyThuat (loaiViTri, tang, trangThai);

CREATE INDEX idxChiTietTienBanGiao01
    ON ChiTietTienBanGiao (maBanGiaoTienCa);

CREATE INDEX idxDatDichVuKhachSan01
    ON DatDichVuKhachSan (maPhieuDatPhong, trangThai, thoiDiemDuKien);

CREATE INDEX idxDatDichVuKhachSan02
    ON DatDichVuKhachSan (maPhieuDatPhong, maPhong, maDichVu, thoiDiemDuKien, trangThai);
