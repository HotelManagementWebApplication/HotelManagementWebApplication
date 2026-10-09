-- V6__triggers.sql
-- Database integrity and business-rule triggers; business commands stay in V5.
-- Contents:
--   trgBienLaiBaoDamTienThu (BienLai)
--   trgThanhToanBaoDamBienLai (GiaoDichThanhToan)
--   trgCaLamViecKhongTrung (CaLamViecNhanVien)
--   trgNhatKyKiemSoatKhongSua (NhatKyKiemSoat)
--   trgYeuCauPheDuyetKhongTuDuyet (YeuCauPheDuyet)
--   trgButToanTaiChinhKhongSua (ButToanTaiChinh)
--   trgLichSuHangThanhVienKhongSua (LichSuHangThanhVien)
--   trgDatDichVuDungKhungGioBuaAn (DatDichVuKhachSan)
--   trgDatDichVuTrongKyLuuTru (DatDichVuKhachSan)
--   trgDatDichVuChiDungKhiDangO (DatDichVuKhachSan)

-- =============================================================================
-- Financial integrity triggers. Procedures own authorization, audit and net
-- refundable/receiptable balances. Triggers guard historical receipt coverage
-- by gross completed collections, including multi-row INSERT/UPDATE/DELETE.
-- A refund never erases the original receipt; deleting or moving its funding
-- payment must not leave an unfunded receipt. No audit side effects here.
-- =============================================================================
CREATE TRIGGER dbo.trgBienLaiBaoDamTienThu ON dbo.BienLai
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @locked BIGINT;
 SELECT @locked=h.maHoaDon FROM dbo.HoaDon h WITH(UPDLOCK,HOLDLOCK)
 WHERE h.maHoaDon IN(SELECT maHoaDon FROM inserted UNION SELECT maHoaDon FROM deleted)
 ORDER BY h.maHoaDon;
 IF EXISTS(
  SELECT 1 FROM (SELECT DISTINCT maHoaDon,phuongThuc FROM inserted) affected
  OUTER APPLY(SELECT SUM(b.soTien) amount FROM dbo.BienLai b
   WHERE b.maHoaDon=affected.maHoaDon AND b.phuongThuc=affected.phuongThuc) receipts
  OUTER APPLY(SELECT SUM(p.soTien) amount FROM dbo.GiaoDichThanhToan p
   WHERE p.maHoaDon=affected.maHoaDon AND p.phuongThuc=affected.phuongThuc
    AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất') payments
  WHERE COALESCE(receipts.amount,0)>COALESCE(payments.amount,0))
  THROW 53601,N'Tổng biên lai vượt tiền đã thu theo hóa đơn và phương thức',1;
END;
GO

CREATE TRIGGER dbo.trgThanhToanBaoDamBienLai ON dbo.GiaoDichThanhToan
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @locked BIGINT;
 SELECT @locked=h.maHoaDon FROM dbo.HoaDon h WITH(UPDLOCK,HOLDLOCK)
 WHERE h.maHoaDon IN(SELECT maHoaDon FROM inserted UNION SELECT maHoaDon FROM deleted)
 ORDER BY h.maHoaDon;
 IF EXISTS(
  SELECT 1 FROM (SELECT maHoaDon,phuongThuc FROM inserted UNION SELECT maHoaDon,phuongThuc FROM deleted) affected
  OUTER APPLY(SELECT SUM(b.soTien) amount FROM dbo.BienLai b
   WHERE b.maHoaDon=affected.maHoaDon AND b.phuongThuc=affected.phuongThuc) receipts
  OUTER APPLY(SELECT SUM(p.soTien) amount FROM dbo.GiaoDichThanhToan p
   WHERE p.maHoaDon=affected.maHoaDon AND p.phuongThuc=affected.phuongThuc
    AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất') payments
  WHERE COALESCE(receipts.amount,0)>COALESCE(payments.amount,0))
  THROW 53603,N'Không được làm mất giao dịch đã bảo đảm cho biên lai',1;
END;
GO

-- =============================================================================
-- Shift overlap is a cross-row invariant, not expressible as a row CHECK.
-- INSERT and UPDATE can create an overlap (including reactivating a cancelled
-- shift or moving it to another employee). DELETE only releases capacity and
-- therefore needs no trigger. Adjacent half-open intervals remain valid.
-- Procedures take the same employee lock before changing shifts; this guard
-- also checks every inserted row in a batch. No audit or reset bypass here.
-- =============================================================================
CREATE TRIGGER dbo.trgCaLamViecKhongTrung ON dbo.CaLamViecNhanVien
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @locked NVARCHAR(10);
 SELECT @locked=n.maNhanVien FROM dbo.NhanVien n WITH(UPDLOCK,HOLDLOCK)
 WHERE n.maNhanVien IN(SELECT maNhanVien FROM inserted UNION SELECT maNhanVien FROM deleted)
 ORDER BY n.maNhanVien;
 IF EXISTS(SELECT 1 FROM inserted i
  WHERE i.trangThai<>N'Đã hủy'
   AND dbo.fnKiemTraTrungCaLamViec(i.maNhanVien,i.thoiDiemBatDau,i.thoiDiemKetThuc,i.maCaLamViecNhanVien)=1)
  THROW 51004,N'Ca làm việc không được trùng thời gian của cùng nhân viên',1;
END;
GO

-- =============================================================================
-- Governance guards. Audit entries are append-only from the application's
-- perspective: corrections must be new events, never rewrites of old evidence.
-- Demo/test cleanup can still DELETE its own rows; production writers have no
-- direct table permission. Approval decisions additionally keep requester and
-- approver separated even when a caller bypasses the V5 command procedure.
-- =============================================================================
CREATE TRIGGER dbo.trgNhatKyKiemSoatKhongSua ON dbo.NhatKyKiemSoat
AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 THROW 53605,N'Nhật ký kiểm soát không được sửa; hãy ghi một sự kiện mới',1;
END;
GO

CREATE TRIGGER dbo.trgYeuCauPheDuyetKhongTuDuyet ON dbo.YeuCauPheDuyet
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted
  WHERE nguoiPheDuyet IS NOT NULL
   AND nguoiYeuCau COLLATE Latin1_General_100_BIN2=nguoiPheDuyet COLLATE Latin1_General_100_BIN2
   AND DATALENGTH(nguoiYeuCau)=DATALENGTH(nguoiPheDuyet))
  THROW 53606,N'Người yêu cầu không được tự phê duyệt',1;
END;
GO

-- =============================================================================
-- Immutable histories. A financial posting or membership-tier transition is
-- corrected by an explicit compensating/new row, never by rewriting evidence.
-- DELETE remains available to the authorized demo/test reset path; production
-- application writers do not receive direct table permissions.
-- =============================================================================
CREATE TRIGGER dbo.trgButToanTaiChinhKhongSua ON dbo.ButToanTaiChinh
AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 THROW 53607,N'Bút toán tài chính không được sửa; hãy tạo bút toán điều chỉnh',1;
END;
GO

CREATE TRIGGER dbo.trgLichSuHangThanhVienKhongSua ON dbo.LichSuHangThanhVien
AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 THROW 53608,N'Lịch sử hạng thành viên không được sửa; hãy ghi lần thay đổi mới',1;
END;
GO

-- =============================================================================
-- Hotel-service booking guards. V5 procedures remain the command boundary;
-- these triggers preserve the same invariants for batch DML and accidental
-- direct writes. Scheduled service uses the half-open stay interval [from,to).
-- =============================================================================
CREATE TRIGGER dbo.trgDatDichVuDungKhungGioBuaAn ON dbo.DatDichVuKhachSan
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted
  WHERE (buoiAn=N'Bữa trưa' AND
         (CAST(thoiDiemDuKien AS TIME)<'11:30:00' OR CAST(thoiDiemDuKien AS TIME)>'14:00:00'))
     OR (buoiAn=N'Bữa tối' AND
         (CAST(thoiDiemDuKien AS TIME)<'18:00:00' OR CAST(thoiDiemDuKien AS TIME)>'22:00:00')))
  THROW 53609,N'Giờ dùng bữa phải nằm trong khung giờ phục vụ đã công bố',1;
END;
GO

CREATE TRIGGER dbo.trgDatDichVuTrongKyLuuTru ON dbo.DatDichVuKhachSan
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i
  JOIN dbo.ChiTietDatPhong c ON c.maPhieuDatPhong=i.maPhieuDatPhong AND c.maPhong=i.maPhong
  WHERE i.thoiDiemDuKien<c.thoiDiemNhanPhong OR i.thoiDiemDuKien>=c.thoiDiemTraPhong)
  THROW 53610,N'Thời gian dịch vụ phải nằm trong kỳ lưu trú',1;
END;
GO

CREATE TRIGGER dbo.trgDatDichVuChiDungKhiDangO ON dbo.DatDichVuKhachSan
AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i
  JOIN dbo.PhieuDatPhong p ON p.maPhieuDatPhong=i.maPhieuDatPhong
  WHERE i.trangThai=N'Đã sử dụng' AND p.trangThai<>N'Đã nhận phòng')
  THROW 53611,N'Chỉ được ghi nhận dịch vụ đã sử dụng khi khách đang nhận phòng',1;
END;
GO
