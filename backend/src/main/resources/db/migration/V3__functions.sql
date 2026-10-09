-- V3__functions.sql
-- Demo baseline: one final definition per object.
-- Edit this owning file; do not create additional migrations.
-- Contents:
--   fnKiemTraPhongTrong
--   fnTinhTongTienPhong
--   fnTinhTongTienDichVu
--   fnTinhSoDuHoaDon
--   fnSoDuTienCoc
--   fnKiemTraTrungCaLamViec
--   fnTongDichVuKhachSanDaDung
--   fnDashboardDatPhong
--   fnTienMatRongTheoCa
--   fnTinhBoiThuongThietBi

-- =============================================================================
-- fnKiemTraPhongTrong
-- =============================================================================
CREATE FUNCTION dbo.fnKiemTraPhongTrong
(
    @maPhong NVARCHAR(10),
    @tuThoiDiem DATETIME2(6),
    @denThoiDiem DATETIME2(6),
    @thoiDiemHienTai DATETIME2(6),
    @maPhieuDatPhongBoQua BIGINT = NULL
)
RETURNS BIT
AS
BEGIN
    DECLARE @phongTrong BIT = 1;

    IF @tuThoiDiem IS NULL OR @denThoiDiem IS NULL OR @tuThoiDiem >= @denThoiDiem
        RETURN 0;

    IF EXISTS (
        SELECT 1
        FROM dbo.ChiTietDatPhong AS chiTiet
        INNER JOIN dbo.PhieuDatPhong AS phieu
            ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
        WHERE chiTiet.maPhong = @maPhong
          AND (@maPhieuDatPhongBoQua IS NULL OR phieu.maPhieuDatPhong <> @maPhieuDatPhongBoQua)
          AND chiTiet.thoiDiemNhanPhong < @denThoiDiem
          AND chiTiet.thoiDiemTraPhong > @tuThoiDiem
          AND chiTiet.trangThai <> N'Đã hủy'
          AND phieu.trangThai NOT IN (N'Đã hủy', N'Không đến', N'Đã trả phòng')
          AND (
                phieu.trangThai <> N'Bản nháp'
                OR phieu.maTaiKhoanKhachHang IS NULL
                OR (
                    phieu.trangThaiThanhToanCoc = N'Chờ thanh toán'
                    AND phieu.thoiDiemHetHanThanhToanCoc > @thoiDiemHienTai
                )
          )
    ) SET @phongTrong = 0;

    RETURN @phongTrong;
END;
GO

-- =============================================================================
-- fnTinhTongTienPhong
-- =============================================================================
CREATE FUNCTION dbo.fnTinhTongTienPhong
(
    @giaTheoNgay DECIMAL(12,2),
    @giaTheoGio DECIMAL(12,2),
    @tuThoiDiem DATETIME2(6),
    @denThoiDiem DATETIME2(6),
    @thueTheoGio BIT,
    @soGioToiThieu INT
)
RETURNS DECIMAL(19,2)
AS
BEGIN
    IF @giaTheoNgay IS NULL OR @giaTheoNgay < 0 OR @tuThoiDiem IS NULL
       OR @denThoiDiem IS NULL OR @tuThoiDiem >= @denThoiDiem
        RETURN NULL;

    DECLARE @soPhut BIGINT = DATEDIFF_BIG(MINUTE, @tuThoiDiem, @denThoiDiem);
    IF @thueTheoGio = 1
    BEGIN
        DECLARE @soGio BIGINT = (@soPhut + 59) / 60;
        IF @soGio < @soGioToiThieu SET @soGio = @soGioToiThieu;
        DECLARE @donGiaGio DECIMAL(19,2) = CASE
            WHEN @giaTheoGio IS NULL OR @giaTheoGio = 0 THEN ROUND(@giaTheoNgay / 24.0, 2)
            ELSE @giaTheoGio
        END;
        RETURN CAST(@donGiaGio * @soGio AS DECIMAL(19,2));
    END;

    DECLARE @soNgay BIGINT = (@soPhut + 1439) / 1440;
    IF @soNgay < 1 SET @soNgay = 1;
    RETURN CAST(@giaTheoNgay * @soNgay AS DECIMAL(19,2));
END;
GO

-- =============================================================================
-- fnTinhTongTienDichVu
-- =============================================================================
CREATE FUNCTION dbo.fnTinhTongTienDichVu(@maPhieuDatPhong BIGINT)
RETURNS DECIMAL(19,2)
AS
BEGIN
    DECLARE @tong DECIMAL(19,2) = 0;

    SELECT @tong = @tong + COALESCE(SUM(CAST(soLuong AS DECIMAL(19,2)) * donGia), 0)
    FROM dbo.SuDungDichVu
    WHERE maPhieuDatPhong = @maPhieuDatPhong;

    SELECT @tong = @tong + COALESCE(SUM(CAST(soLuong - soLuongMienPhi AS DECIMAL(19,2)) * donGia), 0)
    FROM dbo.DatDichVuKhachSan
    WHERE maPhieuDatPhong = @maPhieuDatPhong
      AND trangThai = N'Đã sử dụng';

    RETURN @tong;
