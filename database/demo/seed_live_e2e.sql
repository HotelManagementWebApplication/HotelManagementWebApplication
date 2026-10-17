-- Dữ liệu bổ sung cố định cho bộ kiểm tra hợp đồng HTTP chạy thật.
-- Chạy sau reset_demo.sql, chỉ trong database tạm có tên e2e_<name>.
IF DB_NAME() NOT LIKE N'e2e[_]%'
BEGIN
    THROW 51000, N'Từ chối nạp fixture E2E ngoài database e2e_<name> dùng tạm.', 1;
END;

BEGIN TRANSACTION;

-- Demo giao diện đánh dấu nhiệm vụ phòng 702 có sự cố chặn bàn giao.
-- Kịch bản E2E này bỏ cờ chặn để kiểm tra nhánh hoàn thành kỹ thuật.
UPDATE NhiemVuBuongPhong
SET coSuCoChan = 0
WHERE maPhong = N'702'
    AND trangThai = N'Chờ kỹ thuật'
    AND daHoanThanhChecklist = 1;

-- Đóng phiếu sửa chữa demo cũ để kịch bản bàn giao chỉ có một phiếu còn hoạt động.
UPDATE PhieuCongViecKyThuat
SET trangThai = N'Đã bàn giao phòng', thoiDiemCapNhat = SYSDATETIME()
WHERE maPhong = N'702'
    AND vatTuSuDung <> N'E2E_FIXTURE_TECHNICAL_ORDER'
    AND trangThai IN (N'Mới tạo', N'Đã xác nhận', N'Đang thực hiện', N'Chờ nghiệm thu', N'Đã hoàn thành');

-- Xóa fixture cùng nhãn trước khi tạo lại để chạy lại không sinh thêm phiếu.
DELETE FROM PhieuCongViecKyThuat
WHERE vatTuSuDung = N'E2E_FIXTURE_TECHNICAL_ORDER';

-- Chọn thiết bị điều hòa có mã nhỏ nhất để kết quả fixture ổn định.
INSERT INTO PhieuCongViecKyThuat(
    maPhong,
    maThietBiPhong,
    nguoiDuocPhanCong,
    doUuTien,
    thoiHanSla,
    vatTuSuDung,
    ghiChuKetQua,
    ghiChuNghiemThu,
    nguoiNghiemThu,
    thoiDiemNghiemThu,
    trangThai,
    nguoiTao,
    thoiDiemTao,
    thoiDiemCapNhat
)
SELECT TOP (1)
    N'702',
    maThietBiPhong,
    N'TECHNICAL',
    N'Cao',
    DATEADD(DAY, 1, SYSDATETIME()),
    N'E2E_FIXTURE_TECHNICAL_ORDER',
    NULL,
    NULL,
    NULL,
    NULL,
    N'Mới tạo',
    N'FRONTDESK',
    SYSDATETIME(),
    SYSDATETIME()
FROM ThietBiPhong
WHERE maPhong = N'702'
    AND ten = N'Điều hòa'
ORDER BY maThietBiPhong;

COMMIT;
