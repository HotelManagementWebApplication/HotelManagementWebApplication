-- V6__triggers.sql

-- =============================================================================
-- Đề nghị nhân viên: bản đang chờ duyệt bất biến; bản đã duyệt giữ nguyên liên kết.
-- =============================================================================
CREATE TRIGGER dbo.trgDeNghiNhanVienBaoToanQuyetDinh ON dbo.DeNghiTiepNhanNhanVien
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.maDeNghi=d.maDeNghi WHERE
        i.nguoiDeNghi<>d.nguoiDeNghi OR i.thoiDiemTao<>d.thoiDiemTao OR
        (d.trangThai=N'Đã duyệt') OR
        (d.trangThai=N'Chờ duyệt' AND (i.duLieuHoSo<>d.duLieuHoSo OR i.vaiTroDeXuat<>d.vaiTroDeXuat OR i.lyDo<>d.lyDo)) OR
        (i.trangThai=N'Đã duyệt' AND d.trangThai<>N'Chờ duyệt') OR
        i.phienBan<>d.phienBan+1)
        THROW 53703,N'Không được đổi hồ sơ đang duyệt, quyết định đã duyệt hoặc người lập đề nghị',1;
END;
GO

-- Mỗi đối tượng có một định nghĩa cuối cùng trong file sở hữu.
-- SP ở V5 xử lý lệnh nghiệp vụ; trigger ở V6 bảo vệ tính toàn vẹn dữ liệu.
-- Cách đọc:
--   inserted chứa các dòng mới; deleted chứa các dòng cũ của cả câu lệnh.
--   Trigger kiểm tra theo tập dòng, kể cả khi INSERT/UPDATE/DELETE nhiều dòng.
--   THROW từ chối thao tác vi phạm; quyền, audit và lệnh nghiệp vụ nằm ở V5.
-- Mục lục:
--   trgBienLaiBaoDamTienThu
--   trgThanhToanBaoDamBienLai
--   trgCaLamViecKhongTrung
--   trgNhatKyKiemSoatKhongSua
--   trgYeuCauPheDuyetKhongTuDuyet
--   trgButToanTaiChinhKhongSua
--   trgLichSuHangThanhVienKhongSua
--   trgDatDichVuDungKhungGioBuaAn
--   trgDatDichVuTrongKyLuuTru
--   trgDatDichVuChiDungKhiDangO
--   trgChiTietDatPhongChotGia

-- =============================================================================
-- trgBienLaiBaoDamTienThu
-- Chặn tổng biên lai vượt tổng tiền thu hoàn tất theo hóa đơn/phương thức.
-- Khóa hóa đơn theo mã; kiểm tra toàn bộ nhóm hóa đơn/phương thức được ghi.
-- Tiền thu ở đây là tổng thu trước khi trừ hoàn tiền; hoàn tiền không xóa biên lai cũ.
-- =============================================================================
CREATE TRIGGER dbo.trgBienLaiBaoDamTienThu ON dbo.BienLai
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @maHoaDonDaKhoa BIGINT;
    SELECT @maHoaDonDaKhoa = hoaDon.maHoaDon
    FROM dbo.HoaDon hoaDon WITH (UPDLOCK, HOLDLOCK)
    WHERE hoaDon.maHoaDon IN (
        SELECT maHoaDon
        FROM inserted
        UNION
        SELECT maHoaDon
        FROM deleted
    )
    ORDER BY hoaDon.maHoaDon;
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT DISTINCT maHoaDon,
                phuongThuc
            FROM inserted
        ) nhomHoaDonPhuongThuc
        OUTER APPLY (
            SELECT SUM(bienLai.soTien) tongTien
            FROM dbo.BienLai bienLai
            WHERE bienLai.maHoaDon = nhomHoaDonPhuongThuc.maHoaDon
                AND bienLai.phuongThuc = nhomHoaDonPhuongThuc.phuongThuc
        ) tongBienLai
        OUTER APPLY (
            SELECT SUM(giaoDichThu.soTien) tongTien
            FROM dbo.GiaoDichThanhToan giaoDichThu
            WHERE giaoDichThu.maHoaDon = nhomHoaDonPhuongThuc.maHoaDon
                AND giaoDichThu.phuongThuc = nhomHoaDonPhuongThuc.phuongThuc
                AND giaoDichThu.loai = N'Thanh toán'
                AND giaoDichThu.trangThai = N'Đã hoàn tất'
        ) tongTienThu
        WHERE COALESCE(tongBienLai.tongTien, 0) > COALESCE(tongTienThu.tongTien, 0)
    )
        THROW 53601, N'Tổng biên lai vượt tiền đã thu theo hóa đơn và phương thức', 1;
END;
GO

