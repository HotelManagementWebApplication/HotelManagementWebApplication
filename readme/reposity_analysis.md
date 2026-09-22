# 🏨 Hotel Management System

## 1. Overview

**Hotel Management System** là hệ thống quản lý vận hành khách sạn, hỗ trợ số hóa các nghiệp vụ:

- Quản lý khách hàng.
- Quản lý phòng và loại phòng.
- Quản lý đặt phòng.
- Quản lý check-in/check-out.
- Quản lý dịch vụ lưu trú.
- Quản lý hóa đơn và thanh toán.
- Quản lý nhân viên và lịch làm việc.
- Quản lý bảo trì thiết bị.
- Báo cáo thống kê.

---

# 2. System Architecture

Dự án được xây dựng theo mô hình phân tách:

```
HotelManagementSystem

        |
        |
        +---------------+
        |               |
   Frontend          Backend
   (React)           (API)

        |
        |
    Database
```

### Frontend
Chịu trách nhiệm:
- Hiển thị giao diện người dùng.
- Xử lý tương tác người dùng.
- Gọi API từ Backend.

### Backend
Chịu trách nhiệm:
- Xử lý nghiệp vụ.
- Kiểm tra dữ liệu.
- Phân quyền người dùng.
- Kết nối cơ sở dữ liệu.
- Cung cấp REST API.

### Database
Chịu trách nhiệm:
- Lưu trữ dữ liệu khách sạn.
- Quản lý quan hệ giữa các thực thể.

---

# 3. Repository Structure

```
HotelManagementSystem/

├── frontend/
├── backend/
├── database/
├── docs/
├── README.md
└── docker-compose.yml
```

---

# 4. Frontend Structure

```
frontend/

└── src/

    ├── assets/
    ├── components/
    ├── features/
    ├── routes/
    ├── services/
    ├── hooks/
    └── store/
```

## assets/
Chứa tài nguyên giao diện:
- Hình ảnh.
- Icon.
- Font.

## components/
Chứa các thành phần giao diện dùng chung.

Ví dụ:
```
components/

├── common/
│   ├── Button
│   ├── Table
│   └── Modal

└── layout/
    ├── Header
    ├── Sidebar
    └── MainLayout
```

## features/
Chứa các module nghiệp vụ:

```
features/

├── auth/
├── customers/
├── employees/
├── rooms/
├── booking/
├── services/
├── payment/
├── maintenance/
└── reports/
```

---

# 5. Backend Structure

```
backend/

└── src/

    ├── config/
    ├── modules/
    ├── middleware/
    ├── exception/
    └── utils/
```

## modules/

```
modules/

├── customer/
├── room/
├── booking/
├── employee/
├── payment/
├── maintenance/
└── report/
```

Mỗi module:

```
module/

├── controller/
├── service/
├── repository/
├── entity/
└── dto/
```

| Thành phần | Vai trò |
|-|-|
| Controller | Tiếp nhận request API |
| Service | Xử lý nghiệp vụ |
| Repository | Làm việc với Database |
| Entity | Mô hình dữ liệu |
| DTO | Dữ liệu trao đổi |

---

# 6. Database Structure

```
database/

├── design/
├── scripts/
└── backup/
```

## design/
Chứa:
- ERD.
- Database Diagram.

## scripts/
Bao gồm:

```
create_database.sql
create_table.sql
constraint.sql
trigger.sql
procedure.sql
sample_data.sql
```

---

# 7. Documentation Structure

```
docs/

├── requirements/
├── analysis/
├── design/
├── ui/
└── report/
```

- requirements: Use Case, yêu cầu chức năng.
- analysis: Activity Diagram, Sequence Diagram.
- design: Class Diagram, ERD, Database Design.
- ui: Wireframe, Mockup.
- report: Báo cáo đồ án.

---

# 8. Main Functional Modules

| Module | Description |
|-|-|
| Authentication | Đăng nhập, quản lý tài khoản |
| Customer | Quản lý khách hàng |
| Employee | Quản lý nhân viên |
| Room | Quản lý phòng |
| Booking | Quản lý đặt phòng |
| Check-in/out | Quản lý nhận trả phòng |
| Service | Quản lý dịch vụ |
| Payment | Hóa đơn và thanh toán |
| Maintenance | Bảo trì thiết bị |
| Report | Báo cáo thống kê |

---

# 9. Development Workflow

```
User

 ↓

Frontend

 ↓

REST API

 ↓

Backend

 ↓

Database
```

Ví dụ:

```
Customer Form

        ↓

POST /api/customers

        ↓

Customer Controller

        ↓

Customer Service

        ↓

Customer Repository

        ↓

Customer Database
```

---

# 10. Development Goal

Repository được xây dựng nhằm:

- Tách biệt giao diện và nghiệp vụ.
- Dễ bảo trì và mở rộng.
- Dễ phân chia công việc nhóm.
- Áp dụng quy trình phát triển phần mềm thực tế.
