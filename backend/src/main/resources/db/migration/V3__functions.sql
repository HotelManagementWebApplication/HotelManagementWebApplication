-- V3__functions.sql
-- Mỗi đối tượng có một định nghĩa cuối cùng; sửa trực tiếp trong file sở hữu.
-- Giữ nguyên tên, thứ tự tham số và các cột kết quả để bên gọi tiếp tục sử dụng.
-- Mục lục:
--   fnKiemTraPhongTrong
--   fnTinhTongTienPhong
--   fnTinhTongTienDichVu
--   fnTinhSoDuHoaDon
--   fnSoDuTienCoc
--   fnKiemTraTrungCaLamViec
--   fnTongDichVuKhachSanDaDung
--   fnDashboardDatPhong
--   fnTienMatRongTheoCa
--   fnSoDuTienMatNhanVien
--   fnTinhBoiThuongThietBi

-- =============================================================================
-- fnKiemTraPhongTrong
-- Trả 1 nếu không có chi tiết đặt phòng còn hiệu lực giao với khoảng yêu cầu.
-- Hai khoảng sát nhau ở giờ trả/nhận phòng không bị xem là giao nhau.
-- Booking nháp của khách online chỉ giữ phòng khi còn hạn chờ thanh toán cọc.
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

    IF @tuThoiDiem IS NULL
        OR @denThoiDiem IS NULL
        OR @tuThoiDiem >= @denThoiDiem
        RETURN 0;

    IF EXISTS (
        SELECT
            1
        FROM dbo.ChiTietDatPhong AS chiTiet
        INNER JOIN dbo.PhieuDatPhong AS phieu
            ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
        WHERE chiTiet.maPhong = @maPhong
            AND (
                @maPhieuDatPhongBoQua IS NULL
                OR phieu.maPhieuDatPhong <> @maPhieuDatPhongBoQua
            )
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
    )
        SET @phongTrong = 0;

    RETURN @phongTrong;
END;
GO

