# Từ điển nghiệp vụ Web Hotel MIS

## 1. Cách đọc tài liệu

Trong tài liệu, mã nằm trong dấu `` `...` `` là mã kỹ thuật đang được hệ thống
lưu hoặc trao đổi. Không tự ý đổi mã này chỉ vì muốn đổi chữ hiển thị. Ví dụ:

| Mã kỹ thuật | Nghĩa hiển thị |
|---|---|
| `DEPOSIT_PAID` | Đã thanh toán tiền cọc |
| `CHECKED_IN` | Đã nhận phòng |
| `ACTIVE` | Đang hoạt động |
| `AGODA` | Nguồn đặt phòng Agoda |

Mã tiếng Anh giúp backend, frontend, database và các cổng thanh toán nói cùng
một ngôn ngữ ổn định. Người dùng cuối chỉ nhìn thấy nhãn tiếng Việt.

## 2. Phạm vi kinh doanh

MaM Hotel vận hành dịch vụ lưu trú, nhà hàng và các dịch vụ phục vụ khách sạn.
Những booking dịch vụ thuộc phạm vi hệ thống phải gắn với khách/booking/phòng
theo quy tắc nghiệp vụ tương ứng.

Hệ thống không quản lý mô hình đối tác thuê mặt bằng, nhượng quyền, voucher
thương mại hoặc quyết toán hoa hồng cho bên thuê. Công nợ nhà cung cấp hàng
hóa/vật tư vẫn thuộc phạm vi kế toán và phải được phân biệt với công nợ hoặc
hoa hồng thương mại của đối tác.

## 3. Các thành phần của hệ thống

| Thuật ngữ trong code | Nghĩa tiếng Việt | Vai trò |
|---|---|---|
| `Frontend` | Giao diện người dùng | Website khách hàng và màn hình nghiệp vụ nội bộ |
| `Backend` | Phần máy chủ | Xử lý quy tắc, quyền hạn và lưu dữ liệu |
| `API` | Cổng giao tiếp dữ liệu | Cách frontend gửi yêu cầu và nhận kết quả từ backend |
| `Endpoint` | Địa chỉ chức năng API | Ví dụ `POST /api/customer/reservations` là tạo booking khách hàng |
| `Request` | Dữ liệu gửi lên | Thông tin cần để thực hiện một thao tác |
| `Response` | Dữ liệu trả về | Kết quả sau khi backend xử lý |
| `DTO` | Mẫu dữ liệu API | Lớp quy định frontend được gửi và nhận những trường nào |
| `Controller` | Bộ tiếp nhận API | Nhận request rồi chuyển cho phần xử lý nghiệp vụ |
| `Service` | Bộ xử lý nghiệp vụ | Kiểm tra điều kiện, tính tiền, đổi trạng thái và lưu dữ liệu |
| `Entity` | Mô hình dữ liệu | Đại diện cho một loại dữ liệu được lưu trong database |
| `Repository` / `DAO` | Bộ truy cập dữ liệu | Đọc và ghi database theo yêu cầu của service |
| `Database` | Cơ sở dữ liệu | Nơi lưu dữ liệu thật của hệ thống |
| `Migration` | Phiên bản thay đổi database | Script tạo bảng, thêm cột hoặc cập nhật cấu trúc |
| `Flyway` | Công cụ quản lý cấu trúc | Database demo chạy baseline `V1` duy nhất |
| `Schema` | Bộ cấu trúc database | Trong dự án hiện tại là schema `QLKS` |
| `Transaction` | Giao dịch nguyên tử | Một chuỗi thao tác thành công toàn bộ hoặc hoàn tác toàn bộ |
| `Validation` | Kiểm tra hợp lệ | Chặn dữ liệu thiếu, sai định dạng hoặc sai giới hạn |
| `Audit` / `Audit log` | Nhật ký kiểm soát | Ghi ai làm gì, lúc nào và trên dữ liệu nào |
| `Actor` | Người hoặc tài khoản thực hiện | Có thể là nhân viên, khách hàng hoặc hệ thống |
| `Ownership` | Quyền sở hữu dữ liệu | Khách chỉ được xem booking của chính mình |
| `JWT` / `Access token` | Vé xác thực đăng nhập | Backend dùng để biết người đang gọi API là ai |
| `Role` | Vai trò | Nhóm quyền của một tài khoản |
| `Permission` / `Capability` | Quyền chi tiết | Một thao tác cụ thể như xem phòng hoặc tạo reservation |
| `Idempotency` | Chống xử lý trùng | Gửi lại cùng một yêu cầu không tạo dữ liệu trùng |
| `Pagination` | Phân trang | Chia danh sách lớn thành nhiều trang nhỏ |
| `CRUD` | Tạo, xem, sửa, xóa | Bốn thao tác cơ bản trên dữ liệu |

## 4. Từ điển dữ liệu chính

