# Trả hàng từ Buồng phòng về Kho

Buồng phòng (`HOUSEKEEPING`) mở **Trả hàng về Kho**, chọn mặt hàng, số lượng,
phòng trả nếu có và lý do. Gửi yêu cầu chỉ tạo trạng thái **Chờ duyệt**, chưa cộng tồn.

Nhân viên Kho (`KITCHEN`) mở **Duyệt trả kho**, kiểm đếm rồi duyệt hoặc từ chối.
Duyệt ghi một biến động `RETURN` / `Hoàn kho` và cộng tồn trong cùng transaction.
Từ chối bắt buộc có lý do và giữ nguyên tồn. Yêu cầu đã quyết định không thể đổi
sang quyết định ngược lại; duyệt lặp hoặc đồng thời không cộng thêm tồn.

Buồng phòng chỉ xem yêu cầu của chính mình. Kho xem hàng đợi chung. Không được
tự duyệt yêu cầu đã gửi, kể cả người gửi đã chuyển bộ phận. Mặt hàng trả thuộc
Món ăn, Thức uống hoặc Vật dụng phòng; các dịch vụ như Spa không được gửi trả.

## API

| Endpoint | Quyền | Hành vi |
| --- | --- | --- |
| `GET /api/operations/stock-returns` | Buồng phòng / Kho | Danh sách theo phạm vi actor |
| `GET /api/operations/stock-returns/catalog` | Buồng phòng / Kho | Danh mục hàng được gửi trả |
| `POST /api/operations/stock-returns` | Buồng phòng | Body: `service_id`, `quantity`, `room_id` tùy chọn, `reason`; bắt buộc `Idempotency-Key` |
| `POST /api/operations/stock-returns/{id}/approve` | Kho | Body `{ "reason": "Đã kiểm đếm" }`; ghi chú tùy chọn |
| `POST /api/operations/stock-returns/{id}/reject` | Kho | Body có `reason` bắt buộc |

Yêu cầu gửi lại cùng khóa và cùng dữ liệu trả về cùng ID; đổi dữ liệu với khóa
cũ bị từ chối. Endpoint quyết định dùng chính ID yêu cầu để chống thực hiện lặp.
`POST /api/services/{id}/inventory-movements` với `type=RETURN` trả
`RETURN_APPROVAL_REQUIRED`; không dùng endpoint cũ để bỏ qua phê duyệt.

Popup Kho chỉ còn **Nhập kho**, **Xuất kho**, **Hao hụt**. Chọn phòng nhận chỉ
hiện khi Xuất kho. API `ADJUST` vẫn giữ cho các caller hiện hữu ngoài popup này;
không còn lựa chọn Điều chỉnh kiểm kê trong popup Kho.

## Database demo

Định nghĩa bảng `YeuCauTraKho` ở V1, view ở V4 và thủ tục lệnh ở V5. Không có
migration bổ sung ngoài sáu file canonical. Sau thay đổi baseline, dựng lại
database demo/test đã được cho phép; không sửa checksum Flyway. Khi reset dữ
liệu demo, xóa yêu cầu trả kho trước danh mục dịch vụ.
