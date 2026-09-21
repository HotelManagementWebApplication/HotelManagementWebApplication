# Kế hoạch frontend Hotel OS — một khách sạn

> Quyết định phạm vi ngày 13/09/2026: phát hành đầu tiên tiếp tục quản lý **một khách sạn**. Chưa triển khai multi-hotel/multi-tenant. Frontend gồm public portal cho khách (xem công khai; đăng nhập mới được đặt phòng/thanh toán cọc) và một giao diện vận hành chung cho toàn bộ nhân viên.

## 1. Nguyên tắc chung

- Dùng một React/TypeScript codebase và một design system.
- Khách hàng không nhìn thấy AppShell, sidebar hoặc route quản trị.
- Sidebar nhân viên tự ẩn/hiện theo role và permission, nhưng backend vẫn kiểm tra quyền ở mọi request.
- Frontend không nhận hoặc suy diễn dữ liệu mà actor không có quyền xem.
- Public portal chỉ dùng public DTO; không tái sử dụng response nội bộ của nhân viên.
- Các trạng thái phải có loading, empty, error, retry và thông báo thành công/thất bại rõ ràng.

## 2. Public portal dành cho khách

### Route

- `/guest/rooms`: danh sách và trạng thái phòng.
- `/guest/rooms/:id`: chi tiết một phòng.
- `/guest/services`: danh mục dịch vụ đang phục vụ.
- `/guest/login` và `/guest/register`: đăng nhập/đăng ký khách hàng.
- `/guest/bookings/new`: tạo booking sau khi đăng nhập.
- `/guest/bookings/:id/payment`: xem mã/QR thanh toán tiền cọc.

Người chưa đăng nhập chỉ được xem phòng và dịch vụ. Chỉ khách hàng đã đăng nhập mới thấy luồng đặt phòng và thanh toán cọc. Public portal không có giao diện quản trị; các thao tác hủy, chỉnh sửa booking hoặc dữ liệu nội bộ chưa được mở trên customer UI nếu chưa có contract riêng.

Khi chưa chọn thời gian, danh sách phòng hiển thị trạng thái vận hành tại thời điểm hiện tại. Khi khách chọn `check_in` và `check_out`, frontend gọi availability API để hiển thị phòng có thể đặt trong đúng khoảng đó; không hiển thị lịch hoặc danh tính booking của người khác.

### Thông tin được hiển thị

- Số/tên phòng.
- Loại phòng.
- Tầng.
- Giá phòng công khai.
- Ảnh phòng.
- Tiện nghi.
- Một trong các trạng thái công khai:
  - Sẵn sàng đón khách.
  - Đã có người đặt.
  - Đang có khách.
  - Đang dọn.
  - Đang bảo trì.
  - Không phục vụ.

### Thông tin tuyệt đối không hiển thị

- Tên, số điện thoại hoặc giấy tờ của người đặt/đang lưu trú.
- Mã và lịch sử booking của người khác.
- Invoice, payment, receipt hoặc dữ liệu tài chính nội bộ. Với booking của chính mình chỉ hiển thị tóm tắt đặt phòng và hướng dẫn/mã thanh toán tiền cọc cần thiết.
- Ghi chú nội bộ, sự cố chi tiết hoặc thông tin nhân viên.

Frontend chỉ render đúng public DTO do backend trả về; không tải response nội bộ rồi ẩn field bằng CSS hoặc JavaScript.

### Luồng đặt phòng của khách đã đăng nhập

```text
Chọn khách sạn/phòng và thời gian
→ Đăng nhập hoặc đăng ký
→ Xác nhận thông tin booking của chính mình
→ Backend tạm giữ phòng
→ Tạo booking chờ cọc
→ Hiện mã/QR thanh toán cọc
→ Payment callback xác nhận
→ Booking chuyển sang đã xác nhận
```

Không coi việc hiển thị mã/QR là thanh toán thành công. Frontend phải hiển thị thời hạn giữ phòng và trạng thái thanh toán do backend trả về.

## 3. AppShell vận hành cho nhân viên

```text
Dashboard
├── Lễ tân
├── Buồng phòng
├── Bếp / Minibar
├── Kế toán
├── Nhân sự
├── Kỹ thuật
├── Phê duyệt
├── Audit / Báo cáo
└── Quản trị hệ thống
```