END;
GO

-- =============================================================================
-- fnTinhSoDuHoaDon
-- =============================================================================
CREATE FUNCTION dbo.fnTinhSoDuHoaDon(@maHoaDon BIGINT)
RETURNS DECIMAL(19,2)
AS
BEGIN
    DECLARE @tongPhaiThu DECIMAL(19,2);
    DECLARE @daThanhToan DECIMAL(19,2);

    SELECT @tongPhaiThu = ROUND((
        tongTienPhong + tienPhuThu + tongTienDichVu + tienBoiThuong
        + phiGiaHan + tongTienDieuChinh - tienGiamGia
    ) / 1000.0, 0) * 1000
    FROM dbo.HoaDon
    WHERE maHoaDon = @maHoaDon;

    IF @tongPhaiThu IS NULL RETURN NULL;
    IF @tongPhaiThu < 0 SET @tongPhaiThu = 0;

    SELECT @daThanhToan = COALESCE(SUM(CASE
        WHEN loai = N'Thanh toán' THEN soTien
        WHEN loai = N'Hoàn tiền' THEN -soTien
        ELSE 0 END), 0)
    FROM dbo.GiaoDichThanhToan
    WHERE maHoaDon = @maHoaDon AND trangThai = N'Đã hoàn tất';

    RETURN CASE WHEN @tongPhaiThu - @daThanhToan < 0 THEN 0
                ELSE CAST(@tongPhaiThu - @daThanhToan AS DECIMAL(19,2)) END;
END;
GO

-- =============================================================================
-- fnKiemTraTrungCaLamViec
-- =============================================================================
CREATE FUNCTION dbo.fnSoDuTienCoc(@invoice BIGINT)
RETURNS DECIMAL(19,2) AS
BEGIN
 DECLARE @deposit DECIMAL(19,2);
 SELECT @deposit=COALESCE(SUM(p.soTien-COALESCE(refunds.soTien,0)),0)
 FROM dbo.GiaoDichThanhToan p OUTER APPLY(SELECT SUM(r.soTien) AS soTien FROM dbo.GiaoDichThanhToan r
  WHERE r.maHoaDon=p.maHoaDon AND r.loai=N'Hoàn tiền' AND r.trangThai=N'Đã hoàn tất'
   AND r.maThamChieu LIKE N'REFUND_OF:'+CONVERT(NVARCHAR(30),p.maGiaoDichThanhToan)+N':%') refunds
 WHERE p.maHoaDon=@invoice AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất'
  AND(p.maThamChieu LIKE N'DEPOSIT:%' OR p.maSuKienBenNgoai IS NOT NULL OR p.maNguoiThucHien=N'PAYMENT_GATEWAY');
 RETURN CASE WHEN @deposit<0 THEN 0 ELSE @deposit END;
END;
GO

CREATE FUNCTION dbo.fnKiemTraTrungCaLamViec
(
    @maNhanVien NVARCHAR(10),
    @thoiDiemBatDau DATETIME2(6),
    @thoiDiemKetThuc DATETIME2(6),
    @maCaBoQua BIGINT = NULL
)
RETURNS BIT
AS
BEGIN
    IF @thoiDiemBatDau IS NULL OR @thoiDiemKetThuc IS NULL OR @thoiDiemBatDau >= @thoiDiemKetThuc
        RETURN 1;

    RETURN CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.CaLamViecNhanVien
        WHERE maNhanVien = @maNhanVien
          AND trangThai <> N'Đã hủy'
          AND (@maCaBoQua IS NULL OR maCaLamViecNhanVien <> @maCaBoQua)
          AND thoiDiemBatDau < @thoiDiemKetThuc
          AND thoiDiemKetThuc > @thoiDiemBatDau
    ) THEN 1 ELSE 0 END;
END;
GO

-- =============================================================================
-- fnTongDichVuKhachSanDaDung
-- =============================================================================
CREATE FUNCTION dbo.fnTongDichVuKhachSanDaDung(@maPhieu BIGINT)
RETURNS DECIMAL(19,2) AS
BEGIN
    DECLARE @tong DECIMAL(19,2);
    SELECT @tong=COALESCE(SUM((soLuong-soLuongMienPhi)*donGia),0)
    FROM dbo.DatDichVuKhachSan WHERE maPhieuDatPhong=@maPhieu AND trangThai=N'Đã sử dụng';
    RETURN @tong;
END;
GO