| Mã trong hệ thống | Nghĩa nghiệp vụ |
|---|---|
| `Guest` | Hồ sơ người lưu trú hoặc người đặt phòng |
| `Customer` | Khách hàng sử dụng cổng đặt phòng trực tuyến |
| `CustomerAccount` | Tài khoản đăng nhập của khách hàng |
| `Employee` | Hồ sơ nhân viên khách sạn |
| `RoomType` | Hạng/loại phòng, ví dụ STD, SUP, DLX, SUT, VIP |
| `Room` | Một phòng cụ thể, ví dụ phòng 501 hoặc 601 |
| `Reservation` | Một lượt đặt phòng |
| `RoomStay` | Khoảng thời gian thuê một phòng trong booking |
| `Booking source` / `booking_source` | Nguồn phát sinh booking |
| `Rental type` / `rental_type` | Cách tính tiền: theo đêm hoặc theo giờ |
| `Service` | Dịch vụ bán hoặc cung cấp cho khách |
| `Invoice` | Hóa đơn thanh toán/folio của khách hoặc booking |
| `Payment transaction` | Một dòng thu tiền hoặc hoàn tiền |
| `Receipt` | Biên lai xác nhận đã thu tiền |
| `HotelServiceBooking` | Dịch vụ khách lưu trú đã đặt, gắn với booking và phòng |
| `Supplier debt` | Công nợ mua hàng/vật tư với nhà cung cấp; không phải hoa hồng thương mại |
| `Inventory` | Tồn kho vật tư, hàng hóa hoặc đồ dùng |
| `Housekeeping` | Bộ phận buồng phòng |
| `Technical asset` | Tài sản kỹ thuật của phòng hoặc tòa nhà |
| `Cash handover` | Bàn giao két tiền giữa các ca |
| `Leave request` | Phiếu xin nghỉ phép/nghỉ ốm/nghỉ không lương |
| `Shift` | Ca làm việc |
| `VAT invoice` | Hóa đơn giá trị gia tăng |
| `OTA` | Kênh bán phòng trực tuyến bên ngoài như Booking.com hoặc Agoda |

## 5. Vòng đời đặt phòng

### 5.1. Trạng thái booking (`ReservationStatus`)

| Mã | Tiếng Việt | Ý nghĩa và điều kiện |
|---|---|---|
| `DRAFT` | Bản nháp / chờ hoàn tất | Booking mới tạo nhưng chưa đủ điều kiện xác nhận. Booking online thường bắt đầu ở đây và chờ tiền cọc. |
| `DEPOSIT_PAID` | Đã thanh toán tiền cọc | Cổng thanh toán hoặc nhân viên đã xác nhận tiền cọc. Đây là một trạng thái đủ điều kiện để lễ tân theo dõi khách đến. |
| `CONFIRMED` | Đã xác nhận | Booking đã được khách sạn xác nhận. |
| `CHECKED_IN` | Đã nhận phòng | Khách đã đến và được nhận phòng. |
| `CHECKED_OUT` | Đã trả phòng | Khách đã kết thúc lưu trú và trả phòng. |
| `CANCELLED` | Đã hủy | Booking không còn hiệu lực do khách hoặc khách sạn hủy. |
| `NO_SHOW` | Không đến | Khách không đến nhận phòng theo lịch. |

Luồng thông thường:

```text
Đặt online -> DRAFT -> Thanh toán cọc -> DEPOSIT_PAID
                                      -> Lễ tân thấy khách đến
DEPOSIT_PAID/CONFIRMED -> CHECKED_IN -> CHECKED_OUT
                         -> CANCELLED hoặc NO_SHOW nếu không tiếp tục
```

Quy tắc hiện tại của màn hình “Khách đến hôm nay” là đúng theo nghiệp vụ:
chỉ lấy booking `CONFIRMED` hoặc `DEPOSIT_PAID`. Booking `DRAFT` còn đang chờ
cọc không hiển thị ở danh sách khách đến.

### 5.2. Trạng thái tiền cọc (`DepositPaymentStatus`)

| Mã | Tiếng Việt | Ý nghĩa |
|---|---|---|
| `NOT_REQUIRED` | Không yêu cầu cọc | Booking nội bộ hoặc chính sách không cần cọc. |
| `PENDING` | Đang chờ thanh toán | Đã cấp mã/hướng dẫn nhưng chưa nhận được xác nhận thanh toán. |
| `PAID` | Đã thanh toán | Cổng thanh toán đã xác nhận tiền. |
| `EXPIRED` | Hết hạn | Mã hoặc hướng dẫn cọc không còn hiệu lực. |

### 5.3. Hình thức thuê (`RentalType`)

| Mã | Tiếng Việt | Cách tính |
|---|---|---|
| `PACKAGE` | Theo đêm / theo gói ngày | Tính theo số ngày hoặc số đêm của khoảng lưu trú. |
| `HOURLY` | Theo giờ | Khách chọn giờ nhận và giờ trả; hệ thống tính theo số giờ, có mức tối thiểu theo chính sách. |

### 5.4. Nguồn đặt phòng (`booking_source`)

| Mã | Tiếng Việt |
|---|---|
| `DIRECT` | Đặt trực tiếp tại khách sạn hoặc website chính thức |
| `BOOKING_COM` | Booking.com |
| `AGODA` | Agoda |
| `EXPEDIA` | Expedia |
| `AIRBNB` | Airbnb |
| `PHONE` | Đặt qua điện thoại |
| `WALK_IN` | Khách đến trực tiếp không đặt trước |

Nguồn đặt phòng được lưu tại `reservations.booking_source`. Website customer
hiện gửi `DIRECT`. Khi booking đến từ một OTA, phải gửi đúng mã OTA để phục vụ
đối soát doanh thu và hoa hồng.

### 5.5. Kết quả xử lý hủy (`CancellationOutcome`)

| Mã | Tiếng Việt | Ý nghĩa |
|---|---|---|
| `REFUND` | Hoàn tiền | Hoàn lại tiền theo chính sách hủy. |
| `RETAIN` | Không phát sinh hoàn tiền | Hủy đúng hạn nhưng chưa có khoản thanh toán đủ điều kiện để hoàn. |
| `FORFEIT` | Mất quyền hoàn tiền | Hủy muộn hoặc không đến nhận phòng nên mất quyền hoàn tiền cọc. |

## 6. Trạng thái phòng và loại phòng

### 6.1. Trạng thái vận hành phòng (`RoomStatus`)

