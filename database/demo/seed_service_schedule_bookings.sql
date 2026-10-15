-- Private Le Huy demo only. These reservations are samples for the time filter.
:On Error exit
IF DB_NAME()<>N'QLKS_LeHuy_Local' THROW 51000,N'Chỉ nạp lịch mẫu vào QLKS_LeHuy_Local.',1;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT dbo.DatDichVuKhachSan(maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,soLuong,soLuongMienPhi,donGia,trangThai,khoaYeuCau,maBamYeuCau,nguoiTao,ghiChu)
SELECT p.maPhieuDatPhong,p.maPhong,s.id,DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIME() AS DATE))),s.quantity,0,d.gia,N'Đã xác nhận',
    N'lehuy-schedule-'+s.id,REPLICATE(N'a',64),N'KITCHEN',N'Lịch mẫu kiểm tra công suất theo thời gian'
FROM (VALUES (N'BADMINTON',10,2),(N'BOARDROOM',8,1),(N'CITYTOUR',9,4),(N'SPAMASS',10,2),(N'EXTRABED',8,1)) s(id,hour,quantity)
JOIN dbo.DichVu d ON d.maDichVu=s.id
JOIN dbo.ChiTietDatPhong p ON p.maPhieuDatPhong=1 AND p.maPhong=N'501'
JOIN dbo.PhieuDatPhong r ON r.maPhieuDatPhong=p.maPhieuDatPhong
WHERE r.trangThai=N'Đã nhận phòng'
    AND DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIME() AS DATE)))>=p.thoiDiemNhanPhong
    AND DATEADD(HOUR,s.hour,CONVERT(DATETIME2(6),CAST(SYSDATETIME() AS DATE)))<p.thoiDiemTraPhong
    AND NOT EXISTS (SELECT 1 FROM dbo.DatDichVuKhachSan WITH(UPDLOCK,HOLDLOCK) WHERE khoaYeuCau=N'lehuy-schedule-'+s.id);
COMMIT TRANSACTION;
