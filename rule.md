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

## 3. Thuê phòng

| Nội dung | Quy tắc |
|---|---|
| Loại thuê | Theo giờ hoặc gói ngày-đêm. |
| Thời lượng tối thiểu theo giờ | 3 giờ. Ở dưới 3 giờ thì tính tiền 3 giờ, không từ chối giao dịch. |
| Đơn vị thời lượng | Chỉ nhận số giờ nguyên. |
| Phút lẻ | Thời lượng yêu cầu có phút lẻ không được chấp nhận; ví dụ `4h15` được đặt/tính thành 5 giờ, còn `4h` là hợp lệ. |
| Gia hạn | Chỉ được gia hạn khi không tạo giao nhau với lượt đặt khác và yêu cầu được gửi ít nhất 1 giờ trước giờ trả phòng. |
| Thời điểm thực tế | Phải lưu `actual_check_in_at` và `actual_check_out_at` (timestamp), bên cạnh thời điểm lịch đặt nếu có. |

Ví dụ: yêu cầu thuê 2 giờ vẫn lập hóa đơn 3 giờ; yêu cầu 4 giờ 15 phút lập hóa đơn 5 giờ; yêu cầu đúng 4 giờ giữ nguyên 4 giờ.

### Nhận phòng sớm

Không có early check-in. Chìa khóa hoặc thẻ có thể được mở đúng tối đa 5 phút trước giờ nhận phòng theo lịch để cho phép khách vào, nhưng `actual_check_in_at` chỉ hợp lệ từ đúng giờ nhận phòng theo lịch.

## 4. Trả phòng muộn

Mức phụ thu được tính theo thời điểm trả phòng muộn như sau:

| Thời điểm trả phòng | Phụ thu |
|---|---:|
| Đến `12:20` | Miễn phí |
| `12:21`–`14:00` | 15% |
| `14:01`–`16:00` | 20% |
| `16:01`–`18:00` | 50% |
| `18:01`–`00:00` | 100% |
| Sau `00:00` | 100% giá phòng của ngày trước, tương đương thêm 1 đêm |

Quyết định cuối của chủ sở hữu là mốc `12:21` bắt đầu phụ thu. Một tài liệu nguồn ghi `12:01`; đây là điểm không nhất quán cần được gắn cờ, và mốc `12:21` mới nhất được áp dụng (tham chiếu DOCX: P20, P21, P70–P78; T101R6, T101R12, T101R13, T101R15).

Phụ thu trả phòng muộn được tính trên giá phòng trước khi áp dụng giảm giá VIP.

## 5. Đặt phòng và khả dụng

- Một khách tối đa đặt 3 phòng cho cùng một kỳ lưu trú.
- Mọi thao tác đặt phòng phải bảo toàn khả dụng phòng và ngăn đặt chồng (overlap).
- Việc chuyển trạng thái phải hợp lệ theo state machine hiện hành; không được bỏ qua trạng thái hoặc cập nhật tùy ý.
- Phải gắn thao tác với actor đã xác thực, hỗ trợ idempotency, và dùng khóa SQL Server phù hợp để kiểm tra/cập nhật khả dụng một cách nguyên tử.
- Các kiểm tra khả dụng, chuyển trạng thái, ghi dữ liệu liên quan và sự kiện audit phải nằm trong ranh giới transaction thích hợp.

## 6. Hủy đặt phòng

Trong tài liệu này, “hủy vào phút chót/hủy sát giờ” nghĩa là hủy trong vòng 48 giờ trước giờ nhận phòng theo lịch.

| Thời điểm hủy | Kết quả |
|---|---|
| Hơn 48 giờ trước giờ nhận phòng | Miễn phí theo chính sách free-before-48-hours. |
| Trong vòng 48 giờ trước giờ nhận phòng, bao gồm đúng mốc 48 giờ | Mất tiền đặt cọc. |
| Hơn 3 lần hủy gần giờ nhận phòng | Khóa các lượt đặt trong tương lai; tức lần hủy thứ 4 thuộc nhóm này là lần bắt đầu khóa. |

Khách vẫn được check-in bất cứ lúc nào trong thời gian đặt phòng còn hiệu lực, trước giờ trả dự kiến. Nếu hết thời gian đặt phòng mà khách chưa check-in thì chuyển sang `NO_SHOW` và mất tiền đặt cọc; không hoàn cọc trong trường hợp này. Không được chuyển `NO_SHOW` trước giờ trả dự kiến. Không thu thêm khoản phí hủy nào ngoài tiền đặt cọc; hủy trong vòng 48 giờ trước giờ nhận phòng chỉ mất tiền đặt cọc.

## 7. Đặt cọc, hóa đơn và thanh toán

- Tiền đặt cọc bằng 50% giá phòng.
- Tiền đặt cọc đã thu được trừ khỏi tổng hóa đơn và không được thu lại trong số tiền phải trả.
- Công thức tổng tiền phải trả:

  `room + surcharge + services/minibar + compensation + extensions - deposit - discount`