| Mã API/database | Tiếng Việt | Có được bán/đặt không? |
|---|---|---|
| `available` (`READY`) | Sẵn sàng | Có |
| `reserved` (`RESERVED`) | Đã giữ phòng | Không nhận đặt phòng trùng |
| `occupied` (`OCCUPIED`) | Đang có khách | Không |
| `cleaning` (`CLEANING`) | Đang dọn | Không |
| `maintenance` (`MAINTENANCE`) | Đang bảo trì | Không |
| `out_of_service` (`OUT_OF_SERVICE`) | Ngừng sử dụng | Không |
| `returned` (`RETURNED`) | Đã trả theo quy trình hiện tại | Không dùng cho trạng thái vận hành mới |
| `cancelled` (`CANCELLED`) | Đã hủy phân bổ | Không dùng cho booking mới |

`READY` là trạng thái phòng sẵn sàng. Phòng chỉ nên trở lại `READY` sau khi
khách trả phòng và bộ phận buồng phòng hoàn tất checklist.

### 6.2. Trạng thái danh mục loại phòng (`RoomTypeCatalogStatus`)

| Mã | Tiếng Việt | Ý nghĩa |
|---|---|---|
| `DRAFT` | Bản nháp | Loại phòng đang xây dựng, chưa công khai. |
| `ACTIVE` | Đang hoạt động | Đã được duyệt và có thể xuất hiện trên website. |
| `REJECTED` | Bị từ chối | Không được duyệt để sử dụng. |
| `RETIRED` | Ngừng kinh doanh | Không nhận booking mới nhưng dữ liệu cũ vẫn được giữ. |

### 6.3. Hạng phòng trong mô hình hiện tại

| Mã | Tên tiếng Việt | Định hướng sử dụng |
|---|---|---|
| `STD` | Standard – Tiêu chuẩn | Khoảng 15–25 m²; phòng đơn tối đa 2 người, phòng đôi tối đa 4 người. |
| `SUP` | Superior – Cao cấp hơn | Khoảng 25–35 m²; nội thất và tầm nhìn tốt hơn Standard. |
| `DLX` | Deluxe – Cao cấp | Diện tích rộng, tầng cao, hướng nhìn đẹp, thiết bị cao cấp. |
| `SUT` | Suite | Diện tích lớn, khu vực riêng, tiện nghi cao cấp, thường ở tầng cao. |
| `VIP` | Phòng VIP nguyên căn | Có phòng khách riêng, ban công và dịch vụ đặc biệt. |

Không có phòng nào được cấu hình vượt quá sức chứa thực tế. Theo yêu cầu dự
án, hạng phòng lớn nhất được thiết kế tối đa 8 người/phòng.

## 7. Vai trò người dùng và quyền hạn

### 7.1. Vai trò nhân viên (`EmployeeRole`)

| Mã | Tên tiếng Việt | Công việc chính |
|---|---|---|
| `ADMIN` | Quản trị hệ thống | Quản lý toàn bộ hệ thống và cấu hình. |
| `DIRECTOR` | Ban giám đốc | Xem và phê duyệt nghiệp vụ cấp cao. |
| `MANAGER` | Quản lý | Điều hành nhiều bộ phận, duyệt các thao tác theo chính sách. |
| `FRONT_DESK` | Lễ tân | Khách, phòng, booking, nhận phòng, trả phòng và dịch vụ tại quầy. |
| `ACCOUNTING` | Kế toán | Hóa đơn, thanh toán, biên lai, công nợ và báo cáo tài chính. |
| `HOUSEKEEPING` | Buồng phòng | Dọn phòng, checklist, đồ vải và sự cố trong phòng. |
| `TECHNICAL` | Kỹ thuật | Bảo trì phòng, thiết bị và tài sản kỹ thuật của tòa nhà. |
| `KITCHEN` | Bếp / vận hành dịch vụ | Dịch vụ ăn uống và tồn kho liên quan. |
| `STAFF` | Nhân viên nghiệp vụ | Quyền xem giới hạn theo nhiệm vụ được cấp. |
| `CUSTOMER` | Khách hàng | Chỉ dùng cổng customer và chỉ xem dữ liệu của chính mình. |

`CUSTOMER` là loại tài khoản khách hàng, không phải chức vụ nhân viên.

### 7.2. Một số quyền (`Permission` / `Capability`)

| Mã | Tiếng Việt |
|---|---|
| `ROOM_READ` | Xem phòng |
| `ROOM_WRITE` | Thay đổi thông tin/trạng thái phòng |
| `RESERVATION_READ` | Xem booking |
| `RESERVATION_CREATE` | Tạo booking |
| `RESERVATION_WRITE` | Sửa booking |
| `RESERVATION_CHECKOUT` | Thực hiện trả phòng |
| `RESERVATION_SERVICE_WRITE` | Ghi nhận dịch vụ dùng trong booking |
| `GUEST_READ` | Xem hồ sơ khách |
| `GUEST_WRITE` | Tạo/sửa hồ sơ khách |
| `BILLING_READ` | Xem hóa đơn và khoản phải thu |
| `PAYMENT_WRITE` | Ghi nhận thanh toán/hoàn tiền theo quyền |
| `SERVICE_READ` | Xem danh mục dịch vụ |
| `INVENTORY_READ` | Xem tồn kho |
| `INVENTORY_WRITE` | Nhập/xuất/điều chỉnh tồn kho |
| `MAINTENANCE_READ` | Xem bảo trì |
| `CASH_HANDOVER_WRITE` | Ghi nhận bàn giao két tiền |
| `FRONT_DESK_DASHBOARD` | Xem bảng điều hành lễ tân |
| `APPROVAL_REQUEST` | Gửi yêu cầu phê duyệt |
| `ROOM_CATALOG_WRITE` | Quản lý danh mục loại phòng, ảnh và tiện nghi |

