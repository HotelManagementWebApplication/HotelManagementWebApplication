# Đề xuất Kho và Dịch vụ

Trang Đề xuất mở popup chọn đổi giá hoặc thêm danh mục. Popup thêm mới chỉ có
Dịch vụ và Danh mục kho. Form đổi giá chọn được cả dịch vụ đang bán và hàng nội bộ.

Đổi giá tiếp tục dùng API và quy trình SERVICE_PRICE_CHANGE hiện có. Thêm mới dùng
POST `/api/services/catalog-proposals`, GET cùng đường dẫn chỉ trả yêu cầu của
nhân viên đang đăng nhập. Body gồm kind SERVICE/WAREHOUSE, id, name, unit,
category, price và reason. Idempotency-Key bắt buộc, mã tối đa 10 ký tự A–Z/0–9,
tên tối đa 100 ký tự, giá 0–99.999.999,99, lý do tối đa 300 ký tự.

Yêu cầu mới dùng action SERVICE_CATALOG_CREATE trong hàng đợi phê duyệt hiện có.
Nhân viên không tự duyệt. Khi Quản lý duyệt, cùng một transaction tiêu thụ approval,
tạo danh mục và ghi audit. Retry cùng key không tạo trùng. Từ chối không tạo danh mục.
SKU đã tồn tại làm toàn bộ thao tác duyệt rollback. Hàng Kho có active=false để
không xuất hiện trên cổng khách hàng; dịch vụ được kích hoạt sau duyệt. Tồn đầu kỳ
bằng 0, nhập kho qua phiếu riêng. Dịch vụ mới chưa có cấu hình công suất/lịch sẽ
hiện “Chưa cấu hình lịch”, không tự lấy đơn vị tính giá làm tài nguyên khả dụng.

Schema thuộc V1 và thủ tục tạo hàng Kho thuộc V5; giữ đúng sáu migration.
Backend test CatalogProposalHttpTest kiểm tra tạo sau duyệt, nội bộ/công khai,
retry, từ chối, không tự duyệt, phân quyền và validation. KitchenInventory.test.tsx
kiểm tra popup, bỏ lựa chọn Sản phẩm và payload gửi thật tới API.