AppShell gồm top bar, sidebar theo quyền, vùng nội dung, thông báo nghiệp vụ, thông tin ca trực và Pet Agent. Route bị ẩn không đồng nghĩa được phép truy cập; frontend guard chỉ hỗ trợ trải nghiệm, backend là nơi quyết định cuối cùng.

## 4. Màn hình theo bộ phận

### Lễ tân

Dashboard theo công việc trong ngày:

- Khách sắp nhận và sắp trả phòng.
- Phòng trống, phòng đang có khách và phòng bị khóa.
- Booking chưa đủ cọc.
- Hóa đơn chưa thanh toán.
- Cảnh báo từ Housekeeping/Kỹ thuật.
- Tìm nhanh khách hoặc booking.

Màn hình chính:

- Guest search/detail.
- Reservation list/detail và timeline.
- Check-in, check-out, chuyển phòng, gia hạn và hủy booking.
- Thêm dịch vụ/minibar.
- Tính hóa đơn, thu tiền và in biên lai.

### Housekeeping

Board theo ca:

```text
Cần dọn → Đang dọn → Đã dọn → Chờ kỹ thuật
```

Mỗi thẻ phòng có người được phân công, ca trực, mức ưu tiên, checklist, kiểm kê minibar, kiểm tra tài sản, form sự cố và hành động hoàn tất vệ sinh. Housekeeping chỉ thấy thông tin khách tối thiểu cần cho công việc.

Sự cố mới phải tạo cảnh báo cho Lễ tân và Kỹ thuật; sự cố nghiêm trọng đồng thời cảnh báo Manager.

### Kitchen / Minibar

Dashboard gồm tồn hiện tại, mặt hàng dưới ngưỡng, nhập/xuất kho, danh mục minibar, lịch sử giá và báo cáo tiêu thụ.

```text
Tên mặt hàng | Đơn vị | Giá bán | Tồn kho | Ngưỡng cảnh báo | Trạng thái
```

### Accounting

Giao diện thiên về bảng và sổ giao dịch:

- Invoice, payment ledger và receipt.
- Cash handover.
- Đối soát cash/card/bank.
- Expense và partner debt.
- Refund/adjustment chờ approval.

Accounting không có hành động sửa reservation hoặc trạng thái phòng.

### HR

- Danh sách và hồ sơ nhân viên.
- Phân ca và lịch trực ngày/tuần.
- Trạng thái đang làm, nghỉ hoặc không hoạt động.
- Xem role nhưng không tự cấp/đổi role.

Không hiển thị lương và dữ liệu tài chính cho HR.

### Technical

Hai khu vực chính là equipment registry và maintenance work orders.

```text
Sự cố mới
→ Đã tiếp nhận
→ Đang sửa
→ Chờ nghiệm thu
→ Đã sửa xong
→ Mở khóa phòng
```

Technical xem sự cố, gán người xử lý, ghi vật tư sửa chữa, cập nhật nghiệm thu và mở khóa phòng sau khi đủ điều kiện. Technical được tạo phòng/loại phòng ở trạng thái `DRAFT`; Manager hoặc Director duyệt trước khi có hiệu lực.

### Manager

Dashboard dạng work queue:

- Công việc đang chờ và sự cố quá hạn.
- Phòng bảo trì.
- Booking bất thường.
- Yêu cầu cần duyệt.
- Tồn kho dưới ngưỡng.
- Ca trực còn thiếu người.

Manager không tự duyệt yêu cầu do chính mình tạo.

### Director

- Doanh thu và công suất phòng.
- Tỷ lệ lấp đầy và công nợ.
- Refund, điều chỉnh hóa đơn và thay đổi giá chờ duyệt.
- Sự cố nghiêm trọng.
- Audit event có rủi ro cao.

Mặc định hiển thị số liệu tổng hợp; cho phép lọc theo ngày, bộ phận, loại sự kiện và mức rủi ro.

### Admin

- Tài khoản nhân viên và role assignment.
- Khóa/mở khóa tài khoản.
- Phiên đăng nhập và security events.
- Cấu hình hệ thống.

## 5. Pet Agent Copilot

Pet Agent hiển thị như một pet nổi trên màn hình. Khi nhấn vào pet, mở panel chat gồm:

```text
Agent panel
├── Câu hỏi
├── Câu trả lời và nguồn tham chiếu
└── Dữ liệu hiện tại lấy từ backend
```

Agent nhận context của route và bản ghi đang mở, ví dụ phòng, booking, invoice hoặc housekeeping task. Agent chỉ được đọc dữ liệu nằm trong quyền của actor hiện tại.