Ẩn một nút trên frontend không phải là bảo mật. Backend vẫn phải kiểm tra
đăng nhập, vai trò, quyền chi tiết và phạm vi dữ liệu.

### 7.3. Đầy đủ mã quyền của hệ thống

Các mã dưới đây không phải trạng thái. Chúng là “chìa khóa quyền” để backend
quyết định tài khoản nào được xem hoặc thực hiện thao tác nào.

| Nhóm mã | Nghĩa tiếng Việt |
|---|---|
| `EMPLOYEE_READ` | Xem nhân viên |
| `EMPLOYEE_PROVISION` | Tạo/cấp tài khoản nhân viên |
| `EMPLOYEE_PASSWORD_RESET` | Cấp lại mật khẩu nhân viên |
| `SHIFT_READ`, `SHIFT_WRITE` | Xem và sắp xếp ca làm việc |
| `ROOM_READ`, `ROOM_WRITE` | Xem và thay đổi phòng |
| `ROOM_CATALOG_WRITE` | Quản lý danh mục loại phòng |
| `ROOM_ADMIN_READ`, `ROOM_ADMIN_WRITE` | Xem và quản trị dữ liệu phòng cấp quản trị |
| `EQUIPMENT_READ`, `EQUIPMENT_WRITE` | Xem và quản lý thiết bị |
| `GUEST_READ`, `GUEST_WRITE` | Xem và cập nhật hồ sơ khách |
| `RESERVATION_READ`, `RESERVATION_CREATE`, `RESERVATION_WRITE` | Xem, tạo và sửa booking |
| `RESERVATION_CHECKOUT` | Thực hiện trả phòng |
| `RESERVATION_SERVICE_WRITE` | Ghi nhận dịch vụ khách đã dùng |
| `FRONT_DESK_DASHBOARD` | Xem dashboard lễ tân |
| `HOUSEKEEPING_TASK_READ`, `HOUSEKEEPING_TASK_WRITE`, `HOUSEKEEPING_TASK_ASSIGN` | Xem, cập nhật và phân công việc buồng phòng |
| `INCIDENT_WRITE`, `INCIDENT_HANDOFF` | Ghi nhận và bàn giao sự cố |
| `TECHNICAL_WORK_ORDER_READ`, `TECHNICAL_WORK_ORDER_WRITE` | Xem và tạo/sửa phiếu kỹ thuật |
| `TECHNICAL_WORK_ORDER_ACCEPT` | Kỹ thuật tiếp nhận phiếu |
| `TECHNICAL_WORK_ORDER_RELEASE` | Giải phóng phòng sau khi kỹ thuật hoàn tất |
| `BILLING_READ`, `BILLING_WRITE` | Xem và cập nhật hóa đơn |
| `PAYMENT_WRITE` | Ghi nhận giao dịch thanh toán |
| `SERVICE_READ`, `SERVICE_WRITE` | Xem và quản lý dịch vụ |
| `INVENTORY_READ`, `INVENTORY_WRITE` | Xem và thay đổi tồn kho |
| `SERVICE_PRICE_REQUEST`, `SERVICE_PRICE_ACTIVATE` | Đề nghị và kích hoạt giá dịch vụ |
| `MAINTENANCE_READ`, `MAINTENANCE_WRITE` | Xem và cập nhật bảo trì |
| `CASH_HANDOVER_WRITE` | Ghi nhận bàn giao két tiền |
| `FINANCE_READ`, `FINANCE_WRITE` | Xem và ghi nhận nghiệp vụ tài chính |
| `NOTIFICATION_READ`, `NOTIFICATION_WRITE` | Xem và quản lý thông báo |
| `APPROVAL_REQUEST`, `APPROVAL_APPROVE` | Gửi và duyệt yêu cầu phê duyệt |
| `AUDIT_READ` | Xem nhật ký kiểm soát |

Một quyền có chữ `READ` nghĩa là được xem. Một quyền có chữ `WRITE` nghĩa là
được tạo hoặc thay đổi. `APPROVE` là quyền duyệt, không đồng nghĩa với quyền
được tự tạo nghiệp vụ. `RELEASE` là đưa tài sản/phòng trở lại khả dụng sau khi
đã hoàn thành xử lý.

### 7.4. Mã đăng nhập và tình trạng nhân viên

| Nhóm | Mã | Tiếng Việt |
|---|---|---|
| Loại người đăng nhập | `EMPLOYEE` | Tài khoản nhân viên |
| Loại người đăng nhập | `CUSTOMER` | Tài khoản khách hàng |
| Tình trạng nhân viên | `WORKING` | Đang làm việc |
| Tình trạng nhân viên | `ON_LEAVE` | Đang nghỉ |
| Tình trạng nhân viên | `TERMINATED` | Đã chấm dứt làm việc |
| Kết quả đăng nhập | `SUCCEEDED` | Đăng nhập thành công |
| Kết quả đăng nhập | `FAILED` | Đăng nhập thất bại |

### 7.5. Hạng thành viên khách hàng

| Mã | Tên tiếng Việt | Mức giảm mặc định |
|---|---|---:|
| `STANDARD` | Tiêu chuẩn | 0% |
| `SILVER` | Bạc | 5% |
| `GOLD` | Vàng | 10% |
| `PLATINUM` | Bạch kim | 15% |

Đây là hạng thành viên, không phải trạng thái booking và cũng không phải vai
trò nhân viên.

### 7.6. Kiểm soát xử lý trùng và thông báo

