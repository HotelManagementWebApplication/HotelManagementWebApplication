# Phiếu biến động kho

Trang lịch sử chỉ còn nút Xuất phiếu. Popup chọn Xuất tất cả hoặc Xuất riêng
từng biến động; phạm vi lấy từ danh sách đang lọc. Xuất tất cả in một bộ gồm
nhiều phiếu A4, mỗi biến động một phiếu riêng, không cộng các đơn vị khác nhau.
Có thể chọn từng phiếu để xem trước và bổ sung bên giao/nhận, nguồn/đích, chứng từ.
Những thông tin bổ sung này chỉ dùng trên bản in, không thay đổi giao dịch đã lưu.

Tên phiếu là Phiếu biến động kho, đơn vị Kho và Dịch vụ, không có mã biểu mẫu.
Số phiếu BDK dùng ID biến động. Người thực hiện lấy từ actor của biến động, tra
họ tên nhân viên, không lấy người đang xem hay đang xuất PDF. Nhập/hoàn kho điền
người thực hiện vào bên nhận; xuất/hao hụt điền vào bên giao; điều chỉnh theo dấu
số lượng. Hai bên có tên và vùng ký trống để ký thực tế. Không tạo chữ ký tự động.

API danh sách biến động bổ sung actor_name, stock_before, stock_after. Phần tồn
trước/sau được dựng từ tồn hiện tại và ledger, sắp theo thời điểm rồi ID để ổn
định cả khi nhiều giao dịch cùng thời điểm. Đây là số liệu truy ngược ledger,
không có snapshot độc lập; việc sửa tồn ngoài ledger sẽ ảnh hưởng kết quả.
Không đổi migration/schema hay dữ liệu local. Giá trên phiếu ghi rõ đơn giá tham
chiếu của danh mục lúc xuất phiếu, vì ledger hiện chưa lưu giá nhập lịch sử.

Nút In / Lưu PDF in document riêng trong iframe; mỗi phiếu ngắt trang, tránh in
cả giao diện ứng dụng. Dữ liệu được escape trước khi đưa vào HTML bản in.
Chọn máy in hoặc Lưu dưới dạng PDF ở hộp thoại in của trình duyệt.