-- =============================================================================
-- fnTinhTongTienPhong
-- Tính tiền theo giờ hoặc ngày; làm tròn số phút lên đơn vị tính tiền.
-- Theo giờ: áp dụng số giờ tối thiểu; giá giờ thiếu hoặc bằng 0 lấy giá ngày / 24.
-- =============================================================================
CREATE FUNCTION dbo.fnTinhTongTienPhong
(
    @giaTheoNgay DECIMAL(12, 2),
    @giaTheoGio DECIMAL(12, 2),
    @tuThoiDiem DATETIME2(6),
    @denThoiDiem DATETIME2(6),
    @thueTheoGio BIT,
    @soGioToiThieu INT
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    IF @giaTheoNgay IS NULL
        OR @giaTheoNgay < 0
        OR @tuThoiDiem IS NULL
        OR @denThoiDiem IS NULL
        OR @tuThoiDiem >= @denThoiDiem
        RETURN NULL;

    -- Cộng 59 phút/1439 phút trước khi chia nguyên để làm tròn lên giờ/ngày.
    DECLARE @soPhut BIGINT = DATEDIFF_BIG(MINUTE, @tuThoiDiem, @denThoiDiem);
    IF @thueTheoGio = 1
    BEGIN
        DECLARE @soGio BIGINT = (@soPhut + 59) / 60;
        IF @soGio < @soGioToiThieu
            SET @soGio = @soGioToiThieu;
        DECLARE @donGiaGio DECIMAL(19, 2) = CASE
            WHEN @giaTheoGio IS NULL
                OR @giaTheoGio = 0 THEN ROUND(@giaTheoNgay / 24.0, 2)
            ELSE @giaTheoGio
        END;
        RETURN CAST(@donGiaGio * @soGio AS DECIMAL(19, 2));
    END;

    DECLARE @soNgay BIGINT = (@soPhut + 1439) / 1440;
    IF @soNgay < 1
        SET @soNgay = 1;
    RETURN CAST(@giaTheoNgay * @soNgay AS DECIMAL(19, 2));
END;
GO

-- =============================================================================
-- fnTinhTongTienDichVu
-- Cộng dịch vụ sử dụng trực tiếp và dịch vụ đặt trước đã sử dụng.
-- Dịch vụ đặt trước chỉ tính phần số lượng vượt phần được miễn phí.
-- =============================================================================
CREATE FUNCTION dbo.fnTinhTongTienDichVu
(
    @maPhieuDatPhong BIGINT
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @tong DECIMAL(19, 2) = 0;

    -- Dịch vụ ghi nhận trực tiếp.
    SELECT
        @tong = @tong + COALESCE(SUM(CAST(soLuong AS DECIMAL(19, 2)) * donGia), 0)
    FROM dbo.SuDungDichVu
    WHERE maPhieuDatPhong = @maPhieuDatPhong;
    -- Dịch vụ đặt trước: chỉ thu phần vượt số lượng miễn phí.
    SELECT
        @tong = @tong + COALESCE(SUM(CAST(soLuong - soLuongMienPhi AS DECIMAL(19, 2)) * donGia), 0)
    FROM dbo.DatDichVuKhachSan
    WHERE maPhieuDatPhong = @maPhieuDatPhong
        AND trangThai = N'Đã sử dụng';

    RETURN @tong;
END;
GO

-- =============================================================================
-- fnTinhSoDuHoaDon
-- Làm tròn tổng phải thu tới nghìn đồng, trừ tiền thanh toán ròng rồi chặn số dư âm.
-- Thanh toán ròng = tiền đã thu hoàn tất - tiền đã hoàn hoàn tất.
-- =============================================================================
CREATE FUNCTION dbo.fnTinhSoDuHoaDon
(
    @maHoaDon BIGINT
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @tongPhaiThu DECIMAL(19, 2);
    DECLARE @daThanhToan DECIMAL(19, 2);
    SELECT @tongPhaiThu = ROUND((
        tongTienPhong + tienPhuThu + tongTienDichVu + tienBoiThuong
        + phiGiaHan + tongTienDieuChinh - tienGiamGia
    ) / 1000.0, 0) * 1000
    FROM dbo.HoaDon
    WHERE maHoaDon = @maHoaDon;
    IF @tongPhaiThu IS NULL
        RETURN NULL;
    IF @tongPhaiThu < 0
        SET @tongPhaiThu = 0;
    SELECT
        @daThanhToan = COALESCE(SUM(CASE
        WHEN loai = N'Thanh toán' THEN soTien
        WHEN loai = N'Hoàn tiền' THEN - soTien
        ELSE 0
    END), 0)
    FROM dbo.GiaoDichThanhToan
    WHERE maHoaDon = @maHoaDon
        AND trangThai = N'Đã hoàn tất';
    RETURN CASE
        WHEN @tongPhaiThu - @daThanhToan < 0 THEN 0
        ELSE CAST(@tongPhaiThu - @daThanhToan AS DECIMAL(19, 2))
    END;
END;
GO

-- =============================================================================
-- fnSoDuTienCoc
-- Cộng số dư từng giao dịch cọc sau khi trừ các khoản hoàn gắn với giao dịch gốc.
-- @maHoaDon là mã hóa đơn cần tính số dư tiền cọc.
-- REFUND_OF:<mã giao dịch>:... xác định khoản hoàn của đúng lần thu cọc.
-- Cọc được nhận diện qua DEPOSIT:..., mã sự kiện ngoài hoặc người thực hiện PAYMENT_GATEWAY.
-- =============================================================================
CREATE FUNCTION dbo.fnSoDuTienCoc
(
    @maHoaDon BIGINT
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @soDuCoc DECIMAL(19, 2);
    SELECT
        @soDuCoc = COALESCE(SUM(tienCoc.soTien - COALESCE(tongHoan.soTien, 0)), 0)
    FROM dbo.GiaoDichThanhToan tienCoc
    OUTER APPLY (
        SELECT
            SUM(hoanTien.soTien) AS soTien
        FROM dbo.GiaoDichThanhToan hoanTien
        WHERE hoanTien.maHoaDon = tienCoc.maHoaDon
            AND hoanTien.loai = N'Hoàn tiền'
            AND hoanTien.trangThai = N'Đã hoàn tất'
            AND hoanTien.maThamChieu LIKE N'REFUND_OF:' + CONVERT(NVARCHAR(30), tienCoc.maGiaoDichThanhToan) + N':%'
    ) tongHoan
    WHERE tienCoc.maHoaDon = @maHoaDon
        AND tienCoc.loai = N'Thanh toán'
        AND tienCoc.trangThai = N'Đã hoàn tất'
        AND (
            tienCoc.maThamChieu LIKE N'DEPOSIT:%'
            OR tienCoc.maSuKienBenNgoai IS NOT NULL
            OR tienCoc.maNguoiThucHien = N'PAYMENT_GATEWAY'
        );
    RETURN CASE
        WHEN @soDuCoc < 0 THEN 0
        ELSE @soDuCoc
    END;
END;
GO

-- =============================================================================
-- fnKiemTraTrungCaLamViec
-- Trả 1 khi khoảng giờ không hợp lệ hoặc giao với ca chưa hủy của cùng nhân viên.
-- Có thể bỏ qua ca đang sửa; hai ca sát giờ nhau không bị xem là trùng.
-- =============================================================================
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
    IF @thoiDiemBatDau IS NULL
        OR @thoiDiemKetThuc IS NULL
        OR @thoiDiemBatDau >= @thoiDiemKetThuc
        RETURN 1;
    RETURN CASE
        WHEN EXISTS (
            SELECT
                1
            FROM dbo.CaLamViecNhanVien
            WHERE maNhanVien = @maNhanVien
                AND trangThai <> N'Đã hủy'
                AND (
                    @maCaBoQua IS NULL
                    OR maCaLamViecNhanVien <> @maCaBoQua
                )
                AND thoiDiemBatDau < @thoiDiemKetThuc
                AND thoiDiemKetThuc > @thoiDiemBatDau
        ) THEN 1
        ELSE 0
    END;
END;
GO

-- =============================================================================
-- fnTongDichVuKhachSanDaDung
-- Tổng tiền dịch vụ đặt trước đã dùng, sau khi trừ số lượng miễn phí.
-- =============================================================================
CREATE FUNCTION dbo.fnTongDichVuKhachSanDaDung
(
    @maPhieu BIGINT
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @tong DECIMAL(19, 2);
    SELECT
        @tong = COALESCE(SUM((soLuong - soLuongMienPhi) * donGia), 0)
    FROM dbo.DatDichVuKhachSan
    WHERE maPhieuDatPhong = @maPhieu
        AND trangThai = N'Đã sử dụng';

    RETURN @tong;
END;
GO

-- =============================================================================
-- fnDashboardDatPhong
-- Gộp chi tiết phòng theo booking rồi lọc theo tìm kiếm, trạng thái và nhóm dashboard.
-- ARRIVALS/DEPARTURES dùng khoảng [@tu, @den): gồm đầu, không gồm cuối.
-- UPCOMING chọn booking có phòng còn hạn giữ nhưng giờ nhận nằm ngoài khoảng đang xem.
-- =============================================================================
CREATE FUNCTION dbo.fnDashboardDatPhong
(
    @tim NVARCHAR(255),
    @trangThai NVARCHAR(30),
    @nhom NVARCHAR(30),
    @tu DATETIME2(6),
    @den DATETIME2(6)
)
RETURNS TABLE
AS RETURN
SELECT
    bangTongHopDatPhong.maPhieuDatPhong,
    bangTongHopDatPhong.maKhachLuuTru,
    bangTongHopDatPhong.hoVaTen,
    bangTongHopDatPhong.soDienThoai,
    bangTongHopDatPhong.trangThai,
    bangTongHopDatPhong.thoiDiemNhanPhong,
    bangTongHopDatPhong.thoiDiemTraPhong,
    bangTongHopDatPhong.tienDatCoc,
    bangTongHopDatPhong.trangThaiThanhToanCoc,
    bangTongHopDatPhong.soTienPhaiTra
FROM (
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
        COALESCE(hoaDon.soTienPhaiTra, 0) AS soTienPhaiTra
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
        hoaDon.soTienPhaiTra
) bangTongHopDatPhong
WHERE (
    @trangThai IS NULL
    OR bangTongHopDatPhong.trangThai = @trangThai
)
    AND (
        @tim = N''
        OR CONVERT(NVARCHAR(30), bangTongHopDatPhong.maPhieuDatPhong) LIKE N'%' + @tim + N'%'
        OR LOWER(bangTongHopDatPhong.hoVaTen) LIKE N'%' + @tim + N'%'
        OR bangTongHopDatPhong.soDienThoai LIKE N'%' + @tim + N'%'
        OR EXISTS (
            SELECT
                1
            FROM dbo.ChiTietDatPhong phongLoc
            WHERE phongLoc.maPhieuDatPhong = bangTongHopDatPhong.maPhieuDatPhong
                AND LOWER(phongLoc.maPhong) LIKE N'%' + @tim + N'%'
        )
    )
    -- Mỗi nhánh OR tương ứng một nhóm hiển thị trên dashboard.
    AND (
        @nhom = N'ALL'
        -- Sắp nhận phòng trong khoảng đang xem.
        OR (
            @nhom = N'ARRIVALS'
            AND bangTongHopDatPhong.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc')
            AND bangTongHopDatPhong.thoiDiemNhanPhongDangGiu >= @tu
            AND bangTongHopDatPhong.thoiDiemNhanPhongDangGiu < @den
        )
        -- Khách đang ở, dự kiến trả phòng trong khoảng đang xem.
        OR (
            @nhom = N'DEPARTURES'
            AND bangTongHopDatPhong.trangThai = N'Đã nhận phòng'
            AND bangTongHopDatPhong.thoiDiemTraPhong >= @tu
            AND bangTongHopDatPhong.thoiDiemTraPhong < @den
        )
        -- Toàn bộ booking đang có khách.
        OR (
            @nhom = N'CURRENT'
            AND bangTongHopDatPhong.trangThai = N'Đã nhận phòng'
        )
        -- Phòng còn đang giữ, giờ nhận nằm ngoài khoảng đang xem.
        OR (
            @nhom = N'UPCOMING'
            AND bangTongHopDatPhong.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc')
            AND EXISTS (
                SELECT
                    1
                FROM dbo.ChiTietDatPhong phongLoc
                WHERE phongLoc.maPhieuDatPhong = bangTongHopDatPhong.maPhieuDatPhong
                    AND phongLoc.trangThai = N'Đã giữ phòng'
                    AND phongLoc.thoiDiemTraPhong > @tu
                    AND (
                        phongLoc.thoiDiemNhanPhong < @tu
                        OR phongLoc.thoiDiemNhanPhong >= @den
                    )
            )
        )
        -- Còn chờ hoặc chưa hoàn tất thanh toán cọc.
        OR (
            @nhom = N'UNPAID_DEPOSITS'
            AND (
                bangTongHopDatPhong.trangThaiThanhToanCoc = N'Chờ thanh toán'
                OR (
                    bangTongHopDatPhong.tienDatCoc > 0
                    AND bangTongHopDatPhong.trangThaiThanhToanCoc <> N'Đã thanh toán'
                )
            )
        )
        -- Đã có hóa đơn và còn số tiền phải trả.
        OR (
            @nhom = N'INVOICE_BALANCES'
            AND bangTongHopDatPhong.maHoaDon IS NOT NULL
            AND bangTongHopDatPhong.soTienPhaiTra > 0
        )
    );
GO

-- =============================================================================
-- fnTienMatRongTheoCa
-- Tổng tiền mặt đã thu trừ đã hoàn của người thực hiện trong khoảng (@tu, @den].
-- @nguoiThucHien là mã người thực hiện giao dịch.
-- Mốc đầu bị loại, mốc cuối được tính để không cộng trùng giữa hai lần bàn giao.
-- =============================================================================
CREATE FUNCTION dbo.fnTienMatRongTheoCa
(
    @nguoiThucHien NVARCHAR(50),
    @tu DATETIME2(6),
    @den DATETIME2(6)
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @tong DECIMAL(19, 2);
    SELECT
        @tong = COALESCE(SUM(CASE
        WHEN loai = N'Thanh toán' THEN soTien
        ELSE - soTien
    END), 0)
    FROM dbo.GiaoDichThanhToan
    WHERE maNguoiThucHien = @nguoiThucHien
        AND phuongThuc = N'Tiền mặt'
        AND trangThai = N'Đã hoàn tất'
        AND thoiDiemPhatSinh > @tu
        AND thoiDiemPhatSinh <= @den;

    RETURN @tong;
END;
GO

-- =============================================================================
-- fnSoDuTienMatNhanVien
-- Số dư két: tiền thu/hoàn + tiền nhận bàn giao - số dự kiến đã chốt - chi tiền mặt.
-- Chênh lệch đã được ghi sổ ở lần bàn giao trước, không lặp lại ở ca sau.
-- =============================================================================
CREATE FUNCTION dbo.fnSoDuTienMatNhanVien(@nguoiThucHien NVARCHAR(50), @den DATETIME2(6))
RETURNS DECIMAL(19, 2)
AS
BEGIN
    DECLARE @tong DECIMAL(19, 2) = dbo.fnTienMatRongTheoCa(@nguoiThucHien, '1970-01-01', @den);
    SELECT @tong = @tong + COALESCE(SUM(CASE WHEN nguoiNhanBanGiao = @nguoiThucHien THEN soTienThucTe ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN nguoiBanGiao = @nguoiThucHien THEN soTienDuKien ELSE 0 END),0)
    FROM dbo.BanGiaoTienCa WHERE thoiDiemBanGiao <= @den
        AND (nguoiBanGiao = @nguoiThucHien OR nguoiNhanBanGiao = @nguoiThucHien);
    SELECT @tong = @tong - COALESCE(SUM(soTien),0) FROM dbo.KhoanChi
        WHERE nguoiChiTra=@nguoiThucHien AND phuongThucThanhToan=N'Tiền mặt' AND trangThai<>N'Đã hủy' AND thoiDiemChiTra<=@den;
    SELECT @tong = @tong - COALESCE(SUM(soTien),0) FROM dbo.ThanhToanCongNoDoiTac
        WHERE nguoiThanhToan=@nguoiThucHien AND phuongThucThanhToan=N'Tiền mặt' AND thoiDiemThanhToan<=@den;
    RETURN @tong;
END;
GO

-- =============================================================================
-- fnTinhBoiThuongThietBi
-- @value: giá trị ban đầu; @purchase: ngày mua; @quantity: số lượng.
-- @reference: ngày làm mốc tính tuổi thiết bị.
-- Bồi thường = giá trị ban đầu × số lượng × hệ số theo tuổi thiết bị.
-- Tới đúng 2 năm dùng hệ số 1,50; sau 2 năm dùng 2,00.
-- Ngày mua trong tương lai trả NULL; lệnh nghiệp vụ ở V5 chịu trách nhiệm từ chối.
-- =============================================================================
CREATE FUNCTION dbo.fnTinhBoiThuongThietBi
(
    @giaTriBanDau DECIMAL(14, 2),
    @ngayMua DATE,
    @soLuong INT,
    @ngayThamChieu DATE
)
RETURNS DECIMAL(19, 2)
AS
BEGIN
    IF @giaTriBanDau IS NULL
        OR @ngayMua IS NULL
        OR @soLuong <= 0
        OR @ngayThamChieu IS NULL
        RETURN 0;
    IF @ngayMua > @ngayThamChieu
        RETURN NULL;
    RETURN ROUND(@giaTriBanDau * @soLuong * CASE
        WHEN @ngayThamChieu > DATEADD(YEAR, 2, @ngayMua) THEN 2.00
        ELSE 1.50
    END, 2);
END;
GO

-- Chính sách tồn dùng chung cho dữ liệu thật và demo. Cấu hình từng dịch vụ
-- được ưu tiên; hàng kho/nhà hàng mặc định tiêu hao, nhóm khác giữ theo lịch.
CREATE FUNCTION dbo.fnDichVuTruTon(@maDichVu NVARCHAR(10))
RETURNS BIT
AS
BEGIN
    DECLARE @truTon BIT;
    SELECT @truTon=CASE WHEN c.cachTinh=N'Theo tồn kho' THEN 1
        ELSE COALESCE(c.truTonKhiSuDung,CASE WHEN d.danhMuc IN (
            N'Dịch vụ doanh nghiệp',N'Dịch vụ tại phòng',N'Giặt ủi',N'Giải trí',N'Spa',N'Đưa đón')
            THEN 0 ELSE 1 END) END
    FROM dbo.DichVu d LEFT JOIN dbo.CauHinhLichDichVu c ON c.maDichVu=d.maDichVu
    WHERE d.maDichVu=@maDichVu;
    RETURN @truTon;
END;
GO

-- Khả dụng trong [từ, đến): lấy mức chiếm dụng đồng thời lớn nhất, không cộng
-- các lượt đặt nối tiếp nhau. Giờ/ngày tính giá tách khỏi đơn vị sân/phòng/suất.
CREATE FUNCTION dbo.fnKhaDungDichVu(@tu DATETIME2(6), @den DATETIME2(6))
RETURNS TABLE
AS RETURN (
    WITH Booking AS (
        SELECT b.maDichVu,CASE WHEN c.cachTinh=N'Theo ngày' THEN CONVERT(DATETIME2(6),CAST(b.thoiDiemDuKien AS DATE)) ELSE b.thoiDiemDuKien END AS batDau,
            CASE WHEN c.cachTinh=N'Theo kỳ lưu trú' THEN p.thoiDiemTraPhong
                WHEN c.cachTinh=N'Theo ngày' THEN DATEADD(DAY,1,CONVERT(DATETIME2(6),CAST(b.thoiDiemDuKien AS DATE)))
                WHEN c.cachTinh=N'Qua đêm' THEN DATEADD(HOUR,8,DATEADD(DAY,1,CONVERT(DATETIME2(6),CAST(b.thoiDiemDuKien AS DATE))))
                ELSE DATEADD(MINUTE,CONVERT(INT,CASE
                    WHEN duration.phut>DATEDIFF_BIG(MINUTE,b.thoiDiemDuKien,p.thoiDiemTraPhong)
                    THEN DATEDIFF_BIG(MINUTE,b.thoiDiemDuKien,p.thoiDiemTraPhong)
                    ELSE duration.phut END),b.thoiDiemDuKien) END AS ketThuc,
            CONVERT(BIGINT,CASE WHEN c.cachTinh=N'Theo thời lượng' THEN 1 ELSE b.soLuong END) AS chiemDung,
            b.trangThai,c.cachTinh
        FROM dbo.DatDichVuKhachSan b
        JOIN dbo.CauHinhLichDichVu c ON c.maDichVu=b.maDichVu
        JOIN dbo.ChiTietDatPhong p ON p.maPhieuDatPhong=b.maPhieuDatPhong AND p.maPhong=b.maPhong
        JOIN dbo.PhieuDatPhong r ON r.maPhieuDatPhong=b.maPhieuDatPhong
        CROSS APPLY (SELECT CONVERT(BIGINT,c.soPhutMoiLuot)*CASE WHEN c.cachTinh=N'Theo thời lượng' THEN b.soLuong ELSE 1 END AS phut) duration
        WHERE b.trangThai IN (N'Đã xác nhận',N'Đã sử dụng') AND r.trangThai NOT IN (N'Đã hủy',N'Không đến')
    ), Points AS (
        SELECT maDichVu,@tu AS diem FROM dbo.CauHinhLichDichVu
        UNION SELECT maDichVu,batDau FROM Booking WHERE batDau>@tu AND batDau<@den AND ketThuc>@tu AND cachTinh<>N'Theo tồn kho'
    ), Occupancy AS (
        SELECT p.maDichVu,p.diem,COALESCE(SUM(b.chiemDung),0) AS daDat
        FROM Points p LEFT JOIN Booking b ON b.maDichVu=p.maDichVu AND b.batDau<=p.diem AND b.ketThuc>p.diem AND b.cachTinh<>N'Theo tồn kho'
        GROUP BY p.maDichVu,p.diem
    ), Peak AS (
        SELECT maDichVu,MAX(daDat) AS daDat FROM Occupancy GROUP BY maDichVu
    ), Counts AS (
        SELECT c.maDichVu,c.donViKhaDung,c.cachTinh,
            CASE WHEN dbo.fnDichVuTruTon(c.maDichVu)=1 THEN CONVERT(BIGINT,d.soLuongTonKho)-COALESCE((
                SELECT SUM(CONVERT(BIGINT,b.soLuong)) FROM dbo.DatDichVuKhachSan b
                JOIN dbo.PhieuDatPhong r ON r.maPhieuDatPhong=b.maPhieuDatPhong
                WHERE b.maDichVu=c.maDichVu AND b.trangThai=N'Đã xác nhận' AND r.trangThai NOT IN (N'Đã hủy',N'Không đến')
            ),0) ELSE NULL END AS tonKhaDung,
            CASE WHEN c.cachTinh=N'Theo tồn kho' THEN d.soLuongTonKho ELSE c.congSuat END AS congSuat,
            CASE WHEN c.cachTinh=N'Theo tồn kho'
                THEN COALESCE((SELECT SUM(CONVERT(BIGINT,b.soLuong)) FROM dbo.DatDichVuKhachSan b JOIN dbo.PhieuDatPhong r ON r.maPhieuDatPhong=b.maPhieuDatPhong
                    WHERE b.maDichVu=c.maDichVu AND b.trangThai=N'Đã xác nhận' AND r.trangThai NOT IN (N'Đã hủy',N'Không đến')),0)
                ELSE COALESCE(p.daDat,0) END AS daDat
        FROM dbo.CauHinhLichDichVu c JOIN dbo.DichVu d ON d.maDichVu=c.maDichVu LEFT JOIN Peak p ON p.maDichVu=c.maDichVu
        WHERE d.dangHoatDong=1 AND @tu<@den
    )
    SELECT maDichVu,donViKhaDung,cachTinh,congSuat,daDat,dbo.fnDichVuTruTon(maDichVu) AS truTon,
        CASE WHEN daDat>=congSuat OR tonKhaDung<=0 THEN CONVERT(BIGINT,0)
            WHEN tonKhaDung<congSuat-daDat THEN tonKhaDung ELSE congSuat-daDat END AS conLai
    FROM Counts
);
GO
