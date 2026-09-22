# 💻 Frontend - Hotel Management System (Giao Diện Người Dùng)

Phần giao diện người dùng (Client-side) của Hệ thống Quản lý Khách sạn được xây dựng bằng **React (TypeScript)** kết hợp với công cụ build hiện đại **Vite**, thư viện định tuyến **React Router**, quản lý trạng thái tập trung **Zustand** và thư viện HTTP client **Axios**.

---

## 📁 Chi tiết công dụng từng thư mục và tệp tin

### 1. Thư mục gốc Frontend (`frontend/`)

| Tệp tin / Thư mục | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`package.json`** | Khai báo toàn bộ thông tin dự án, cấu hình các lệnh script (`dev`, `build`, `preview`) và danh sách các thư viện phụ thuộc (dependencies: `react`, `react-router-dom`, `zustand`, `axios`, `lucide-react`...) cùng các công cụ phát triển (`typescript`, `vite`). |
| **`tsconfig.json`** | Cấu hình trình biên dịch TypeScript (strict mode, JSX support, path alias `@/*` ánh xạ tới thư mục `src/*`). |
| **`vite.config.ts`** | Tệp cấu hình của Vite: thiết lập React plugin, cấu hình port chạy dev (3000) và thiết lập alias đường dẫn. |
| **`index.html`** | File HTML nền tảng của ứng dụng Single Page Application (SPA), chứa thẻ `<div id="root"></div>` để React mount giao diện vào. |
| **`README.md`** | Tài liệu hướng dẫn, giải thích chi tiết cấu trúc thư mục và quy chuẩn phát triển giao diện. |

---

### 2. Thư mục `public/`
Chứa các tài nguyên tĩnh không cần qua quá trình đóng gói/biên dịch của Vite, được trình duyệt truy cập trực tiếp tại thư mục gốc URL `/`.

| Tệp tin | Công dụng |
| :--- | :--- |
| **`public/favicon.ico`** | Biểu tượng icon hiển thị trên tiêu đề tab của trình duyệt web. |
| **`public/index.html`** | Bản sao/mẫu dự phòng của file HTML giao diện người dùng. |

---

### 3. Thư mục `src/` (Mã nguồn chính)
Chứa toàn bộ mã nguồn phát triển ứng dụng React:

#### 3.1. Các tệp tin gốc trong `src/`
| Tệp tin | Công dụng |
| :--- | :--- |
| **`src/main.tsx`** | Điểm khởi đầu (Entry Point) của ứng dụng, chịu trách nhiệm khởi tạo `ReactDOM.createRoot()` và nạp component gốc `App.tsx` vào DOM. |
| **`src/App.tsx`** | Component gốc cao nhất của ứng dụng, thiết lập `BrowserRouter` và bao bọc toàn bộ hệ thống định tuyến `AppRoutes`. |
| **`src/index.css`** | Thiết lập CSS Reset toàn cục, font chữ hệ thống và các biến màu sắc giao diện mặc định. |

---

#### 3.2. `src/assets/` (Tài nguyên hình ảnh & phông chữ)
Lưu trữ các tệp đa phương tiện tĩnh được import trực tiếp vào các component:
- **`src/assets/images/`**: Lưu trữ hình ảnh tĩnh (logo khách sạn, ảnh banner, ảnh mẫu các hạng phòng Standard, Deluxe, Suite...).
- **`src/assets/icons/`**: Lưu trữ các biểu tượng SVG, icon định dạng riêng của khách sạn.
- **`src/assets/fonts/`**: Lưu trữ các bộ phông chữ tùy biến nội bộ (Inter, Roboto...).

---

#### 3.3. `src/components/` (Các Component dùng chung)
Chứa các thành phần giao diện tái sử dụng trên nhiều trang khác nhau:

##### a) `src/components/common/` (Component nguyên tử - Atom/Molecule UI)
- **`Button/` (`Button.tsx`, `index.ts`)**: Nút bấm chuẩn hóa dùng chung toàn hệ thống (hỗ trợ các biến thể: `primary`, `secondary`, `danger`, `outline` và các kích cỡ `sm`, `md`, `lg`).
- **`Input/` (`Input.tsx`, `index.ts`)**: Ô nhập liệu chuẩn hóa có sẵn nhãn (label) và thông báo lỗi hợp lệ hóa dữ liệu (error message).
- **`Modal/` (`Modal.tsx`, `index.ts`)**: Hộp thoại cửa sổ bật lên (popup dialog) phục vụ xác nhận, chỉnh sửa nhanh hoặc xem chi tiết.
- **`Table/` (`Table.tsx`, `index.ts`)**: Bảng dữ liệu linh hoạt (Generic Table) hỗ trợ phân trang, truyền cột động theo kiểu dữ liệu Generic `T`.
- **`Loading/` (`Loading.tsx`, `index.ts`)**: Biểu tượng hiệu ứng xoay đang tải dữ liệu (spinner) khi gọi API bất đồng bộ.

