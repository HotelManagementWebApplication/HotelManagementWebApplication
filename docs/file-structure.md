# Cấu trúc project

```text
web-hotel-mis/
├── backend/
│   ├── src/main/java/com/hospitality/mis/
│   │   ├── middleware/             # JWT, actor identity, authorization
│   │   ├── controller/             # REST controllers theo module
│   │   ├── service/                # xử lý nghiệp vụ theo module
│   │   ├── dao/                    # repository và persistence theo module
│   │   ├── dto/                    # request/response DTO theo module
│   │   ├── entity/                 # JPA entity và kiểu nghiệp vụ theo module
│   │   ├── common/                 # API contract, lỗi, cross-cutting concerns
│   │   ├── config/                 # Spring, database, observability
│   ├── src/main/resources/db/migration/ # canonical Flyway schema line
│   └── src/test/                   # unit, contract, integration and DB tests
├── frontend/
│   └── src/
│       ├── app/                    # bootstrap, routing, providers
│       ├── pages/               # UI theo capability nghiệp vụ
│       ├── shared/                 # API client, types, components
│       └── styles/
├── agent/
│   ├── app/                        # HTTP/chat entrypoint
│   ├── agent/                      # orchestration/state machine
│   ├── rag/                        # ingestion, retrieval, citations
│   ├── tools/                      # typed backend API tools
│   ├── policies/                   # safety and action policies
│   └── tests/
├── knowledge/sop/                  # tài liệu RAG, không chứa live data
├── infra/                          # Docker/local infrastructure
├── docs/                           # architecture, ADR, delivery plan
└── scripts/                        # developer/CI scripts
```

Backend dùng mô hình MVC và phân tầng rõ ràng:

- `middleware`: xác thực, phân quyền và xử lý request dùng chung.
- `controller`: nhận HTTP request, validate DTO và trả JSON response.
- `service`: xử lý nghiệp vụ và transaction boundary.
- `dao`: truy vấn/lưu dữ liệu qua Spring Data JPA.
- `dto`: cấu trúc dữ liệu giao tiếp API.
- `entity`: đối tượng ánh xạ bảng dữ liệu và các kiểu nghiệp vụ liên quan.

Các tầng giữ cùng tên module con, ví dụ `service/reservation` và
`entity/reservation`, để dễ tìm kiếm.

`backend/src/main/resources/db/migration/` là nơi duy nhất định nghĩa thay
đổi schema. Backend là DB writer duy nhất; frontend và agent đi qua API.

Schema hiện có 24 bảng/entity JPA, gồm 15 bảng core ban đầu và 9 bảng mở rộng
cho tài khoản khách hàng, thanh toán, biên lai, tài chính, kho, thiết bị và
lịch sử membership.

Contract dùng chung nằm tại [docs/api-contract.md](api-contract.md) và
[docs/authorization-matrix.md](authorization-matrix.md). `rule.md` giữ các
quy tắc nghiệp vụ; không tạo thêm package/module cũ chỉ để chứa tài liệu.