| Nhóm | Mã | Tiếng Việt | Ý nghĩa |
|---|---|---|---|
| Chống xử lý trùng | `PROCESSING` | Đang xử lý | Yêu cầu đã được nhận nhưng chưa hoàn tất. |
| Chống xử lý trùng | `COMPLETED` | Đã hoàn tất | Có thể trả lại kết quả cũ nếu client gửi lại cùng yêu cầu. |
| Hộp chờ thông báo | `PENDING` | Chờ gửi | Thông báo đã tạo nhưng chưa giao. |
| Hộp chờ thông báo | `DELIVERED` | Đã gửi | Thông báo đã giao thành công. |
| Hộp chờ thông báo | `FAILED` | Gửi thất bại | Cần retry hoặc xử lý lỗi. |

`Idempotency` nghĩa là khi mạng chập chờn và người dùng bấm lại, hệ thống
không tạo thêm booking, hóa đơn hoặc giao dịch giống hệt. `Notification outbox`
là hàng đợi lưu tạm thông báo trước khi gửi cho bộ phận nhận.

## 8. Thanh toán, hóa đơn và tài chính

### 8.1. Phương thức thanh toán (`PaymentMethod`)

| Mã | Tiếng Việt |
|---|---|
| `CASH` | Tiền mặt |
| `CARD` | Thẻ ngân hàng/thẻ thanh toán |
| `BANK_TRANSFER` | Chuyển khoản ngân hàng |

### 8.2. Trạng thái dòng thanh toán (`PaymentTransactionStatus`)

| Mã | Tiếng Việt |
|---|---|
| `COMPLETED` | Đã hoàn tất, có hiệu lực |
| `FAILED` | Thất bại, không làm thay đổi số đã thu |
| `VOIDED` | Đã vô hiệu hóa theo quy trình đối soát |

### 8.3. Loại dòng tiền (`TransactionType`)

| Mã | Tiếng Việt |
|---|---|
| `PAYMENT` | Thu tiền |
| `REFUND` | Hoàn tiền |

### 8.4. Trạng thái hóa đơn hiện có

| Mã | Tiếng Việt |
|---|---|
| `DA_THANH_TOAN` | Đã thanh toán |
| `CHUA_THANH_TOAN` | Chưa thanh toán |
| `DU_KIEN` | Dự kiến, chưa quyết toán |

### 8.5. Hóa đơn VAT

Hóa đơn VAT là chứng từ thuế, khác với hóa đơn thanh toán/folio phòng. Hệ
thống cần lưu riêng:

- Số hóa đơn VAT.
- Mã số thuế.
- Tên công ty.
- Địa chỉ công ty.
- Thuế suất hiện tại: `8%` theo quyết định đã chốt.
- Dữ liệu nội bộ dùng để xuất XML.

Không gộp các trường này vào hồ sơ khách (`guests`) hoặc nhầm với hóa đơn
thanh toán phòng (`invoices`).

### 8.6. Chi phí, sổ cái và công nợ nhà cung cấp

| Nhóm | Mã | Tiếng Việt | Ý nghĩa |
|---|---|---|---|
| Chi phí | `RECORDED` | Đã ghi nhận | Khoản chi đã nhập vào hệ thống nhưng chưa được duyệt. |
| Chi phí | `APPROVED` | Đã duyệt | Khoản chi được chấp nhận để quyết toán. |
| Chi phí | `VOIDED` | Đã hủy | Khoản chi không còn hiệu lực. |
| Chiều sổ cái | `DEBIT` | Ghi nợ/chi ra | Dòng làm tăng khoản phải thu hoặc ghi nhận tiền đi ra tùy loại sổ. |
| Chiều sổ cái | `CREDIT` | Ghi có/thu vào | Dòng làm tăng khoản phải trả hoặc ghi nhận tiền đi vào tùy loại sổ. |
| Công nợ nhà cung cấp | `OPEN` | Đang mở | Chưa thanh toán. |
| Công nợ nhà cung cấp | `PARTIALLY_SETTLED` | Đã thanh toán một phần | Đã thanh toán một phần, vẫn còn số dư. |
| Công nợ nhà cung cấp | `SETTLED` | Đã thanh toán đủ | Đã thanh toán đầy đủ. |
| Công nợ nhà cung cấp | `VOIDED` | Đã hủy | Công nợ bị hủy theo nghiệp vụ. |

`Settled` ở đây nghĩa là đã thanh toán công nợ nhà cung cấp, không phải quyết
toán tiền thuê mặt bằng hay hoa hồng thương mại. `Partially settled` nghĩa là
mới thanh toán một phần. `Void`/`Voided` nghĩa là vô hiệu hóa nghiệp vụ,
không phải xóa dấu vết khỏi hệ thống.

## 9. Dịch vụ do MaM Hotel vận hành

### 9.1. Nhóm dịch vụ

| Nhóm | Ví dụ |
|---|---|
| Nhà hàng | MaM Restaurant |
| Dịch vụ phòng | Bữa sáng, giặt ủi tận phòng, bổ sung vật dụng |
| Spa | Dịch vụ spa do MaM Hotel phục vụ |
| Thể thao/vui chơi | Hồ bơi, tennis, cầu lông, bóng bàn, gym |
| Hội nghị/sự kiện | Nhà hàng tiệc cưới, phòng họp, hội nghị tầng 4 |

Mỗi `Service` cần có tối thiểu:

| Trường | Tiếng Việt |
|---|---|
| `name` | Tên dịch vụ |
| `category` | Nhóm dịch vụ |
| `description` | Mô tả |
| `image_url` | Đường dẫn ảnh |
| `price` | Giá bán |
| `unit` | Đơn vị tính, ví dụ lượt, phần, kg, giờ |

### 9.2. Đặt và sử dụng dịch vụ