##### b) `src/components/layout/` (Bố cục khung trang)
- **`Sidebar.tsx`**: Thanh điều hướng bên trái màn hình chứa logo và các menu điều hướng nhanh (Dashboard, Quản lý phòng, Đặt phòng, Khách hàng, Dịch vụ, Báo cáo...).
- **`Header.tsx`**: Thanh tiêu đề phía trên cùng hiển thị tiêu đề hệ thống, thông tin tài khoản đang đăng nhập và nút Đăng xuất.
- **`MainLayout.tsx`**: Khung bố cục chuẩn kết hợp `Sidebar`, `Header` và vùng hiển thị nội dung chính thông qua thẻ `<Outlet />` của React Router.

---

#### 3.4. `src/features/` (Các Module nghiệp vụ - Feature-based Architecture)
Mỗi thư mục đại diện cho một phân hệ nghiệp vụ cụ thể, đóng gói riêng biệt các trang (pages), component nội bộ, gọi API (services) và định nghĩa kiểu dữ liệu (types):

| Module | Thư mục & Tệp | Công dụng & Nghiệp vụ |
| :--- | :--- | :--- |
| **`auth/`** | `pages/Login.tsx`<br>`pages/Profile.tsx`<br>`services/authService.ts`<br>`types.ts` | **Xác thực & Người dùng**:<br>- `Login.tsx`: Màn hình đăng nhập tài khoản nhân viên/quản lý.<br>- `Profile.tsx`: Màn hình xem & cập nhật hồ sơ cá nhân.<br>- `authService.ts`: Hàm gọi API đăng nhập, lấy thông tin user.<br>- `types.ts`: Định nghĩa kiểu dữ liệu `User`, `LoginCredentials`. |
| **`dashboard/`** | `Dashboard.tsx` | **Tổng quan hệ thống**:<br>Trang chủ hiển thị các thẻ thống kê nhanh (KPIs): số phòng đang có khách, lượt đặt phòng hôm nay, lượt check-in và tổng doanh thu trong ngày. |
| **`customers/`** | `pages/CustomerList.tsx`<br>`pages/CustomerDetail.tsx`<br>`pages/CustomerForm.tsx`<br>`services/customerService.ts` | **Quản lý Khách hàng**:<br>- `CustomerList.tsx`: Xem danh sách khách hàng, tìm kiếm theo tên/CCCD.<br>- `CustomerDetail.tsx`: Xem chi tiết lịch sử lưu trú của khách.<br>- `CustomerForm.tsx`: Thêm mới hoặc chỉnh sửa hồ sơ khách.<br>- `customerService.ts`: API CRUD thông tin khách hàng. |
| **`employees/`** | `pages/EmployeeList.tsx`<br>`services/employeeService.ts` | **Quản lý Nhân sự**:<br>Xem danh sách nhân viên, phân công ca trực, vai trò quyền hạn (Lễ tân, Quản lý, Kế toán, Buồng phòng). |
| **`rooms/`** | `pages/RoomList.tsx`<br>`pages/RoomType.tsx`<br>`pages/RoomStatus.tsx`<br>`services/roomService.ts` | **Quản lý Phòng**:<br>- `RoomList.tsx`: Danh sách phòng theo tầng, hiển thị trực quan.<br>- `RoomType.tsx`: Quản lý các hạng phòng (Standard, Deluxe, VIP...) và bảng giá niêm yết.<br>- `RoomStatus.tsx`: Quản lý tình trạng phòng (Trống, Đang ở, Đang dọn, Đang bảo trì).<br>- `roomService.ts`: API lấy và cập nhật trạng thái phòng. |
| **`booking/`** | `pages/BookingList.tsx`<br>`pages/BookingDetail.tsx`<br>`pages/CreateBooking.tsx`<br>`services/bookingService.ts` | **Nghiệp vụ Đặt phòng**:<br>- `BookingList.tsx`: Danh sách phiếu đặt phòng theo trạng thái.<br>- `BookingDetail.tsx`: Xem thông tin chi tiết phòng đặt, số khách, tiền cọc.<br>- `CreateBooking.tsx`: Form tạo đơn đặt phòng mới, chọn ngày đến/đi.<br>- `bookingService.ts`: API xử lý tạo và hủy phiếu đặt phòng. |
| **`checkin-checkout/`**| `pages/CheckIn.tsx`<br>`pages/CheckOut.tsx` | **Lưu trú & Tiếp đón**:<br>- `CheckIn.tsx`: Thủ tục nhận phòng, đối chiếu CCCD và bàn giao chìa khóa.<br>- `CheckOut.tsx`: Thủ tục trả phòng, tổng hợp chi phí phòng & dịch vụ phát sinh để thanh toán. |
| **`services/`** | `pages/ServiceList.tsx`<br>`pages/ServiceOrder.tsx` | **Dịch vụ Khách sạn**:<br>- `ServiceList.tsx`: Danh mục dịch vụ (ăn uống, giặt ủi, spa, xe đưa đón).<br>- `ServiceOrder.tsx`: Biểu mẫu gọi và đặt dịch vụ vào phòng cho khách. |
| **`payment/`** | `pages/Invoice.tsx`<br>`pages/Payment.tsx` | **Hóa đơn & Thanh toán**:<br>- `Invoice.tsx`: Mẫu xem và in hóa đơn thanh toán chi tiết.<br>- `Payment.tsx`: Ghi nhận hình thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ). |
| **`maintenance/`** | `pages/MaintenanceList.tsx` | **Bảo trì Thiết bị**:<br>Ghi nhận báo hỏng thiết bị (điều hòa, khóa cửa...), theo dõi tiến độ sửa chữa của kỹ thuật viên. |
| **`reports/`** | `RevenueReport.tsx`<br>`CustomerHistory.tsx` | **Báo cáo & Thống kê**:<br>- `RevenueReport.tsx`: Biểu đồ và bảng thống kê doanh thu theo ngày/tháng/năm.<br>- `CustomerHistory.tsx`: Báo cáo tần suất và mức độ chi tiêu của khách hàng. |

