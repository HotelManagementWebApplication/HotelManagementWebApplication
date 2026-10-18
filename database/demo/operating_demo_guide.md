# Thử chức năng với bộ dữ liệu hoạt động

Các mẫu đã nạp vào `QLKS` ngày 18/10/2026:

| Muốn thử | Mẫu có thể mở |
|---|---|
| Khách đang ở, thêm dịch vụ/chuyển phòng/checkout | Phòng **1801**, booking **10162**, khách `0899000061` |
| Nhận phòng | Phòng **1101**, booking **10182**; phòng **1901**, booking **10183** |
| Nhận phòng khách Vàng | Phòng **2002**, booking **10184**, khách `0899000002` |
| Thu nợ sau checkout | Booking **10018**, hóa đơn **10018**, còn **7.162.000đ** lúc nạp |
| Bắt đầu dọn | Phòng **503**, **504**, **603** |
| Tiếp tục checklist | Phòng **604**, **703** |
| Nghiệm thu vệ sinh | Phòng **704**, **803** |
| Xử lý sự cố/kỹ thuật | Phòng **804**, **901**, **902** |

Các ID/số dư trên là ảnh chụp lúc nạp; sẽ thay đổi khi thử thao tác. Nạp vào
database khác có thể sinh ID khác.

Bộ bổ sung giữ các tài khoản demo chính: `FRONTDESK`, `HOUSEKEEP`, `TECHNICAL`,
`KHO` (bí danh tài khoản nội bộ `KITCHEN`), `ACCOUNTING`, `MANAGER`, `DIRECTOR`, `HR`, `ADMIN`. Mật khẩu demo gốc
là `hotel123`; nếu đã đổi mật khẩu một tài khoản thì dùng mật khẩu đã đổi.
Script không đặt lại các tài khoản đó. Các nhân viên mới dùng cùng mật khẩu
với tài khoản demo gốc của bộ phận; khách mới dùng cùng mật khẩu với tài khoản
khách demo đầu tiên.

## Lễ tân và khách hàng

| Tình huống lúc nạp | Dữ liệu được thêm | Có thể thử |
|---|---:|---|
| Khách đang ở | 20 booking | Thêm dịch vụ, gia hạn, chuyển phòng, trả phòng/quyết toán |
| Đến hôm nay | 8 booking đã thu cọc | Nhận phòng; tiền cọc và khoản còn thu có sẵn |
| Đặt trước | 32 booking trong ba tuần | Tìm kiếm, lọc, xem lịch, hủy, thay đổi ngày |
| Chờ cọc tiền mặt | 6 booking giữ tạm 10 phút | Xác nhận đã nhận tiền hoặc chờ hết hạn nhả phòng |
| Lịch sử | 160 lượt trong vài tháng | Xem hóa đơn, dịch vụ, biên lai, khách cũ và báo cáo |
| Đã hủy/không đến | 10/2 booking | Tra cứu trạng thái, đối chiếu khoản cọc bị mất của no-show |

Một số booking đã checkout vẫn còn nợ, dùng để mở lại hóa đơn và thu phần còn
thiếu. Phòng sẵn sàng vẫn được giữ lại để tạo booking mới/chuyển phòng.

Tài khoản khách `0899000061` có lượt đang lưu trú và dịch vụ liên quan.
`0899000001`, `0899000002`, `0899000003` lần lượt có 50, 25, 10 lượt hoàn tất,
ứng với Bạch kim, Vàng, Bạc. Các số điện thoại còn lại từ `0899000004` tới
`0899000080` là hồ sơ mẫu. Có thể đăng nhập portal bằng mật khẩu khách demo gốc.

## Buồng phòng và kỹ thuật

- `HOUSEKEEP` có cả phòng chưa nhận việc và phòng đang dọn, kèm checklist chưa
  hoàn thành; đánh dấu từng mục rồi bàn giao vệ sinh.
- Có phòng đã dọn chờ quản lý nghiệm thu; phòng chờ kỹ thuật có sự cố cao và
  không thể mở bán khi chưa xử lý đúng quy trình.
- `TECHNICAL` có phiếu mới, đang làm, chờ nghiệm thu và lịch sử đã bàn giao.
  Có SLA đã quá hạn để xem cảnh báo.
- Mỗi phòng có thêm thiết bị còn thiếu trong danh mục, cùng tài sản điều hòa
  và ngày bảo trì. Màn hình tài sản có đủ Tốt, Cần bảo trì, Đang sửa chữa.
- Minibar và đồ vải có yêu cầu cấp/trả/báo hỏng chờ tài khoản `KHO` xử lý.

## Kho và dịch vụ

- Thêm 8 mặt hàng: nước khoáng, bia, snack, nước trái cây, găng tay, túi rác,
  chăn dự phòng và dung dịch lau kính. Có mặt hàng đủ tồn, thấp hơn ngưỡng và
  hết hàng để thử lọc/cảnh báo/nhập hàng.
- Giao dịch cấp hàng đầu ca đã duyệt và yêu cầu bổ sung, trả hàng, báo hỏng
  đang chờ duyệt. Các chứng từ kho liên kết với số tồn và lưu vết.
- Nhà hàng có bữa ăn miễn phí đã xác nhận trong quyền lợi lưu trú; giặt nhanh
  và massage có đơn đã dùng, đã trả tiền chờ dùng, chờ thanh toán, đã hủy sau
  khi trả tiền. Hồ bơi là tiện ích xem thông tin, không tạo lượt đặt giả.
- Có đề xuất giá chờ quản lý duyệt; không tự thay giá hiện hành của dịch vụ.

## Kế toán, quản lý và giám đốc

- Hóa đơn đã thanh toán và còn nợ; thu tiền mặt, thẻ, chuyển khoản; biên lai
  và sổ tài chính khớp các khoản thu. Cọc không bị trừ hai lần.
- Thêm 32 hóa đơn VAT, gồm cá nhân/doanh nghiệp, bản nháp/đã phát hành. Giá đã
  bao gồm VAT; cơ sở trước thuế được tách từ tổng hóa đơn.
- Thêm 30 khoản chi, 12 công nợ nhà cung cấp ở ba trạng thái, thanh toán từng
  phần/toàn bộ, cùng bàn giao tiền mặt chờ/đã xác nhận và bảng mệnh giá.
- Booking qua AGODA/BOOKING_COM có doanh thu gộp, hoa hồng và trạng thái đối
  soát để thử bộ lọc OTA. Biểu đồ doanh thu có dữ liệu nhiều tháng.

## Nhân sự và quản trị

- Thêm 24 nhân viên cho các bộ phận, có hồ sơ cá nhân, hợp đồng, ngày vào làm,
  lịch ca ba tuần và chấm công hai tuần. Có bản ghi đi muộn.
- Có 12 đơn nghỉ phép ở trạng thái chờ duyệt, đã duyệt, bị từ chối. Lịch làm
  việc trùng với ngày nghỉ đã duyệt được hủy đúng trạng thái.
- Có 6 đề nghị tiếp nhận: nháp, chờ duyệt, cần bổ sung, bị từ chối. Người gửi
  là HR; tài khoản ứng viên chưa được tạo trước khi được duyệt.
- Nhật ký đăng nhập mẫu có thành công/thất bại; toàn bộ lần nạp có audit marker.

Hãy nạp bằng `populate_operating_demo.ps1 -PopulateExistingDemo`. Lần nạp sau
không ghi đè các tình huống đã thử; các yêu cầu chưa trả tiền vẫn hết hạn theo
thời gian thực. Backup và log nằm ngoài repo tại
`%USERPROFILE%\.codex\backups\web-hotel-mis`.