Chỉ khách có booking phòng đã xác nhận cọc mới được đặt trước dịch vụ trên web;
khách ngoài không được đặt. Dịch vụ chỉ được ghi nhận `USED` sau khi booking
`CHECKED_IN`. Mỗi lượt đặt gắn với `reservation_id`, `room_id`, số lượng và
thời gian sử dụng. `free_quantity` là phần nằm trong hạn mức; chỉ phần vượt
hạn mức đã dùng mới tính vào hóa đơn phòng. Hủy booking phòng tự hủy dịch vụ
chưa dùng. Hồ bơi chỉ xem thông tin trên web, không đặt trước.

Khách thuê theo gói ngày-đêm có quyền lợi: hồ bơi không giới hạn theo số khách
trong booking; giặt ủi một lần/ngày/phòng; bữa sáng một suất/ngày/khách; tại
MaM Restaurant mỗi khách một bữa trưa và một bữa tối/ngày. Khách thuê theo giờ
trả giá niêm yết cho mọi dịch vụ. Xem bảng giá tại `rule.md` mục 15.

### 9.3. Thuật ngữ đặt bàn/lịch hẹn

| Mã | Tiếng Việt |
|---|---|
| `Table booking` | Đặt bàn |
| `Appointment` | Đặt lịch hẹn, ví dụ lịch spa |
| `CONFIRMED` | Dịch vụ đã đặt và giữ hạn mức miễn phí |
| `USED` | Lễ tân xác nhận đã sử dụng; phần trả phí vào hóa đơn phòng |
| `CANCELLED` | Dịch vụ đã hủy; hạn mức được giải phóng |
| `Supplier debt` | Công nợ nhà cung cấp hàng hóa/vật tư |

## 10. Vận hành buồng phòng và kỹ thuật

### 10.1. Trạng thái công việc buồng phòng (`HousekeepingTaskStatus`)

| Mã | Tiếng Việt |
|---|---|
| `NEEDS_CLEANING` | Cần dọn |
| `IN_PROGRESS` | Đang dọn |
| `CLEANED` | Đã dọn xong nhưng chưa hoàn tất kiểm tra |
| `READY` | Đã đạt điều kiện sẵn sàng bán |
| `WAITING_TECHNICAL` | Chờ bộ phận kỹ thuật xử lý |

### 10.2. Bảo trì (`MaintenanceStatus`)

| Mã | Tiếng Việt |
|---|---|
| `CHUA_XU_LY` | Chưa xử lý |
| `DANG_BAO_TRI` | Đang bảo trì |
| `DA_HOAN_THANH` | Đã hoàn thành |

### 10.3. Phiếu công việc kỹ thuật (`TechnicalWorkOrderStatus`)

| Mã | Tiếng Việt |
|---|---|
| `NEW` | Mới tạo |
| `ACKNOWLEDGED` | Kỹ thuật đã tiếp nhận |
| `IN_PROGRESS` | Đang xử lý |
| `WAITING_ACCEPTANCE` | Chờ nghiệm thu |
| `COMPLETED` | Đã hoàn tất |
| `ROOM_RELEASED` | Đã giải phóng phòng để vận hành lại |

### 10.4. Sự cố

| Mã | Tiếng Việt |
|---|---|
| `LOW` | Thấp |
| `MEDIUM` | Trung bình |
| `HIGH` | Cao |
| `CRITICAL` | Nghiêm trọng |
| `OPEN` | Mở, chưa giải quyết |
| `ACKNOWLEDGED` | Đã tiếp nhận |
| `RESOLVED` | Đã xử lý xong |

### 10.5. Biến động tồn kho (`InventoryMovementType`)

| Mã | Tiếng Việt | Tác động tồn kho |
|---|---|---|
| `RECEIVE` | Nhập hàng | Tăng |
| `ISSUE` | Xuất dùng/bán | Giảm |
| `ADJUST` | Điều chỉnh theo kiểm kê | Có thể tăng hoặc giảm |
| `WASTE` | Hủy/hao hụt | Giảm |
| `RETURN` | Hoàn trả vào kho | Tăng |

Kho đồ vải buồng phòng được theo dõi riêng nhưng vẫn liên kết với tồn kho
chung. Ví dụ khăn, ga, vỏ gối có thể có kho riêng theo bộ phận, nhưng mọi
nhập/xuất/điều chỉnh vẫn phải tạo dòng biến động có người chịu trách nhiệm.

### 10.6. Tài sản kỹ thuật

`Technical asset` là tài sản cần theo dõi vòng đời và bảo trì, bao gồm:

- Thiết bị trong từng phòng.
- Thang máy.
- Máy phát điện.
- Hồ bơi.
- Hệ thống HVAC/điều hòa thông gió.
- Bơm nước.
- Thiết bị bếp.
- Thiết bị gym, tennis và khu vui chơi.

### 10.7. Kiểm tra minibar, thiết bị và tình trạng sự cố

| Nhóm | Mã | Tiếng Việt |
|---|---|---|
| Nội dung kiểm tra | `MINIBAR` | Kiểm tra minibar |
| Nội dung kiểm tra | `ROOM_ASSET` | Kiểm tra tài sản/thiết bị trong phòng |
| Tình trạng vật dụng | `OK` | Bình thường |
| Tình trạng vật dụng | `DAMAGED` | Hư hỏng |
| Tình trạng vật dụng | `MISSING` | Bị thiếu/mất |
| Tình trạng vật dụng | `REFILLED` | Đã bổ sung lại |

### 10.8. Mức độ và bàn giao sự cố