---

#### 3.5. `src/routes/` (Điều hướng)
- **`AppRoutes.tsx`**: Khai báo cây định tuyến URL toàn ứng dụng bằng `<Routes>` và `<Route>`, phân luồng các trang công khai (Login) và các trang nội bộ yêu cầu đăng nhập.
- **`ProtectedRoute.tsx`**: Higher-Order Component kiểm tra trạng thái xác thực (`isAuthenticated`). Nếu chưa đăng nhập, tự động chuyển hướng (`Navigate`) về trang `/login`.

---

#### 3.6. `src/services/` (Giao tiếp mạng API)
- **`api.ts`**: Chứa hằng số đường dẫn gốc `API_BASE_URL` và danh mục các endpoint URL của server backend.
- **`axiosClient.ts`**: Khởi tạo cấu hình axios instance với `interceptor`:
  - Request Interceptor: Tự động trích xuất token JWT từ `localStorage` và gán vào header `Authorization: Bearer <token>`.
  - Response Interceptor: Tự động trích xuất dữ liệu trả về `response.data` và bắt lỗi 401 Unauthorized để điều hướng đăng nhập lại.

---

#### 3.7. `src/store/` (Quản lý trạng thái State Management)
- **`authStore.ts`**: Lưu trữ trạng thái xác thực toàn cục sử dụng thư viện **Zustand** (lưu trữ: thông tin người dùng `user`, token, cờ `isAuthenticated`, hàm `login()` và hàm `logout()`).

---

#### 3.8. `src/hooks/` (Custom React Hooks)
- **`useAuth.ts`**: Hook tùy biến giúp các component dễ dàng truy cập thông tin người dùng và hàm đăng xuất từ `authStore`.

---

#### 3.9. `src/utils/` (Hàm tiện ích)
- **`formatters.ts`**: Các hàm định dạng hiển thị:
  - `formatCurrency(amount)`: Định dạng tiền tệ chuẩn VNĐ (ví dụ: `1.500.000 ₫`).
  - `formatDate(date)`: Định dạng ngày tháng năm chuẩn Việt Nam (`DD/MM/YYYY`).
