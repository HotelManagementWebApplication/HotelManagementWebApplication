-- Kiểm tra dữ liệu thật sau seed; chỉ đọc và THROW khi quan hệ/số dư sai.
SET NOCOUNT ON;
IF NOT EXISTS(SELECT 1 FROM dbo.NhatKyKiemSoat WHERE khoaLienKet=N'OPERATING-DEMO-V1-COMPLETE')
 THROW 51000,N'Bộ dữ liệu hoạt động chưa được nạp.',1;
IF (SELECT COUNT(*) FROM dbo.PhieuDatPhong WHERE khoaChongTrung LIKE N'OPS-DEMO-RES-%')<>238
 THROW 51001,N'Sai số lượng booking mẫu.',1;
IF (SELECT COUNT(*) FROM dbo.KhachLuuTru WHERE email LIKE N'ops.guest.%@example.test')<>80
 THROW 51001,N'Sai số lượng khách mẫu.',1;
IF (SELECT COUNT(*) FROM dbo.NhanVien WHERE maNhanVien LIKE N'OPS%')<>24
 THROW 51001,N'Sai số lượng nhân viên mẫu.',1;

IF EXISTS(SELECT 1 FROM dbo.HoaDon h JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=h.maPhieuDatPhong
 WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%' AND h.soTienPhaiTra<>dbo.fnTinhSoDuHoaDon(h.maHoaDon))
 THROW 51002,N'Hóa đơn không khớp số dư thanh toán.',1;
IF EXISTS(SELECT 1 FROM dbo.GiaoDichThanhToan p JOIN dbo.HoaDon h ON h.maHoaDon=p.maHoaDon
 JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=h.maPhieuDatPhong
 OUTER APPLY(SELECT COUNT(*) qty,SUM(l.soTien) amount FROM dbo.ButToanTaiChinh l WHERE l.loaiButToan=N'PAYMENT_RECEIVED'
    AND l.loaiNguon=N'PAYMENT_TRANSACTION' AND l.maNguon=CONVERT(NVARCHAR(100),p.maGiaoDichThanhToan)) ledger
 WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%' AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất'
    AND (ledger.qty<>1 OR ledger.amount<>p.soTien))
 THROW 51002,N'Thu tiền không khớp bút toán tài chính.',1;
IF EXISTS(SELECT 1 FROM dbo.HoaDon h JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=h.maPhieuDatPhong
 OUTER APPLY(SELECT SUM(p.soTien) amount FROM dbo.GiaoDichThanhToan p WHERE p.maHoaDon=h.maHoaDon AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất') payments
 OUTER APPLY(SELECT SUM(r.soTien) amount FROM dbo.BienLai r WHERE r.maHoaDon=h.maHoaDon) receipts
 WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%' AND COALESCE(payments.amount,0)<>COALESCE(receipts.amount,0))
 THROW 51002,N'Biên lai không khớp tiền đã thu.',1;
IF EXISTS(SELECT 1 FROM dbo.HoaDon h JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=h.maPhieuDatPhong
 OUTER APPLY(SELECT COUNT(*) qty,SUM(l.soTien) amount FROM dbo.ButToanTaiChinh l WHERE l.loaiButToan=N'REVENUE_RECOGNIZED'
    AND l.loaiNguon=N'INVOICE' AND l.maNguon=CONVERT(NVARCHAR(100),h.maHoaDon)) revenue
 WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%' AND b.trangThai=N'Đã trả phòng'
    AND (revenue.qty<>1 OR revenue.amount<>h.tongTienPhong+h.tongTienDichVu+h.tongTienDieuChinh-h.tienGiamGia))
 THROW 51002,N'Doanh thu checkout không khớp hóa đơn.',1;

IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong a JOIN dbo.ChiTietDatPhong b ON a.maPhong=b.maPhong AND a.maPhieuDatPhong<b.maPhieuDatPhong
 JOIN dbo.PhieuDatPhong pa ON pa.maPhieuDatPhong=a.maPhieuDatPhong JOIN dbo.PhieuDatPhong pb ON pb.maPhieuDatPhong=b.maPhieuDatPhong
 WHERE (pa.khoaChongTrung LIKE N'OPS-DEMO-RES-%' OR pb.khoaChongTrung LIKE N'OPS-DEMO-RES-%')
    AND a.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách') AND b.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách')
    AND a.thoiDiemNhanPhong<b.thoiDiemTraPhong AND b.thoiDiemNhanPhong<a.thoiDiemTraPhong)
 THROW 51003,N'Phòng có hai lượt lưu trú đang hiệu lực chồng thời gian.',1;
IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=c.maPhieuDatPhong
 JOIN dbo.Phong p ON p.maPhong=c.maPhong WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%'
    AND c.trangThai=N'Đang có khách' AND (b.trangThai<>N'Đã nhận phòng' OR p.trangThai<>N'Đang có khách'))
 THROW 51003,N'Trạng thái phòng và khách đang ở không khớp.',1;