- Ví dụ: hóa đơn 2.000.000 VND, đã đặt cọc 500.000 VND, còn phải trả 1.500.000 VND.
- Phương thức thanh toán: tiền mặt, thẻ/POS, chuyển khoản ngân hàng.
- Phải có biên lai cho tiền cọc, tiền phòng và dịch vụ; đồng thời phải đối soát ca tiền mặt, thẻ và chuyển khoản.
- Không xóa cứng hóa đơn; phải dùng hủy hóa đơn.
- Chỉ làm tròn **tổng hóa đơn cuối cùng**, không làm tròn từng dòng. Tổng hóa đơn cuối cùng được làm tròn đến 1.000 VND gần nhất: phần dư dưới 500 VND thì làm tròn xuống; phần dư từ 500 VND trở lên thì làm tròn lên. Ví dụ: `1.250.500` VND thành `1.251.000` VND.

## 8. VIP

Phải theo dõi độc lập cả tổng chi tiêu tích lũy và số lượt lưu trú đã hoàn tất. Số giờ dùng để tính lượt lấy theo thời lượng đã đặt trong booking, từ `expected_check_in` đến `expected_check_out`, không lấy theo thời gian check-in/check-out thực tế. Booking có thời lượng dưới 24 giờ được tính 0 lượt; booking có thời lượng từ đủ 24 giờ trở lên được tính đúng 1 lượt, dù thời lượng là 48 giờ, 72 giờ hoặc dài hơn. Một booking nhiều phòng của cùng khách vẫn chỉ tính 1 lượt. Booking bị hủy hoặc chuyển `NO_SHOW` không được tính lượt; chỉ ghi nhận lượt sau khi checkout hoàn tất.

| Hạng | Điều kiện theo lượt lưu trú hoàn tất | Giảm trên giá phòng |
|---|---:|---:|
| Silver | 10 lượt | 5% |
| Gold | 25 lượt | 10% |
| Platinum | 50 lượt | 15% |

Giảm VIP chỉ áp dụng trên giá phòng, không mặc định áp dụng lên phụ thu, dịch vụ/minibar, bồi thường hoặc khoản khác. Ngưỡng theo tổng chi tiêu vẫn áp dụng theo bảng trên; cách tính lượt cho lưu trú một phần và thuê theo giờ đã chốt theo thời lượng đặt trong booking như quy định tại khoản này.

Phải giữ các bộ đếm vi phạm cộng dồn; các lượt vi phạm không cần liên tiếp. Khi số lần trả phòng muộn vượt quá 3, hoặc số lần hủy vào phút chót/hủy sát giờ (tức hủy trong vòng 48 giờ trước giờ nhận phòng theo lịch) vượt quá 2, hạ đúng 1 hạng VIP. Đây là cùng một bộ đếm hủy trong vòng 48 giờ được nêu tại mục Hủy đặt phòng. Sau khi hạ hạng, các bộ đếm vẫn được giữ nguyên và tiếp tục cộng dồn; mỗi lần vượt ngưỡng tiếp theo hạ thêm 1 hạng nếu còn có thể. Không tự suy đoán hành vi khi khách đã ở hạng Regular.

## 9. Bồi thường thiết bị

| Tuổi thiết bị | Mức bồi thường |
|---|---:|
| `<= 2` năm | 150% giá trị thiết bị |
| `> 2` năm | 200% giá trị thiết bị |

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

1. Lượt VIP lấy theo thời lượng đặt trong booking (`expected_check_in` → `expected_check_out`). Dưới 24 giờ không tính; từ đủ 24 giờ trở lên tính đúng 1 lượt cho mỗi booking hoàn tất, không nhân theo số chu kỳ 24 giờ hoặc số phòng. Hủy và `NO_SHOW` không tính lượt.
2. Đúng 48 giờ trước giờ nhận phòng được xem là hủy trong vòng 48 giờ và mất cọc. Không thu thêm phí hủy ngoài tiền đặt cọc.
3. Phát hành đầu tiên tiếp tục là Hotel OS cho một khách sạn; chưa triển khai multi-hotel/multi-tenant.
4. Public portal có hai lớp: anonymous chỉ xem phòng/chi tiết phòng/dịch vụ bằng DTO riêng; CUSTOMER phải đăng nhập đầy đủ mới được tạo booking cho chính mình và nhận mã/hướng dẫn thanh toán cọc. Customer không được xem dữ liệu khách khác hoặc giao diện quản trị.
5. Tất cả dịch vụ đang hoạt động đều được public; dịch vụ ngừng phục vụ không public để tránh hiểu lầm.
6. MANAGER phân công housekeeping; HOUSEKEEPING nhận và cập nhật tiến độ. TECHNICAL báo hoàn thành, MANAGER nghiệm thu, sau đó TECHNICAL mở khóa phòng.
7. Ảnh phòng lưu local trong giai đoạn đầu, tối đa 10 ảnh/phòng, 5 MB/ảnh, hỗ trợ JPEG, PNG và WebP.
8. Pet Agent chỉ tư vấn, giải thích, tra cứu/tóm tắt trong quyền actor và đề xuất thao tác. Mọi mutation cần người dùng xác nhận, backend kiểm tra quyền, approval khi cần và audit; agent không được ghi trực tiếp database.

