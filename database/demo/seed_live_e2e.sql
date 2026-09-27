-- Deterministic add-on fixtures for the live HTTP contract suite.
-- Run only after reset_demo.sql in a disposable database named e2e_<name>.
IF DB_NAME() NOT LIKE N'e2e[_]%'
BEGIN
    THROW 51000, N'Từ chối nạp fixture E2E ngoài database e2e_<name> dùng tạm.', 1;
END;

BEGIN TRANSACTION;

-- The seeded housekeeping handoff is intentionally marked as blocked for the UI demo.
-- The isolated E2E fixture exercises the no-blocker technical-completion path.
UPDATE NhiemVuBuongPhong
SET coSuCoChan = 0
WHERE maPhong = N'702' AND trangThai = N'Chờ kỹ thuật' AND daHoanThanhChecklist = 1;

-- The demo screen has an older open repair on this room. Close it only in the
-- disposable E2E fixture so the release scenario has exactly one active order.
UPDATE PhieuCongViecKyThuat
SET trangThai = N'Đã bàn giao phòng', thoiDiemCapNhat = SYSDATETIME()
WHERE maPhong = N'702'
  AND vatTuSuDung <> N'E2E_FIXTURE_TECHNICAL_ORDER'
  AND trangThai IN (N'Mới tạo', N'Đã xác nhận', N'Đang thực hiện', N'Chờ nghiệm thu', N'Đã hoàn thành');

DELETE FROM PhieuCongViecKyThuat
WHERE vatTuSuDung = N'E2E_FIXTURE_TECHNICAL_ORDER';

INSERT INTO PhieuCongViecKyThuat
    (maPhong, maThietBiPhong, nguoiDuocPhanCong, doUuTien, thoiHanSla, vatTuSuDung,
     ghiChuKetQua, ghiChuNghiemThu, nguoiNghiemThu, thoiDiemNghiemThu, trangThai,
     nguoiTao, thoiDiemTao, thoiDiemCapNhat)
SELECT TOP (1) N'702', maThietBiPhong, N'TECHNICAL', N'Cao', DATEADD(DAY, 1, SYSDATETIME()),
       N'E2E_FIXTURE_TECHNICAL_ORDER', NULL, NULL, NULL, NULL, N'Mới tạo',
       N'FRONTDESK', SYSDATETIME(), SYSDATETIME()
FROM ThietBiPhong
WHERE maPhong = N'702' AND ten = N'Điều hòa'
ORDER BY maThietBiPhong
;

COMMIT;