Agent được phép tư vấn quy trình, giải thích chính sách, tra cứu, tóm tắt và đề xuất thao tác. Agent không tự sửa booking, hoàn tiền, đổi giá, mở khóa phòng, gán quyền hoặc ghi trực tiếp database.

Luồng hành động:

```text
Agent đề xuất
→ Người dùng xác nhận
→ Backend kiểm tra quyền
→ Approval nếu cần
→ Backend thực hiện
→ Ghi audit
```

## 6. Component dùng chung

- `AppShell`
- `RoleSidebar`
- `PermissionGate`
- `RoomStatusBadge`
- `ReservationTimeline`
- `GuestSummary`
- `InvoiceSummary`
- `ApprovalDrawer`
- `IncidentAlert`
- `ShiftSelector`
- `DataTable`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `ConfirmActionDialog`
- `AgentPanel`

Ba kiểu hiển thị chính:

- Room board cho phòng.
- Work queue cho công việc, sự cố và approval.
- Timeline cho booking, invoice, approval và audit.

## 7. Cấu trúc mã nguồn

frontend/
├── docs/                                          # [CHUYỂN RA NGOÀI SRC] Lưu tài liệu & ảnh tham khảo
│   └── references/                                # (Chuyển toàn bộ ảnh & rule.md từ src/imports/ ra đây)
│       ├── rule.md
│       ├── hotel_pms_dashboard_*.jpg
│       ├── reception_sidebar_final_*.jpg
│       └── ... (các ảnh design mock khác)
│
├── e2e/                                           # Thư mục E2E test tập trung (ngoài src)
│   └── live-contract.test.ts                      # (Chuyển từ src/e2e/live-contract.test.ts ra đây)
│
├── public/                                        # Static files cho trình duyệt
│   └── favicon.ico
│
├── src/
│   ├── app/                                       # Khởi tạo cốt lõi ứng dụng (App Core)
│   │   ├── router/                                # Quản lý điều hướng (thay thế switch-case cũ ở App.tsx)
│   │   │   ├── routes.tsx                         # Khai báo URL: /login, /pms, /housekeeping, /hr,...
│   │   │   └── RoleGuard.tsx                      # Bảo vệ route dựa trên role & permissions
│   │   ├── providers/
│   │   │   └── QueryProvider.tsx                  # Bọc React Query Client
│   │   ├── App.tsx                                # Root component (gọn gàng, chỉ bọc Provider + Router)
│   │   ├── main.tsx                               # Điểm bắt đầu (render ReactDOM)
│   │   └── index.css                              # Tailwind CSS v4 & theme tokens
│   │
│   ├── assets/                                    # Tài nguyên hình ảnh dùng trong code
│   │   ├── hotel_logo.png                         # (Giữ từ src/assets/)
│   │   └── rooftop_bar.png                        # (Giữ từ src/assets/)
│   │
│   ├── layouts/                                   # Các khung giao diện chung (Layout Shells)
│   │   ├── DashboardLayout.tsx                    # Layout chung cho toàn bộ nhân viên (Sidebar + Topbar)
│   │   ├── CustomerLayout.tsx                     # Layout dành cho cổng khách hàng (Header + Footer)
│   │   └── components/
│   │       ├── Sidebar.tsx                        # Menu chuyển trạm làm việc (Lễ tân, Buồng, Bếp,...)
│   │       ├── TopNavbar.tsx                      # Thanh hiển thị tên nhân viên, ca làm việc, nút Logout
│   │       └── Breadcrumbs.tsx                    # Điều hướng phân cấp trang
│   │
│   ├── shared/                                    # Các tài nguyên dùng chung xuyên suốt dự án
│   │   ├── api/                                   # Tầng HTTP Client cốt lõi
│   │   │   ├── client.ts                          # (Giữ từ shared/api/client.ts)
│   │   │   └── client.test.ts
│   │   ├── components/                            # UI Primitives dùng chung (không dính nghiệp vụ)
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx                     # Nút bấm chuẩn
│   │   │   │   ├── Modal.tsx                      # Hộp thoại popup
│   │   │   │   ├── Table.tsx                      # Bảng dữ liệu có phân trang
│   │   │   │   ├── Badge.tsx                      # Tag hiển thị trạng thái phòng/đơn
│   │   │   │   ├── Input.tsx                      # Ô nhập liệu
│   │   │   │   ├── Select.tsx                     # Dropdown chọn
│   │   │   │   └── Card.tsx                       # Khung thẻ nội dung
│   │   │   └── feedback/
│   │   │       ├── Spinner.tsx                    # Vòng xoay loading
│   │   │       ├── Toast.tsx                      # Thông báo nổi
│   │   │       └── EmptyState.tsx                 # Hiển thị khi không có dữ liệu
│   │   ├── utils/
│   │   │   ├── encoding.ts                        # (Giữ từ shared/utils/encoding.ts)
│   │   │   ├── encoding.test.ts
│   │   │   ├── formatCurrency.ts                  # Hàm format tiền VNĐ (đang bị viết lặp nhiều nơi)
│   │   │   └── formatDate.ts                      # Hàm format ngày giờ check-in / check-out
│   │   ├── constants/
│   │   │   ├── roles.ts                           # Định nghĩa RoleId & thông tin Role
│   │   │   └── roomProfiles.ts                    # (Chuyển từ shared/roomProfiles.ts)
│   │   └── types/
│   │       ├── api.ts                             # (Giữ từ shared/types/api.ts)
│   │       ├── enterprise.ts                      # (Giữ từ shared/types/enterprise.ts)
│   │       └── common.ts                          # Các type cơ bản (Pagination, Filter, ...)
│   │
│   ├── mocks/                                     # Mock data phục vụ chạy offline / demo
│   │   └── data.ts                                # (Chuyển từ src/data.ts)
│   │
│   └── features/                                  # TẤT CẢ CÁC MODULE NGHIỆP VỤ (Vertical Slices)
│       │
│       ├── auth/                                  # Phân hệ: Xác thực & Tài khoản
│       │   ├── api/
│       │   │   ├── auth.ts                        # (Chuyển từ shared/api/auth.ts)
│       │   │   └── auth.test.ts
│       │   ├── hooks/
│       │   │   ├── useAuth.ts                     # Quản lý đăng nhập, lưu token, lấy role hiện tại
│       │   │   └── usePermissions.ts              # Hook kiểm tra quyền truy cập tính năng
│       │   ├── config/
│       │   │   └── permissions.ts                 # (Chuyển từ src/permissions.ts)
│       │   ├── components/
│       │   │   ├── LoginForm.tsx                  # Form đăng nhập
│       │   │   └── QuickRoleSwitcher.tsx          # Thanh demo chuyển nhanh role (từ App.tsx)
│       │   └── pages/
│       │       └── LoginPage.tsx                  # (Chuyển từ src/pages/LoginPage.tsx)
│       │
│       ├── front-desk/                            # Phân hệ: Lễ tân & Quản lý phòng PMS
│       │   ├── api/
│       │   │   ├── frontDesk.ts                   # (Chuyển từ shared/api/frontDesk.ts)
│       │   │   └── frontDesk.test.ts
│       │   ├── types/
│       │   │   └── frontDesk.ts                   # (Chuyển từ shared/types/frontDesk.ts)
│       │   ├── components/                        # (Bóc tách từ file FrontDeskPMS.tsx 115KB)
│       │   │   ├── RoomGrid/
│       │   │   │   ├── RoomGrid.tsx               # Lưới phòng khách sạn
│       │   │   │   ├── RoomCard.tsx               # Thẻ phòng (màu trạng thái, số phòng)
│       │   │   │   └── RoomFilterBar.tsx          # Bộ lọc theo tầng, loại phòng
│       │   │   ├── Modals/
│       │   │   │   ├── CheckInModal.tsx           # Hộp thoại nhận phòng
│       │   │   │   ├── CheckOutModal.tsx          # Hộp thoại trả phòng & thanh toán
│       │   │   │   └── RoomChangeModal.tsx        # Hộp thoại đổi phòng
│       │   │   └── ArrivalDeparture/
│       │   │       ├── ExpectedArrivals.tsx       # Bảng danh sách khách sắp tới
│       │   │       └── ExpectedDepartures.tsx     # Bảng danh sách khách sắp đi
│       │   └── pages/
│       │       └── FrontDeskPage.tsx              # (Thay thế FrontDeskPMS.tsx, chỉ còn ~150 dòng)
│       │
│       ├── housekeeping/                          # Phân hệ: Buồng phòng
│       │   ├── api/
│       │   │   ├── housekeeping.ts                # (Tách từ shared/api/housekeepingTechnical.ts)
│       │   │   └── housekeeping.test.ts
│       │   ├── types/
│       │   │   └── housekeeping.ts                # (Tách từ shared/types/housekeepingTechnical.ts)
│       │   ├── components/                        # (Bóc tách từ file HousekeepingStation.tsx 91KB)
│       │   │   ├── CleaningTaskCard.tsx           # Thẻ trạng thái phòng cần dọn
│       │   │   ├── MinibarConsumptionModal.tsx    # Modal ghi nhận đồ uống khách đã dùng
│       │   │   └── IncidentReportModal.tsx        # Modal báo hỏng thiết bị gửi sang Kỹ thuật
│       │   └── pages/
│       │       └── HousekeepingPage.tsx           # (Thay thế HousekeepingStation.tsx)
│       │
│       ├── maintenance/                           # Phân hệ: Kỹ thuật & Bảo trì
│       │   ├── api/
│       │   │   └── maintenance.ts                 # (Tách từ shared/api/housekeepingTechnical.ts)
│       │   ├── types/
│       │   │   └── maintenance.ts
│       │   ├── components/                        # (Bóc tách từ file MaintenanceStation.tsx 70KB)
│       │   │   ├── TicketList.tsx                 # Danh sách sự cố cần sửa
│       │   │   └── EquipmentCard.tsx              # Trạng thái thiết bị phòng
│       │   └── pages/
│       │       └── MaintenancePage.tsx            # (Thay thế MaintenanceStation.tsx)
│       │
│       ├── kitchen-inventory/                     # Phân hệ: Bếp, F&B & Kho Minibar
│       │   ├── api/
│       │   │   ├── kitchen.ts                     # (Tách từ shared/api/kitchenAccounting.ts)
│       │   │   └── kitchen.test.ts
│       │   ├── types/
│       │   │   └── kitchen.ts                     # (Tách từ shared/types/kitchenAccounting.ts)
│       │   ├── components/                        # (Bóc tách từ KitchenInventory.tsx 79KB)
│       │   │   ├── InventoryTable.tsx             # Bảng tồn kho nguyên liệu / minibar
│       │   │   ├── RecipeManager.tsx              # Quản lý định lượng món ăn
│       │   │   └── KitchenOrderQueue.tsx          # Danh sách order cần chế biến
│       │   └── pages/
│       │       └── KitchenInventoryPage.tsx       # (Thay thế KitchenInventory.tsx)
│       │
│       ├── accounting/                            # Phân hệ: Kế toán & Tài chính
│       │   ├── api/
│       │   │   ├── accounting.ts                  # (Tách từ shared/api/kitchenAccounting.ts)
│       │   │   └── accounting.test.ts
│       │   ├── types/
│       │   │   └── accounting.ts                  # (Tách từ shared/types/kitchenAccounting.ts)
│       │   ├── components/                        # (Bóc tách từ AccountingStation.tsx 66KB)
│       │   │   ├── InvoiceTable.tsx               # Bảng hóa đơn GTGT / VAT
│       │   │   ├── ShiftHandoverModal.tsx         # Modal bàn giao két tiền cuối ca
│       │   │   └── RevenueChart.tsx               # Biểu đồ doanh thu
│       │   └── pages/
│       │       └── AccountingPage.tsx             # (Thay thế AccountingStation.tsx)
│       │
│       ├── hr-governance/                         # Phân hệ: Nhân sự & Ca kíp
│       │   ├── api/
│       │   │   ├── hrGovernance.ts                # (Chuyển từ shared/api/hrGovernance.ts)
│       │   │   └── hrGovernance.test.ts
│       │   ├── types/
│       │   │   └── hrGovernance.ts                # (Chuyển từ shared/types/hrGovernance.ts)
│       │   ├── components/                        # (Bóc tách từ HRStation.tsx 137KB)
│       │   │   ├── EmployeeList.tsx               # Danh sách nhân viên
│       │   │   ├── ShiftScheduler.tsx             # Lịch xếp ca làm việc
│       │   │   ├── AttendanceTable.tsx            # Bảng chấm công
│       │   │   └── PayrollSummary.tsx             # Bảng tính lương
│       │   └── pages/
│       │       └── HRStationPage.tsx              # (Thay thế HRStation.tsx)
│       │
│       ├── manager/                               # Phân hệ: Báo cáo & Điều hành của Quản lý
│       │   ├── components/                        # (Bóc tách từ ManagerDashboard.tsx 54KB)
│       │   │   ├── KpiMetrics.tsx                 # Thẻ tỷ lệ lấp đầy phòng (Occupancy Rate), RevPAR
│       │   │   └── ApprovalList.tsx               # Danh sách duyệt hoàn tiền / duyệt giảm giá
│       │   └── pages/
│       │       └── ManagerDashboardPage.tsx       # (Thay thế ManagerDashboard.tsx)
│       │
│       ├── admin/                                 # Phân hệ: Quản trị hệ thống & Cấu hình
│       │   ├── api/
│       │   │   └── adminCatalog.ts                # (Chuyển từ shared/api/adminCatalog.ts)
│       │   ├── types/
│       │   │   └── adminCatalog.ts                # (Chuyển từ shared/types/adminCatalog.ts)
│       │   ├── components/                        # (Bóc tách từ AdminStation.tsx 85KB)
│       │   │   ├── RoomTypeConfig.tsx             # Cài đặt giá và hạng phòng
│       │   │   └── RoleMatrixConfig.tsx           # Cài đặt phân quyền các vai trò
│       │   └── pages/
│       │       └── AdminStationPage.tsx           # (Thay thế AdminStation.tsx)
│       │
│       ├── staff-portal/                          # Cổng dùng chung cho nhân viên tra cứu cá nhân
│       │   ├── components/
│       │   │   ├── MyShiftCalendar.tsx            # Lịch làm việc của riêng tôi
│       │   │   └── MyPayslip.tsx                  # Phiếu lương cá nhân
│       │   └── pages/
│       │       └── StaffPortalPage.tsx            # (Thay thế StaffPortal.tsx 114KB)
│       │
│       └── customer/                              # Cổng Khách hàng & Đặt phòng trực tuyến
│           ├── api/
│           │   ├── customer.ts                    # (Chuyển từ shared/api/customer.ts)
│           │   ├── public.ts                      # (Chuyển từ shared/api/public.ts)
│           │   ├── customer.test.ts
│           │   └── public.test.ts
│           ├── types/
│           │   ├── customer.ts                    # (Chuyển từ shared/types/customer.ts)
│           │   └── public.ts                      # (Chuyển từ shared/types/public.ts)
│           ├── components/                        # (Chuyển từ src/components/customer/)
│           │   ├── LuxuryHero.tsx
│           │   ├── RoomCardSection.tsx
│           │   ├── LuxuryBookingModal.tsx
│           │   ├── CuratedServicesSection.tsx
│           │   ├── AmenitiesMosaic.tsx
│           │   └── LuxuryFnBView.tsx
│           └── pages/
│               ├── LandingPage.tsx                # (Chuyển từ src/pages/LandingPage.tsx)
│               ├── CustomerPortalPage.tsx         # (Chuyển từ src/pages/CustomerPortal.tsx)
│               └── RoomDetailPage.tsx             # (Chuyển từ src/components/customer/RoomDetailPage.tsx)

