# Test bàn giao ca Kế toán local

Chạy `seed_lehuy_demo.sql` trên `QLKS_LeHuy_Local` bằng lệnh trong đầu file.
Phần 5 trong file bổ sung tài khoản và lịch hôm nay cùng hai ngày tiếp theo; giữ nguyên
số dư, mật khẩu ACCOUNTING và các lịch hiện có. Các phần còn lại là mẫu Kho / Dịch vụ;
xem [LEHUY_LOCAL.md](LEHUY_LOCAL.md). Có thể chạy lại, không reset DB.

| Đăng nhập | Ca đang bàn giao | Người nhận dự kiến |
|---|---|---|
| ACCOUNTING | Ca sáng, 06:00–14:00 | ACCNEXT1, ca chiều 14:00–22:00 |
| ACCNEXT1 | Ca chiều, 14:00–22:00 | ACCNEXT2, ca đêm 22:00–06:00 hôm sau |
| ACCNEXT2 | Ca đêm, 22:00–06:00 hôm sau | ACCOUNTING, ca sáng hôm sau |

Hai tài khoản mới dùng mật khẩu demo hiện tại của ACCOUNTING (`hotel123` nếu chưa đổi).
Trong **Tổng quan & Bàn giao**, chọn **Ghi nhận bàn giao**, chọn đúng ca trong bảng,
chọn người nhận và nhập số tiền thực đếm. Nếu lệch số dư dự kiến, phải nhập lý do.
Nhân viên mới có số dư 0đ cho đến khi nhận bàn giao hoặc phát sinh thu tiền mặt.
Script không tự tạo tiền hoặc ghi biên bản bàn giao.

Nếu ca đã bàn giao trong ngày thì không thể ghi lần hai cho cùng người và ca;
hãy test tài khoản/ca chưa bàn giao. Lịch bị trùng hoặc đã tồn tại được giữ nguyên,
nên kiểm tra bảng kết quả sau khi chạy nếu không thấy người nhận mong đợi.