## 15. Dịch vụ của khách sạn (quyết định ngày 22/09/2026)

- Nhà hàng MaM Restaurant, spa và các dịch vụ phục vụ khách lưu trú thuộc khách sạn. Bỏ toàn bộ mô hình đối tác thuê mặt bằng, nhượng quyền, voucher và quyết toán hoa hồng thương mại. Công nợ với nhà cung cấp hàng hóa/vật tư vẫn được theo dõi. Khách không thuê phòng không được đặt dịch vụ trên web.
- Giao diện phải hiển thị rõ `Miễn phí` hoặc đơn giá dịch vụ. Không dùng nhãn `Theo chính sách` để thay cho giá `0`; giá `0` trong danh mục không đủ để xác định khách có được miễn phí hay không. Dòng dịch vụ tính phí phải có đơn giá xác định trước khi khách xác nhận.
- Một booking thuê theo gói ngày-đêm được hưởng các quyền lợi sau trong thời gian lưu trú: hồ bơi miễn phí không giới hạn lượt cho số khách đã đăng ký trong booking; giặt ủi tiêu chuẩn miễn phí một lần/đơn mỗi ngày cho mỗi phòng; bữa sáng tại phòng miễn phí một suất mỗi ngày cho mỗi khách; MaM Restaurant miễn phí cho từng khách một bữa trưa và một bữa tối mỗi ngày. Hồ bơi chỉ hiển thị thông tin trên web, không đặt trước.
- Booking thuê theo giờ không hưởng các quyền lợi miễn phí trên; nếu sử dụng dịch vụ thì tính phí theo giá đã niêm yết.
- Phần sử dụng trong hạn mức miễn phí có giá phải thu bằng `0`. Phần vượt hạn mức phải tính phí theo giá đã niêm yết và ghi rõ trên hóa đơn. Dịch vụ tính phí do khách sạn vận hành được cộng vào hóa đơn phòng, thanh toán lúc checkout.
- Khách có thể đặt trước dịch vụ sau khi booking được xác nhận đã thanh toán cọc. Đơn đặt dịch vụ gắn với reservation/phòng và lưu trong `hotel_service_bookings`; trạng thái ban đầu `CONFIRMED`. Chỉ được ghi nhận `USED` khi reservation đã `CHECKED_IN`. Booking phòng bị hủy, no-show hoặc checkout thì các dịch vụ chưa dùng tự động chuyển `CANCELLED`. Chỉ dịch vụ đã dùng mới được cộng vào hóa đơn.
- Khi tạo booking, lưu tổng số khách của từng phòng để kiểm tra quyền lợi theo số khách; không bắt buộc tách người lớn và trẻ em.
- Giá niêm yết ban đầu do chủ sở hữu ủy quyền thiết lập: hồ bơi 200.000 VND/khách/ngày; giặt ủi tiêu chuẩn 80.000 VND/lần; bữa sáng tại phòng 450.000 VND/suất; MaM Restaurant 250.000 VND/suất; gym 100.000 VND/khách/ngày. Giá này áp dụng cho khách thuê theo giờ và phần vượt hạn mức của khách thuê theo gói. Các lần đổi giá sau đó tuân thủ quy trình duyệt giá dịch vụ.

## Tham chiếu nguồn

Các điểm đối chiếu từ DOCX extraction: P20, P21, P70–P78, T101R6, T101R12, T101R13, T101R15, T112R1, T115R1, T134R2, T139R1, T177R2. Khi tham chiếu nào khác với quyết định cuối của chủ sở hữu, áp dụng quyết định cuối và ghi nhận mâu thuẫn tương ứng.

## 16. Sender email OTP local

- `spring.mail.username` và `spring.mail.password` trong `backend/src/main/resources/application.yml` là cấu hình bắt buộc để gửi OTP local/demo. Không xóa, để rỗng, đổi sender hoặc rotate hai giá trị này trong cleanup thông thường.
- Giữ `MailConfigurationTest` và kiểm tra nó trong backend test gate; test phải fail nếu một trong hai cấu hình bị mất hoặc YAML comment lọt vào giá trị.
- Khi SMTP lỗi, API phải trả lỗi rõ ràng; không ghi OTP ra log và không báo đã gửi thành công.
- Chủ repo tự quyết định việc rà soát credential khi chuẩn bị push public. Không tự thay đổi sender local trước quyết định đó.
