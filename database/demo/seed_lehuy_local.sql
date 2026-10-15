-- Run with sqlcmd -b -I -f 65001 from the repository root.
-- This entry point is only for the separate, empty Le Huy demo database.
:On Error exit
SET NOCOUNT ON;
IF DB_NAME() <> N'QLKS_LeHuy_Local'
    THROW 51000, N'Chỉ nạp dữ liệu này vào QLKS_LeHuy_Local; không dùng QLKS hoặc database dùng chung.', 1;

IF EXISTS (SELECT 1 FROM dbo.NhanVien)
    OR EXISTS (SELECT 1 FROM dbo.Phong)
    OR EXISTS (SELECT 1 FROM dbo.DichVu)
    OR EXISTS (SELECT 1 FROM dbo.KhachLuuTru)
    THROW 51000, N'Database đã có dữ liệu. Từ chối reset tự động; chỉ chạy seed_inventory.sql để bổ sung hàng mẫu.', 1;
GO

:r database/demo/reset_demo.sql
:r database/demo/seed_inventory.sql
:r database/demo/seed_service_schedule.sql
:r database/demo/seed_service_schedule_bookings.sql