IF EXISTS(SELECT 1 FROM dbo.KhachLuuTru k OUTER APPLY(SELECT COUNT(*) visits FROM dbo.PhieuDatPhong b
    WHERE b.maKhachLuuTru=k.maKhachLuuTru AND b.trangThai=N'Đã trả phòng' AND b.hinhThucThue=N'Theo gói') history
 WHERE k.email LIKE N'ops.guest.%@example.test' AND (k.soLanLuuTruHoanThanh<>history.visits OR
    k.hangThanhVien<>CASE WHEN history.visits>=50 THEN N'Bạch kim' WHEN history.visits>=25 THEN N'Vàng' WHEN history.visits>=10 THEN N'Bạc' ELSE N'Tiêu chuẩn' END))
 THROW 51003,N'Hạng khách và số lượt lưu trú không khớp.',1;

IF EXISTS(SELECT 1 FROM dbo.DichVu d OUTER APPLY(SELECT SUM(CASE WHEN m.loai IN(N'Xuất kho',N'Hao hụt') THEN -m.soLuong ELSE m.soLuong END) qty
 FROM dbo.BienDongKhoDichVu m WHERE m.maDichVu=d.maDichVu) movements WHERE d.maDichVu LIKE N'OPS%' AND d.soLuongTonKho<>COALESCE(movements.qty,0))
 THROW 51004,N'Tồn kho không khớp sổ biến động.',1;
IF EXISTS(SELECT 1 FROM dbo.BanGiaoTienCa b OUTER APPLY(SELECT SUM(c.menhGia*c.soLuong) amount FROM dbo.ChiTietTienBanGiao c WHERE c.maBanGiaoTienCa=b.maBanGiaoTienCa) counted
 WHERE b.ghiChu LIKE N'OPS-DEMO:%' AND b.soTienThucTe<>COALESCE(counted.amount,0))
 THROW 51004,N'Tiền bàn giao không khớp mệnh giá.',1;
IF EXISTS(SELECT 1 FROM dbo.CaLamViecNhanVien a JOIN dbo.CaLamViecNhanVien b ON a.maNhanVien=b.maNhanVien AND a.maCaLamViecNhanVien<b.maCaLamViecNhanVien
 WHERE a.maNhanVien LIKE N'OPS%' AND a.trangThai<>N'Đã hủy' AND b.trangThai<>N'Đã hủy'
    AND a.thoiDiemBatDau<b.thoiDiemKetThuc AND b.thoiDiemBatDau<a.thoiDiemKetThuc)
 THROW 51005,N'Lịch làm việc bị trùng.',1;
IF EXISTS(SELECT 1 FROM dbo.KhoanChi e OUTER APPLY(SELECT COUNT(*) qty,SUM(l.soTien) amount FROM dbo.ButToanTaiChinh l
 WHERE l.loaiButToan=N'EXPENSE' AND l.loaiNguon=N'EXPENSE' AND l.chieuButToan=N'Ghi nợ' AND l.maNguon=CONVERT(NVARCHAR(100),e.maKhoanChi)) ledger
 WHERE e.moTa LIKE N'OPS-DEMO:%' AND (ledger.qty<>1 OR ledger.amount<>e.soTien))
 THROW 51006,N'Khoản chi không khớp loại bút toán nghiệp vụ.',1;
IF EXISTS(SELECT 1 FROM dbo.CongNoDoiTac d
 OUTER APPLY(SELECT COUNT(*) qty,SUM(l.soTien) amount FROM dbo.ButToanTaiChinh l WHERE l.loaiButToan=N'PARTNER_DEBT_RECORDED'
    AND l.loaiNguon=N'PARTNER_DEBT' AND l.chieuButToan=N'Ghi có' AND l.maNguon=CONVERT(NVARCHAR(100),d.maCongNoDoiTac)) recorded
 OUTER APPLY(SELECT SUM(l.soTien) amount FROM dbo.ButToanTaiChinh l WHERE l.loaiButToan=N'PARTNER_DEBT_SETTLEMENT'
    AND l.loaiNguon=N'PARTNER_DEBT' AND l.chieuButToan=N'Ghi nợ' AND l.maNguon=CONVERT(NVARCHAR(100),d.maCongNoDoiTac)) settled
 WHERE d.maThamChieu LIKE N'OPS-SUPPLIER-%' AND (recorded.qty<>1 OR recorded.amount<>d.soTien OR COALESCE(settled.amount,0)<>d.soTienDaThanhToan))
 THROW 51006,N'Công nợ và thanh toán không khớp loại bút toán nghiệp vụ.',1;
IF EXISTS(SELECT 1 FROM dbo.NhiemVuBuongPhong h JOIN dbo.Phong p ON p.maPhong=h.maPhong
 WHERE h.ghiChu LIKE N'OPS-DEMO:%' AND p.trangThai<>CASE WHEN h.trangThai=N'Chờ kỹ thuật' THEN N'Đang bảo trì' ELSE N'Đang dọn phòng' END)
 THROW 51005,N'Trạng thái phòng và nhiệm vụ không khớp.',1;

SELECT b.trangThai AS BookingStatus,COUNT(*) AS Qty FROM dbo.PhieuDatPhong b WHERE b.khoaChongTrung LIKE N'OPS-DEMO-RES-%' GROUP BY b.trangThai;
SELECT k.hangThanhVien AS Membership,COUNT(*) AS Qty FROM dbo.KhachLuuTru k WHERE k.email LIKE N'ops.guest.%@example.test' GROUP BY k.hangThanhVien;
PRINT N'PASS: hóa đơn, thanh toán, biên lai, doanh thu, tồn kho, lịch phòng, VIP, bàn giao và phân ca nhất quán.';
