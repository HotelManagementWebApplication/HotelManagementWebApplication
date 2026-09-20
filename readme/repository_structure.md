# HotelManagementSystem (Root Repository)
HotelManagementSystem/

│
├── frontend/                         # Giao diện người dùng (React)
│
├── backend/                          # Server API + nghiệp vụ
│
├── database/                         # Thiết kế CSDL
│
├── docs/                             # Tài liệu dự án
│
├── .gitignore
├── README.md
└── docker-compose.yml
## Frontend
Công nghệ:
React
TypeScript
React Router
Axios
TailwindCSS/Ant Design

**Cấu trúc**

frontend/

│
├── public/
│   ├── favicon.ico
│   └── index.html
│
│
├── src/
│
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   │
│   ├── components/
│   │
│   │   ├── common/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   └── Loading/
│   │   │
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── MainLayout.tsx
│   │
│   │
│   ├── features/
│   │
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Profile.tsx
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │
│   │
│   │   ├── dashboard/
│   │   │   └── Dashboard.tsx
│   │
│   │
│   │   ├── customers/
│   │   │   ├── pages/
│   │   │   │   ├── CustomerList.tsx
│   │   │   │   ├── CustomerDetail.tsx
│   │   │   │   └── CustomerForm.tsx
│   │   │   ├── components/
│   │   │   └── services/
│   │
│   │
│   │   ├── employees/
│   │   │   ├── pages/
│   │   │   └── services/
│   │
│   │
│   │   ├── rooms/
│   │   │   ├── pages/
│   │   │   │   ├── RoomList.tsx
│   │   │   │   ├── RoomType.tsx
│   │   │   │   └── RoomStatus.tsx
│   │   │   ├── components/
│   │   │   └── services/
│   │
│   │
│   │   ├── booking/
│   │   │   ├── pages/
│   │   │   │   ├── BookingList.tsx
│   │   │   │   ├── BookingDetail.tsx
│   │   │   │   └── CreateBooking.tsx
│   │   │   └── services/
│   │
│   │
│   │   ├── checkin-checkout/
│   │   │   ├── pages/
│   │   │   │   ├── CheckIn.tsx
│   │   │   │   └── CheckOut.tsx
│   │
│   │
│   │   ├── services/
│   │   │   ├── pages/
│   │   │   │   ├── ServiceList.tsx
│   │   │   │   └── ServiceOrder.tsx
│   │
│   │
│   │   ├── payment/
│   │   │   ├── pages/
│   │   │   │   ├── Invoice.tsx
│   │   │   │   └── Payment.tsx
│   │
│   │
│   │   ├── maintenance/
│   │   │   ├── pages/
│   │   │   └── components/
│   │
│   │
│   │   ├── reports/
│   │   │   ├── RevenueReport.tsx
│   │   │   └── CustomerHistory.tsx
│   │
│   │
│   ├── routes/
│   │   ├── AppRoutes.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   ├── services/
│   │   ├── api.ts
│   │   └── axiosClient.ts
│   │
│   ├── hooks/
│   │
│   ├── store/
│   │   └── authStore.ts
│   │
│   ├── utils/
│   │
│   ├── App.tsx
│   └── main.tsx
│
└── package.json

## Backend
Công nghệ:
Spring boot

**Cấu trúc**

backend/

│
├── src/main/java/com/hotel/
│
│
├── config/
│   ├── SecurityConfig.java
│   └── DatabaseConfig.java
│
│
├── modules/
│
│   ├── auth/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── entity/
│   │   └── dto/
│
│
│   ├── customer/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── entity/
│   │   └── dto/
│
│
│   ├── room/
│
│   ├── booking/
│
│   ├── employee/
│
│   ├── service/
│
│   ├── payment/
│
│   ├── maintenance/
│
│   ├── report/
│
│   └── audit/
│
│
├── middleware/
│
├── exception/
│
├── utils/
│
└── Application.java

## Database
**Cấu trúc**

database/

│
├── design/
│   ├── ERD.drawio
│   └── DatabaseDiagram.png
│
│
├── scripts/
│
│   ├── create_database.sql
│   ├── create_table.sql
│   ├── constraint.sql
│   ├── trigger.sql
│   ├── procedure.sql
│   └── sample_data.sql
│
└── backup/
    └── hotel_management.bak

## DOCS(Báo cáo)
**Cấu trúc**

docs/

│
├── 01_Requirements/
│   ├── UseCaseDiagram
│   └── UseCaseSpecification
│
├── 02_Analysis/
│   ├── ActivityDiagram
│   └── SequenceDiagram
│
├── 03_Design/
│   ├── ClassDiagram
│   ├── ERD
│   └── DatabaseDesign
│
├── 04_UI/
│   ├── Wireframe
│   └── Mockup
│
└── 05_Report/
    └── BaoCao.docx