| Nhóm | Mã | Tiếng Việt |
|---|---|---|
| Mức độ sự cố | `LOW` | Thấp |
| Mức độ sự cố | `MEDIUM` | Trung bình |
| Mức độ sự cố | `HIGH` | Cao |
| Mức độ sự cố | `CRITICAL` | Nghiêm trọng, cần ưu tiên ngay |
| Bàn giao sự cố | `OPEN` | Mới mở, chưa xử lý |
| Bàn giao sự cố | `ACKNOWLEDGED` | Đã tiếp nhận |
| Bàn giao sự cố | `RESOLVED` | Đã giải quyết |

## 11. Nhân sự

| Thuật ngữ | Tiếng Việt |
|---|---|
| `Attendance` | Chấm công |
| `Fingerprint import` | Nhập dữ liệu từ máy chấm công vân tay |
| `Annual leave` | Nghỉ phép năm |
| `Sick leave` | Nghỉ ốm |
| `Unpaid leave` | Nghỉ không lương |
| `Shift swap` | Đổi ca |
| `Approver` | Người duyệt |
| `Employee ID` | Mã nhân viên |
| `Initial password` | Mật khẩu khởi tạo |
| `Password reset` | Đổi/cấp lại mật khẩu |

Quy tắc mã nhân viên:

```text
NV0001  Nhân viên chung
HK0001  Nhân viên buồng phòng
KT0001  Nhân viên kỹ thuật
KT0002  Nhân viên kế toán nếu doanh nghiệp quy định tiền tố riêng
```

Mật khẩu khởi tạo do hệ thống tự sinh. Sau khi nhân viên được cấp tài khoản
Gmail công ty, nhân viên phải đổi mật khẩu khi đăng nhập lần đầu. Người duyệt
nghỉ phép và đổi ca theo chính sách hiện tại là quản lý.

### Trạng thái ca làm việc (`EmployeeShift.Status`)

| Mã | Tiếng Việt |
|---|---|
| `ASSIGNED` | Đã xếp ca |
| `STARTED` | Đã bắt đầu ca |
| `COMPLETED` | Đã hoàn tất ca |
| `CANCELLED` | Đã hủy ca |

## 12. Đối soát OTA

`OTA reconciliation` là đối chiếu booking bán qua kênh bên ngoài với số tiền
thực tế phải nhận từ kênh đó. Mỗi booking OTA cần có:

| Trường | Tiếng Việt |
|---|---|
| `booking_source` | Nguồn đặt phòng |
| `ota_gross_revenue` | Doanh thu gộp trước hoa hồng |
| `ota_commission` | Hoa hồng trả cho OTA |
| `ota_net_revenue` | Doanh thu ròng sau hoa hồng |
| `ota_reconciliation_status` | Trạng thái đối soát |

Công thức:

```text
Doanh thu ròng = Doanh thu gộp - Hoa hồng OTA
```

Trạng thái đối soát nên được hiển thị bằng các nhãn dễ hiểu như “Chưa đối
soát”, “Đã đối soát”, “Có chênh lệch”, “Đã khóa sổ”. Mã chính thức phải được
thống nhất trước khi thêm vào dữ liệu production.

## 13. Quy trình khách hàng đặt phòng

1. Khách đăng nhập bằng tài khoản customer.
2. Website tải danh sách loại phòng/phòng đang hoạt động từ backend.
3. Khách chọn phòng, số khách, nhận phòng, trả phòng hoặc chọn theo giờ.
4. Frontend gửi `rental_type`, `booking_source`, danh sách phòng và thời gian.
5. Backend kiểm tra phòng có tồn tại, đang hoạt động, không trùng lịch và đúng
   giới hạn số phòng.
6. Backend tạo `Reservation` ở trạng thái `DRAFT`, tạo mã cọc và thời hạn cọc.
7. Khách thanh toán cọc.
8. Callback thanh toán hợp lệ chuyển trạng thái sang `DEPOSIT_PAID`.
9. Màn hình lễ tân “Khách đến hôm nay” nhìn thấy booking đủ điều kiện.
10. Lễ tân nhận phòng, ghi nhận dịch vụ, lập hóa đơn và xử lý trả phòng.

Booking online không được tự động chuyển thành khách đến chỉ vì khách đã bấm
nút đặt phòng. Điều kiện hiển thị là trạng thái booking và ngày nhận phòng.

### 5.5. Các nhóm dữ liệu trong dashboard lễ tân

Các chữ viết hoa dưới đây là mã nội bộ backend dùng để chia danh sách. Nhân
viên lễ tân không cần nhớ mã tiếng Anh; trên giao diện nên dùng cột “Tên hiển
thị” bằng tiếng Việt.

| Mã nội bộ | Tên hiển thị tiếng Việt | Backend lấy dữ liệu nào? |
|---|---|---|
| `ARRIVALS` | Khách đến hôm nay | Booking có trạng thái `CONFIRMED` hoặc `DEPOSIT_PAID`, có giờ nhận phòng trong ngày đang xem và chưa có lần nhận phòng sớm hơn. |
| `UNPAID_DEPOSITS` | Booking chưa thanh toán cọc | Booking đang `PENDING` tiền cọc; hoặc có số tiền cọc lớn hơn 0 nhưng trạng thái cọc chưa phải `PAID`. Vì vậy nhóm này có thể gồm cả mã cọc đã hết hạn cần xử lý. |
| `ALL` | Tất cả booking | Tất cả booking phù hợp với ô tìm kiếm và bộ lọc trạng thái, không giới hạn vào một nhóm vận hành cụ thể. |
| `DEPARTURES` | Khách trả phòng hôm nay | Booking đang `CHECKED_IN`, có giờ trả phòng trong ngày đang xem và không có lần trả phòng muộn hơn trong cùng booking. |
| `CURRENT` | Khách đang lưu trú | Booking đang ở trạng thái `CHECKED_IN`. |
| `INVOICE_BALANCES` | Hóa đơn còn phải thu | Booking đã có hóa đơn và hóa đơn vẫn còn số tiền phải thu lớn hơn 0. |