## 8. Thứ tự triển khai

1. AppShell, router, login/session và permission guard.
2. Public portal chỉ đọc: phòng, trạng thái, chi tiết và dịch vụ.
3. Dashboard và workflow Lễ tân.
4. Housekeeping board, checklist và cảnh báo sự cố.
5. Kitchen/Minibar, Technical và Accounting.
6. HR, Manager, Director và Admin.
7. Pet Agent read-only sau khi API nghiệp vụ ổn định.
8. Agent action proposal sau khi confirmation, approval và audit đã có proof.

## 9. Điều kiện nghiệm thu frontend

- Anonymous chỉ gọi được API public và không thể mở route nội bộ.
- Public response không chứa PII, booking ID, invoice hoặc ghi chú nội bộ.
- Anonymous không thể tạo booking; customer chưa đăng nhập phải được chuyển tới login.
- Customer chỉ xem được booking và hướng dẫn thanh toán của chính mình.
- Booking phải hiển thị mã/QR cọc, hạn thanh toán và trạng thái do backend xác nhận.
- Mỗi role chỉ thấy navigation và hành động phù hợp.
- Ẩn nút không thay thế kiểm tra 401/403 từ backend.
- Có test cho room board, work queue, timeline và các trạng thái loading/empty/error.
- Có E2E cho login nhân viên, check-in/check-out, housekeeping handoff, payment/receipt và approval.
- Agent không thể gọi mutation nếu chưa có confirmation và authorization hợp lệ.
