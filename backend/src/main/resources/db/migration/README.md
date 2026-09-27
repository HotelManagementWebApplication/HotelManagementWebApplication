# Flyway baseline SQL Server cho cơ sở dữ liệu demo

`V1__baseline_schema.sql` là baseline duy nhất của database demo. Khi dựng một
database demo mới, Flyway chỉ chạy V1. Mọi sửa đổi schema demo được cập nhật
trực tiếp trong V1 rồi database local được tạo lại; không tạo V2/V3. Các ràng
buộc miền giá trị, đối chiếu phân biệt dấu/chữ
hoa, bảng `HinhAnhLoaiPhong` và việc loại bỏ các cột suy ra đều nằm ngay trong V1.

Sau khi Flyway hoàn tất, nạp `database/demo/reset_demo.sql` để tạo dữ liệu mẫu.
Script này dùng các nhãn tiếng Việt cuối cùng và chèn ảnh loại phòng vào
`HinhAnhLoaiPhong`.

Nếu checksum V1 của database local lệch, xóa và dựng lại database demo; không
repair checksum và không thêm migration mới để vá dữ liệu demo.

Đích của V1 có 51 bảng nghiệp vụ, 459 cột, 51 khóa ngoại, 25 ràng buộc UNIQUE
và 121 ràng buộc CHECK. Tên bảng dùng PascalCase không dấu; tên cột dùng
camelCase không dấu. Tên lớp, thuộc tính Java và API giữ nguyên nhờ các ánh xạ
JPA tường minh. Giá trị nghiệp vụ lưu bằng tiếng Việt; bộ chuyển đổi giữ hợp
đồng mã Java/API ở những miền mã đã định nghĩa. Hibernate dùng `ddl-auto:
validate`.
