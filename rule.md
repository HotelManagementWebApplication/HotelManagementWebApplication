# Tài liệu quy tắc nghiệp vụ — bản phát hành đầu tiên

## 1. Phạm vi và thứ tự ưu tiên

- Bản phát hành đầu tiên quản lý **một khách sạn**.
- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh` (Hà Nội).
- Đơn vị tiền tệ: `VND`.
- Khi tài liệu nguồn, kế hoạch hoặc mã hiện có mâu thuẫn với quyết định mới nhất của chủ sở hữu, **quyết định mới nhất của chủ sở hữu được ưu tiên**. Không được giữ hành vi cũ để tương thích ngầm.
- Các điểm chưa được quyết định phải ghi là **Chưa chốt**; **Không được tự suy đoán**.

## 2. Hợp đồng chuẩn (canonical contract)

- Tên trường Java, trạng thái, sự kiện, tham số API và các định danh nghiệp vụ dùng tiếng Anh, thống nhất trong toàn hệ thống.
- Tên bảng/cột vật lý SQL Server dùng hợp đồng tiếng Việt không dấu đã chốt trong `backend/src/main/resources/db/migration/V1__baseline_schema.sql`; JPA mapping, native SQL, tài liệu và test phải dùng đúng hợp đồng vật lý này.
- Đây là hard cut: không có legacy alias, không dual-read, không dual-write, không compatibility facade và không có runtime owner cũ.
- API, schema, tài liệu và test phải cùng tuân theo hợp đồng chuẩn hiện hành.
- `customer-policy.md` là nguồn sự thật duy nhất cho điều khoản, quyền lợi, phụ thu và giá dịch vụ công bố cho khách. Không chép các điều khoản đó thành bản thứ hai ở đây; mọi hành vi hệ thống liên quan phải khớp tài liệu chính sách khách hàng.

## 3. Thuê phòng, nhận phòng và gia hạn

- Các điều khoản khách hàng phải tuân theo được quy định duy nhất tại `customer-policy.md` mục 1. Giao diện, báo giá và backend phải thực hiện đúng các điều khoản đó.
- Phải lưu `actual_check_in_at` và `actual_check_out_at` (timestamp) bên cạnh thời điểm lịch đặt.
- Chìa khóa hoặc thẻ có thể được mở đúng tối đa 5 phút trước giờ nhận phòng theo lịch, nhưng không được ghi nhận check-in thực tế trước giờ đó.
- Gia hạn phải tuân thủ điều kiện khách hàng tại `customer-policy.md` mục 1 và không được tạo giao nhau với booking khác.

## 4. Trả phòng muộn

- Các mốc và mức phụ thu áp dụng cho khách được định nghĩa tại `customer-policy.md` mục 2; không tạo bản sao mức phí tại đây.
- Tính phụ thu trên giá phòng trước khi áp dụng giảm giá VIP.

## 5. Đặt phòng và khả dụng

- Giới hạn số phòng khách được đặt được định nghĩa tại `customer-policy.md` mục 3.
- Mọi thao tác đặt phòng phải bảo toàn khả dụng phòng và ngăn đặt chồng (overlap).
- Việc chuyển trạng thái phải hợp lệ theo state machine hiện hành; không được bỏ qua trạng thái hoặc cập nhật tùy ý.
- Phải gắn thao tác với actor đã xác thực, hỗ trợ idempotency, và dùng khóa SQL Server phù hợp để kiểm tra/cập nhật khả dụng một cách nguyên tử.
- Các kiểm tra khả dụng, chuyển trạng thái, ghi dữ liệu liên quan và sự kiện audit phải nằm trong ranh giới transaction thích hợp.

## 6. Hủy đặt phòng và no-show

- Thời hạn, khoản tiền khách phải chịu và các giới hạn liên quan khi hủy được quy định tại `customer-policy.md` mục 4.
- Nếu khách chưa check-in khi booking hết hiệu lực, chuyển sang `NO_SHOW`; không được chuyển trạng thái này trước giờ trả phòng dự kiến.
- Booking `NO_SHOW` không được ghi nhận là lượt lưu trú VIP.

## 7. Đặt cọc, hóa đơn và thanh toán

- Các khoản tiền, cách làm tròn, biên lai và phương thức thanh toán công bố cho khách được quy định tại `customer-policy.md` mục 5.
- Công thức tổng tiền phải trả: `room + surcharge + services/minibar + compensation + extensions - deposit - discount`.
- Không xóa cứng hóa đơn; phải dùng hủy hóa đơn.
- Đối soát theo ca đối với tiền mặt, thẻ và chuyển khoản.

## 8. VIP

- Điều kiện hạng, quyền lợi và tác động của vi phạm đối với khách được quy định tại `customer-policy.md` mục 6.
- Theo dõi tổng chi tiêu tích lũy và số lượt lưu trú hoàn tất bằng hai bộ đếm độc lập.
- Số giờ dùng để xét lượt lấy từ thời lượng đã đặt trong booking (`expected_check_in` đến `expected_check_out`), không lấy thời gian check-in/check-out thực tế. Chỉ ghi nhận lượt theo điều kiện hoàn tất checkout trong chính sách khách hàng.
- Giữ bộ đếm vi phạm cộng dồn và áp dụng đúng điều kiện hạ hạng được công bố; không tự suy đoán hành vi khi khách ở hạng Regular.

## 9. Bồi thường thiết bị

- Các mức bồi thường công bố cho khách được quy định tại `customer-policy.md` mục 7.

## 10. Phê duyệt và audit

- DIRECTOR xem toàn bộ báo cáo, phê duyệt hoàn tiền và thay đổi giá.
- Giá phòng/thay đổi giá do TECHNICAL tạo ở trạng thái `DRAFT` chỉ có hiệu lực sau khi MANAGER hoặc DIRECTOR phê duyệt. TECHNICAL không được tự phê duyệt cấu hình hoặc giá do mình tạo.
- Thay đổi giá dịch vụ do KITCHEN tạo phải được MANAGER phê duyệt.
- Khi cần phê duyệt quản lý, phải ghi `approver_id` và lý do (`reason`) trong audit.
- Quy tắc hiện có cho phép FRONT_DESK tự phê duyệt hoàn tiền mâu thuẫn với quyết định mới nhất của chủ sở hữu. Quyết định mới nhất được áp dụng: hoàn tiền do DIRECTOR phê duyệt.
- Không được mở rộng ngầm phạm vi từ “hoàn tiền” sang các trường hợp khác ngoài đúng phạm vi chủ sở hữu đã nêu; phần mở rộng đó là **Chưa chốt — Không được tự suy đoán**.

## 11. Vai trò, module và phân quyền

- Có module Nhân sự và phân ca. HR quản lý hồ sơ nhân viên và phân ca; HR không xem lương/tài chính và không tự cấp hoặc đổi role.
- DIRECTOR xem toàn bộ báo cáo, phê duyệt hoàn tiền và thay đổi giá; DIRECTOR được cấp mọi role, kể cả ADMIN, nhưng không tự đổi role.
- ADMIN quản trị toàn hệ thống nhưng không quản lý DIRECTOR; ADMIN được cấp mọi role trừ DIRECTOR.
- MANAGER trực tiếp quản lý FRONT_DESK, HOUSEKEEPING, TECHNICAL và KITCHEN; MANAGER được cấp các role cấp dưới gồm HR, FRONT_DESK, HOUSEKEEPING, TECHNICAL, KITCHEN, ACCOUNTING và STAFF; MANAGER không được cấp ADMIN hoặc DIRECTOR.
- FRONT_DESK thực hiện reservation, check-in/out, chuyển phòng, dịch vụ/minibar và giao ca; FRONT_DESK không xem báo cáo tài chính. FRONT_DESK cùng role được xử lý reservation do ca khác tạo.
- HOUSEKEEPING thực hiện dọn phòng, checklist, cập nhật trạng thái vệ sinh và báo sự cố; HOUSEKEEPING không tự đưa phòng sang `AVAILABLE`.
- TECHNICAL tạo phòng, loại phòng, thiết bị và cấu hình kỹ thuật ở trạng thái `DRAFT`; giá phòng/thay đổi giá chưa có hiệu lực cho tới khi MANAGER hoặc DIRECTOR duyệt; TECHNICAL không tự duyệt cấu hình/giá của mình.
- KITCHEN quản lý dịch vụ, minibar, kho tổng và tồn minibar từng phòng; đổi giá dịch vụ cần MANAGER duyệt.
- ACCOUNTING độc lập quản lý hóa đơn, thanh toán, thu/chi và công nợ; ACCOUNTING không sửa reservation hoặc trạng thái phòng, kể cả sau approval. Chỉ FRONT_DESK hoặc MANAGER mới sửa reservation/phòng; ACCOUNTING chỉ ghi nhận tài chính.
- STAFF chỉ xem dữ liệu cơ bản.
- Khách chưa đăng nhập trên public portal chỉ được xem DTO công khai của phòng, trạng thái phòng và các dịch vụ đang hoạt động. Không được xem PII, người đặt/đang ở, booking, invoice, payment, receipt, ghi chú hoặc dữ liệu nội bộ. CUSTOMER đã đăng nhập được phép tạo booking cho chính mình và nhận mã/hướng dẫn thanh toán tiền cọc; chỉ được xem tóm tắt booking và trạng thái thanh toán của chính mình, không được xem dữ liệu của khách khác hoặc giao diện quản trị.
- Không ai tự đổi role, tự cấp quyền vượt ceiling hoặc tự khóa tài khoản.

## 12. Trạng thái thao tác và giao ca

- Check-in, đổi phòng và checkout do FRONT_DESK thực hiện.
- Trạng thái cần dọn và đã dọn do HOUSEKEEPING thực hiện.
- Đưa phòng vào bảo trì và kết thúc bảo trì do TECHNICAL thực hiện.
- Chuyển phòng trong reservation do FRONT_DESK thực hiện.
- Giao ca tự tính `expected_amount` từ payment ledger; không nhận `expected_amount` từ client.

## 13. Điều cấm khi triển khai

- Không duy trì runtime owner cũ, legacy alias, dual-read hoặc dual-write.
- Không cho phép writer trực tiếp vào DB ngoài backend.
- Mọi request ghi dữ liệu hoặc đọc dữ liệu nội bộ phải gắn với actor đã xác thực; không tin `actor_id` do client tự khai báo. Endpoint public chỉ đọc được miễn xác thực nhưng bắt buộc trả DTO công khai theo allow-list.
- Khi cần phê duyệt quản lý, requester và approver phải là hai vai trò/người tách biệt.
- Phải kiểm tra state trước mọi chuyển trạng thái và tôn trọng ranh giới transaction.
- Phải ghi audit event cho các thay đổi cần truy vết.
- API, schema, tài liệu và test phải follow đúng tài liệu này; test không được tạo ra một hợp đồng hoặc nhánh tương thích riêng.

## 14. Quyết định đã chốt bổ sung

Cập nhật ngày 12/09/2026:

1. Điều khoản khách hàng, bao gồm cách tính lượt VIP và mốc hủy 48 giờ, chỉ được định nghĩa trong `customer-policy.md`; không lặp lại hoặc duy trì bản thứ hai trong quy tắc nội bộ.
2. Phát hành đầu tiên tiếp tục là Hotel OS cho một khách sạn; chưa triển khai multi-hotel/multi-tenant.
3. Public portal có hai lớp: anonymous chỉ xem DTO công khai của phòng/chi tiết phòng/dịch vụ; CUSTOMER phải đăng nhập đầy đủ mới được tạo booking cho chính mình và nhận mã/hướng dẫn thanh toán cọc. Customer không được xem dữ liệu khách khác hoặc giao diện quản trị.
4. Tất cả dịch vụ đang hoạt động đều được public; dịch vụ ngừng phục vụ không public để tránh hiểu lầm.
5. MANAGER phân công housekeeping; HOUSEKEEPING nhận và cập nhật tiến độ. TECHNICAL báo hoàn thành, MANAGER nghiệm thu, sau đó TECHNICAL mở khóa phòng.
6. Ảnh phòng lưu local trong giai đoạn đầu, tối đa 10 ảnh/phòng, 5 MB/ảnh, hỗ trợ JPEG, PNG và WebP.
7. Pet Agent chỉ tư vấn, giải thích, tra cứu/tóm tắt trong quyền actor và đề xuất thao tác. Mọi mutation cần người dùng xác nhận, backend kiểm tra quyền, approval khi cần và audit; agent không được ghi trực tiếp database.

## 15. Dịch vụ khách sạn — quy tắc triển khai

- Điều khoản, quyền lợi và giá khách hàng nhìn thấy được định nghĩa duy nhất trong `customer-policy.md` mục 8.
- Dịch vụ khách sạn thuộc khách sạn; bỏ mô hình đối tác thuê mặt bằng, nhượng quyền, voucher và quyết toán hoa hồng thương mại. Công nợ với nhà cung cấp hàng hóa/vật tư vẫn được theo dõi.
- Chỉ CUSTOMER có booking hợp lệ mới được đặt dịch vụ trên web. Endpoint public chỉ công bố DTO của dịch vụ đang hoạt động.
- Phần sử dụng trong hạn mức miễn phí phải có giá phải thu bằng `0`. Phần vượt hạn mức phải tính theo giá đã niêm yết, nêu rõ trên hóa đơn. Dịch vụ tính phí do khách sạn vận hành được cộng vào hóa đơn phòng và thanh toán lúc checkout.
- Chỉ cho phép đặt trước dịch vụ sau khi booking được xác nhận đã thanh toán cọc. Đơn đặt dịch vụ gắn với reservation/phòng, có trạng thái ban đầu `CONFIRMED`, và chỉ chuyển sang `USED` khi reservation đã `CHECKED_IN`.
- Khi booking phòng bị hủy, chuyển `NO_SHOW` hoặc checkout, các dịch vụ chưa dùng tự động chuyển `CANCELLED`. Chỉ dịch vụ đã dùng mới được cộng vào hóa đơn.
- Khi tạo booking, lưu tổng số khách của từng phòng để kiểm tra quyền lợi theo số khách; không bắt buộc tách người lớn và trẻ em.
- Giá niêm yết ban đầu và đơn giá áp dụng cho khách được quản lý theo `customer-policy.md` mục 8. Các lần đổi giá tiếp theo tuân thủ quy trình duyệt giá dịch vụ.

## Tham chiếu nguồn

Các điểm đối chiếu từ DOCX extraction: P20, P21, P70–P78, T101R6, T101R12, T101R13, T101R15, T112R1, T115R1, T134R2, T139R1, T177R2. Khi tham chiếu nào khác với quyết định cuối của chủ sở hữu, áp dụng quyết định cuối và ghi nhận mâu thuẫn tương ứng.

## 16. Sender email OTP local

- `spring.mail.username` và `spring.mail.password` trong `backend/src/main/resources/application.yml` là cấu hình bắt buộc để gửi OTP local/demo. Không xóa, để rỗng, đổi sender hoặc rotate hai giá trị này trong cleanup thông thường.
- Giữ `MailConfigurationTest` và kiểm tra nó trong backend test gate; test phải fail nếu một trong hai cấu hình bị mất hoặc YAML comment lọt vào giá trị.
- Khi SMTP lỗi, API phải trả lỗi rõ ràng; không ghi OTP ra log và không báo đã gửi thành công.
- Chủ repo tự quyết định việc rà soát credential khi chuẩn bị push public. Không tự thay đổi sender local trước quyết định đó.