Điểm cần phân biệt:

- `ARRIVALS` không có nghĩa là mọi booking đã tạo hôm nay. Nó nghĩa là khách
  dự kiến nhận phòng trong ngày được chọn.
- `UNPAID_DEPOSITS` không có nghĩa booking bị hủy. Nó chỉ nói rằng khoản cọc
  chưa được xác nhận là đã thanh toán.
- `ALL` không làm thay đổi trạng thái booking; nó chỉ là cách xem rộng hơn.
- Đây là các “ngăn phân loại” trong dashboard, không phải trạng thái mới của
  booking và không được lưu vào cột `reservations.status`.

API dashboard hiện tự tổng hợp các nhóm này trong một lần đọc; frontend nhận
các danh sách có tên tiếng Anh theo hợp đồng dữ liệu nhưng phải hiển thị nhãn
tiếng Việt như “Khách đến hôm nay”, “Chưa thanh toán cọc”, “Đang lưu trú” và
“Hóa đơn còn phải thu”.

## 14. Từ điển các trường hay gặp

| Tên trường | Nghĩa tiếng Việt |
|---|---|
| `id` | Mã định danh duy nhất |
| `name` | Tên |
| `description` | Mô tả |
| `status` | Trạng thái |
| `created_at` | Thời điểm tạo |
| `updated_at` | Thời điểm cập nhật |
| `booked_at` | Thời điểm đặt phòng |
| `check_in` | Nhận phòng |
| `check_out` | Trả phòng |
| `expected_check_in` | Thời điểm dự kiến nhận phòng |
| `expected_check_out` | Thời điểm dự kiến trả phòng |
| `actual_check_in` | Thời điểm thực tế nhận phòng |
| `actual_check_out` | Thời điểm thực tế trả phòng |
| `daily_price` | Giá theo đêm/ngày |
| `hourly_price` | Giá theo giờ |
| `deposit` | Tiền cọc |
| `amount` | Số tiền |
| `quantity` | Số lượng |
| `unit` | Đơn vị tính |
| `floor` | Tầng |
| `area` | Diện tích |
| `view` | Hướng/tầm nhìn |
| `bed_type` | Loại giường |
| `max_occupancy` | Số người tối đa |
| `image_url` | Đường dẫn ảnh |
| `reference` | Mã tham chiếu |
| `reason` | Lý do |
| `approved_by` | Người duyệt |
| `approved_at` | Thời điểm duyệt |
| `gross_revenue` | Doanh thu gộp |
| `net_revenue` | Doanh thu ròng |
| `commission` | Hoa hồng |
| `variance` | Chênh lệch |
| `expected_amount` | Số tiền hệ thống dự kiến |
| `actual_amount` | Số tiền thực tế bàn giao/thu được |

## 15. Nguyên tắc khi đọc hoặc thay đổi hệ thống

1. Muốn hiểu một chức năng, đọc theo thứ tự: giao diện → API/DTO → service →
   entity/repository → bảng database.
2. Không suy luận trạng thái chỉ từ màu sắc hoặc việc một nút đang ẩn trên giao
   diện. Phải xem điều kiện backend.
3. Không xóa hoặc đổi tên mã enum đang lưu trong database nếu chưa có kế hoạch
   migration và tương thích API.
4. Khi cần đổi chữ hiển thị, chỉ sửa nhãn tiếng Việt ở frontend hoặc lớp dịch.
5. Khi thêm trạng thái mới, phải ghi vào tài liệu này, cập nhật luồng chuyển
   trạng thái, API, giao diện và dữ liệu mẫu.
6. Khi thêm trường database, tạo migration Flyway mới; không sửa migration đã
   chạy trên database đang có dữ liệu.
7. Mọi thao tác tài chính, hoàn tiền, điều chỉnh hóa đơn, duyệt giá hoặc thay
   đổi dữ liệu nhạy cảm phải có người thực hiện và nhật ký audit.

## 16. Bảng tra nhanh cho người vận hành

| Câu hỏi | Câu trả lời |
|---|---|
| Booking online mới nằm ở đâu? | Trong `reservations`, trạng thái thường là `DRAFT`, tiền cọc `PENDING`. |
| Khi nào lễ tân thấy khách đến? | Khi booking là `CONFIRMED` hoặc `DEPOSIT_PAID` và đúng ngày nhận phòng. |
| Website hiện đặt trực tiếp hay OTA? | Website chính thức gửi `DIRECT`. |
| Phòng `READY` nghĩa là gì? | Phòng sẵn sàng để phân bổ/nhận khách. |
| `ACTIVE` của loại phòng nghĩa là gì? | Loại phòng đã được duyệt và có thể công khai. |
| Ai duyệt nghỉ phép? | Quản lý theo chính sách đã chốt. |
| Hóa đơn VAT có phải hóa đơn phòng không? | Không. VAT là chứng từ thuế riêng; hóa đơn phòng/folio là chứng từ thanh toán nội bộ. |
| Kho đồ vải có tách riêng không? | Có tách theo bộ phận nhưng liên kết với tồn kho chung. |
| Dịch vụ của MaM Hotel tính tiền thế nào? | Chỉ phần vượt quyền lợi miễn phí và đã sử dụng được cộng vào hóa đơn phòng khi checkout. |

## 17. Quy tắc duy trì tài liệu

Tài liệu này là bản giải thích nghiệp vụ bằng tiếng Việt, không phải danh sách
thay thế tên class, biến, hàm hoặc cột database. Khi hệ thống có thêm module,
trạng thái, vai trò hoặc chính sách mới, cập nhật tài liệu cùng lúc với code,
migration và giao diện liên quan.