-- =============================================================================
-- trgChiTietDatPhongChotGia
-- Các chi tiết phòng được tạo trực tiếp (demo/test/legacy) chốt giá từ loại phòng
-- tại thời điểm insert. Luồng booking chính truyền giá đã chốt tường minh ở V5.
-- =============================================================================
CREATE TRIGGER dbo.trgChiTietDatPhongChotGia ON dbo.ChiTietDatPhong
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE chiTiet
    SET giaTheoNgayDaChot = COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay),
        giaTheoGioDaChot = COALESCE(chiTiet.giaTheoGioDaChot, loaiPhong.giaTheoGio)
    FROM dbo.ChiTietDatPhong AS chiTiet
    JOIN inserted AS moi
        ON moi.maPhieuDatPhong = chiTiet.maPhieuDatPhong
        AND moi.maPhong = chiTiet.maPhong
    JOIN dbo.Phong AS phong
        ON phong.maPhong = chiTiet.maPhong
    JOIN dbo.LoaiPhong AS loaiPhong
        ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
    WHERE chiTiet.giaTheoNgayDaChot IS NULL
        OR chiTiet.giaTheoGioDaChot IS NULL;
END;
GO

-- =============================================================================
-- trgThanhToanBaoDamBienLai
-- Chặn sửa/xóa/chuyển giao dịch làm biên lai cũ không còn tiền thu bảo đảm.
-- Kiểm tra cả inserted và deleted vì giao dịch có thể đổi hóa đơn/phương thức.
-- SP V5 kiểm tra quyền, số dư thuần và audit; trigger bảo vệ tiền thu của biên lai cũ.
-- =============================================================================
CREATE TRIGGER dbo.trgThanhToanBaoDamBienLai ON dbo.GiaoDichThanhToan
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @maHoaDonDaKhoa BIGINT;
    SELECT @maHoaDonDaKhoa = hoaDon.maHoaDon
    FROM dbo.HoaDon hoaDon WITH (UPDLOCK, HOLDLOCK)
    WHERE hoaDon.maHoaDon IN (
        SELECT maHoaDon
        FROM inserted
        UNION
        SELECT maHoaDon
        FROM deleted
    )
    ORDER BY hoaDon.maHoaDon;
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT maHoaDon,
                phuongThuc
            FROM inserted
            UNION
            SELECT maHoaDon,
                phuongThuc
            FROM deleted
        ) nhomHoaDonPhuongThuc
        OUTER APPLY (
            SELECT SUM(bienLai.soTien) tongTien
            FROM dbo.BienLai bienLai
            WHERE bienLai.maHoaDon = nhomHoaDonPhuongThuc.maHoaDon
                AND bienLai.phuongThuc = nhomHoaDonPhuongThuc.phuongThuc
        ) tongBienLai
        OUTER APPLY (
            SELECT SUM(giaoDichThu.soTien) tongTien
            FROM dbo.GiaoDichThanhToan giaoDichThu
            WHERE giaoDichThu.maHoaDon = nhomHoaDonPhuongThuc.maHoaDon
                AND giaoDichThu.phuongThuc = nhomHoaDonPhuongThuc.phuongThuc
                AND giaoDichThu.loai = N'Thanh toán'
                AND giaoDichThu.trangThai = N'Đã hoàn tất'
        ) tongTienThu
        WHERE COALESCE(tongBienLai.tongTien, 0) > COALESCE(tongTienThu.tongTien, 0)
    )
        THROW 53603, N'Không được làm mất giao dịch đã bảo đảm cho biên lai', 1;
END;
GO

-- =============================================================================
-- trgCaLamViecKhongTrung
-- Chặn ca chưa hủy giao nhau trong lịch của cùng nhân viên.
-- Khóa nhân viên theo mã, cùng cách với SP phân ca; kiểm tra mọi dòng trong lô.
-- Hai ca liền kề được phép. DELETE chỉ giải phóng lịch nên không cần trigger.
-- =============================================================================
CREATE TRIGGER dbo.trgCaLamViecKhongTrung ON dbo.CaLamViecNhanVien
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @maNhanVienDaKhoa NVARCHAR(10);
    SELECT @maNhanVienDaKhoa = nhanVien.maNhanVien
    FROM dbo.NhanVien nhanVien WITH (UPDLOCK, HOLDLOCK)
    WHERE nhanVien.maNhanVien IN (
        SELECT maNhanVien
        FROM inserted
        UNION
        SELECT maNhanVien
        FROM deleted
    )
    ORDER BY nhanVien.maNhanVien;
    IF EXISTS (
        SELECT 1
        FROM inserted caDuocGan
        WHERE caDuocGan.trangThai <> N'Đã hủy'
            AND dbo.fnKiemTraTrungCaLamViec(caDuocGan.maNhanVien, caDuocGan.thoiDiemBatDau, caDuocGan.thoiDiemKetThuc, caDuocGan.maCaLamViecNhanVien) = 1
    )
        THROW 51004, N'Ca làm việc không được trùng thời gian của cùng nhân viên', 1;
END;
GO

-- =============================================================================
-- trgNhatKyKiemSoatKhongSua
-- Chặn sửa sự kiện audit đã ghi; điều chỉnh phải ghi sự kiện mới.
-- DELETE vẫn dành cho reset demo/test được phép; ứng dụng không được ghi bảng trực tiếp.
-- =============================================================================
CREATE TRIGGER dbo.trgNhatKyKiemSoatKhongSua ON dbo.NhatKyKiemSoat
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 53605, N'Nhật ký kiểm soát không được sửa; hãy ghi một sự kiện mới', 1;
END;
GO