-- =============================================================================
-- fnDashboardDatPhong
-- =============================================================================
CREATE FUNCTION dbo.fnDashboardDatPhong(@tim NVARCHAR(255),@trangThai NVARCHAR(30),@nhom NVARCHAR(30),@tu DATETIME2(6),@den DATETIME2(6))
RETURNS TABLE AS RETURN
 SELECT d.maPhieuDatPhong,d.maKhachLuuTru,d.hoVaTen,d.soDienThoai,d.trangThai,d.thoiDiemNhanPhong,d.thoiDiemTraPhong,d.tienDatCoc,d.trangThaiThanhToanCoc,d.soTienPhaiTra
 FROM (
SELECT p.maPhieuDatPhong,p.trangThai,p.trangThaiThanhToanCoc,p.tienDatCoc,k.maKhachLuuTru,k.hoVaTen,k.soDienThoai,
       MIN(c.thoiDiemNhanPhong) AS thoiDiemNhanPhong,MAX(c.thoiDiemTraPhong) AS thoiDiemTraPhong,
       MIN(CASE WHEN c.trangThai=N'Đã giữ phòng' THEN c.thoiDiemNhanPhong END) AS thoiDiemNhanPhongDangGiu,
       h.maHoaDon,COALESCE(h.soTienPhaiTra,0) AS soTienPhaiTra
FROM dbo.PhieuDatPhong p JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=p.maKhachLuuTru
LEFT JOIN dbo.ChiTietDatPhong c ON c.maPhieuDatPhong=p.maPhieuDatPhong
LEFT JOIN dbo.HoaDon h ON h.maPhieuDatPhong=p.maPhieuDatPhong
GROUP BY p.maPhieuDatPhong,p.trangThai,p.trangThaiThanhToanCoc,p.tienDatCoc,k.maKhachLuuTru,k.hoVaTen,k.soDienThoai,h.maHoaDon,h.soTienPhaiTra
) d
 WHERE (@trangThai IS NULL OR d.trangThai=@trangThai)
 AND (@tim=N'' OR CONVERT(NVARCHAR(30),d.maPhieuDatPhong) LIKE N'%'+@tim+N'%' OR LOWER(d.hoVaTen) LIKE N'%'+@tim+N'%' OR d.soDienThoai LIKE N'%'+@tim+N'%'
      OR EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong q WHERE q.maPhieuDatPhong=d.maPhieuDatPhong AND LOWER(q.maPhong) LIKE N'%'+@tim+N'%'))
 AND (@nhom=N'ALL'
  OR (@nhom=N'ARRIVALS' AND d.trangThai IN(N'Đã xác nhận',N'Đã thanh toán cọc') AND d.thoiDiemNhanPhongDangGiu>=@tu AND d.thoiDiemNhanPhongDangGiu<@den)
  OR (@nhom=N'DEPARTURES' AND d.trangThai=N'Đã nhận phòng' AND d.thoiDiemTraPhong>=@tu AND d.thoiDiemTraPhong<@den)
  OR (@nhom=N'CURRENT' AND d.trangThai=N'Đã nhận phòng')
  OR (@nhom=N'UPCOMING' AND d.trangThai IN(N'Đã xác nhận',N'Đã thanh toán cọc') AND EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong q WHERE q.maPhieuDatPhong=d.maPhieuDatPhong AND q.trangThai=N'Đã giữ phòng' AND q.thoiDiemTraPhong>@tu AND(q.thoiDiemNhanPhong<@tu OR q.thoiDiemNhanPhong>=@den)))
  OR (@nhom=N'UNPAID_DEPOSITS' AND (d.trangThaiThanhToanCoc=N'Chờ thanh toán' OR(d.tienDatCoc>0 AND d.trangThaiThanhToanCoc<>N'Đã thanh toán')))
  OR (@nhom=N'INVOICE_BALANCES' AND d.maHoaDon IS NOT NULL AND d.soTienPhaiTra>0));
GO

-- =============================================================================
-- fnTienMatRongTheoCa
-- =============================================================================
CREATE FUNCTION dbo.fnTienMatRongTheoCa(@actor NVARCHAR(50),@tu DATETIME2(6),@den DATETIME2(6))
RETURNS DECIMAL(19,2) AS
BEGIN
 DECLARE @tong DECIMAL(19,2);
 SELECT @tong=COALESCE(SUM(CASE WHEN loai=N'Thanh toán' THEN soTien ELSE -soTien END),0)
 FROM dbo.GiaoDichThanhToan
 WHERE maNguoiThucHien=@actor AND phuongThuc=N'Tiền mặt' AND trangThai=N'Đã hoàn tất'
 AND thoiDiemPhatSinh>@tu AND thoiDiemPhatSinh<=@den;
 RETURN @tong;
END;
GO

-- =============================================================================
-- fnTinhBoiThuongThietBi: the two-year boundary is inclusive; future dates are
-- rejected by the owning command, not silently priced by the function.
-- =============================================================================
CREATE FUNCTION dbo.fnTinhBoiThuongThietBi(@value DECIMAL(14,2),@purchase DATE,@quantity INT,@reference DATE)
RETURNS DECIMAL(19,2) AS
BEGIN
 IF @value IS NULL OR @purchase IS NULL OR @quantity<=0 OR @reference IS NULL RETURN 0;
 IF @purchase>@reference RETURN NULL;
 RETURN ROUND(@value*@quantity*CASE WHEN @reference>DATEADD(YEAR,2,@purchase) THEN 2.00 ELSE 1.50 END,2);
END;
GO