-- =============================================================================
-- trgYeuCauPheDuyetKhongTuDuyet
-- Chặn người yêu cầu tự phê duyệt yêu cầu của chính mình.
-- So sánh nhị phân kèm độ dài để kiểm tra chính xác định danh hai người.
-- =============================================================================
CREATE TRIGGER dbo.trgYeuCauPheDuyetKhongTuDuyet ON dbo.YeuCauPheDuyet
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE nguoiPheDuyet IS NOT NULL
            AND nguoiYeuCau COLLATE Latin1_General_100_BIN2 = nguoiPheDuyet COLLATE Latin1_General_100_BIN2
            AND DATALENGTH(nguoiYeuCau) = DATALENGTH(nguoiPheDuyet)
    )
        THROW 53606, N'Người yêu cầu không được tự phê duyệt', 1;
END;
GO

-- =============================================================================
-- trgButToanTaiChinhKhongSua
-- Chặn sửa bút toán đã ghi; điều chỉnh phải tạo bút toán mới.
-- DELETE vẫn dành cho reset demo/test được phép; ứng dụng không được ghi bảng trực tiếp.
-- =============================================================================
CREATE TRIGGER dbo.trgButToanTaiChinhKhongSua ON dbo.ButToanTaiChinh
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 53607, N'Bút toán tài chính không được sửa; hãy tạo bút toán điều chỉnh', 1;
END;
GO

-- =============================================================================
-- trgLichSuHangThanhVienKhongSua
-- Chặn sửa lịch sử hạng thành viên; thay đổi phải ghi dòng lịch sử mới.
-- DELETE vẫn dành cho reset demo/test được phép; ứng dụng không được ghi bảng trực tiếp.
-- =============================================================================
CREATE TRIGGER dbo.trgLichSuHangThanhVienKhongSua ON dbo.LichSuHangThanhVien
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 53608, N'Lịch sử hạng thành viên không được sửa; hãy ghi lần thay đổi mới', 1;
END;
GO

-- =============================================================================
-- trgDatDichVuDungKhungGioBuaAn
-- Chặn giờ dùng bữa nằm ngoài khung giờ phục vụ của bữa trưa/bữa tối.
-- =============================================================================
CREATE TRIGGER dbo.trgDatDichVuDungKhungGioBuaAn ON dbo.DatDichVuKhachSan
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted
        WHERE(
            buoiAn = N'Bữa trưa'
            AND (
                CAST(thoiDiemDuKien AS TIME) < '11:30:00'
                OR CAST(thoiDiemDuKien AS TIME) > '14:00:00'
            )
        )
            OR (
                buoiAn = N'Bữa tối'
                AND (
                    CAST(thoiDiemDuKien AS TIME) < '18:00:00'
                    OR CAST(thoiDiemDuKien AS TIME) > '22:00:00'
                )
            )
    )
        THROW 53609, N'Giờ dùng bữa phải nằm trong khung giờ phục vụ đã công bố', 1;
END;
GO

-- =============================================================================
-- trgDatDichVuTrongKyLuuTru
-- Chặn giờ dịch vụ nằm ngoài khoảng lưu trú của phòng trong booking.
-- Bao gồm giờ nhận phòng, không bao gồm giờ trả phòng: [nhận, trả).
-- =============================================================================
CREATE TRIGGER dbo.trgDatDichVuTrongKyLuuTru ON dbo.DatDichVuKhachSan
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted dichVuDat
        JOIN dbo.ChiTietDatPhong phongDat
            ON phongDat.maPhieuDatPhong = dichVuDat.maPhieuDatPhong
            AND phongDat.maPhong = dichVuDat.maPhong
        WHERE dichVuDat.trangThai IN (N'Chờ thanh toán', N'Đã xác nhận')
            AND (
                dichVuDat.thoiDiemDuKien < phongDat.thoiDiemNhanPhong
                OR dichVuDat.thoiDiemDuKien >= phongDat.thoiDiemTraPhong
                OR dichVuDat.thoiDiemKetThuc > phongDat.thoiDiemTraPhong
            )
    )
        THROW 53610, N'Thời gian dịch vụ phải nằm trọn trong kỳ lưu trú', 1;
END;
GO

-- =============================================================================
-- trgDatDichVuChiDungKhiDangO
-- Chỉ cho ghi dịch vụ đã sử dụng khi booking đang ở trạng thái đã nhận phòng.
-- =============================================================================
CREATE TRIGGER dbo.trgDatDichVuChiDungKhiDangO ON dbo.DatDichVuKhachSan
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted dichVuDat
        JOIN dbo.PhieuDatPhong phieuDatPhong
            ON phieuDatPhong.maPhieuDatPhong = dichVuDat.maPhieuDatPhong
        WHERE dichVuDat.trangThai = N'Đã sử dụng'
            AND phieuDatPhong.trangThai <> N'Đã nhận phòng'
    )
        THROW 53611, N'Chỉ được ghi nhận dịch vụ đã sử dụng khi khách đang nhận phòng', 1;
END;
GO
