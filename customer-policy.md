
# Quy định dành cho khách hàng

Tài liệu này là nguồn chính thức cho các điều khoản và quyền lợi khách hàng.
Tài liệu nội bộ `rule.md` chỉ quy định cách hệ thống và nhân viên thực hiện;
chatbot khách hàng không nạp tài liệu nội bộ.

Tình trạng phòng, giá phòng hiện tại và danh mục/đơn giá dịch vụ đang hoạt động
phải lấy từ API trực tiếp. Nếu API trả về dữ liệu hiện tại thì dữ liệu đó được
ưu tiên hơn mức giá tham khảo ban đầu trong tài liệu này; không dùng RAG để
thay thế dữ liệu API.

Chatbot phân biệt hai loại thông tin:

- Quy định, quy trình và hướng dẫn ổn định được tra trong tài liệu này.
- Giá, phòng trống, trạng thái phòng, dịch vụ đang hoạt động, trạng thái
  booking và trạng thái thanh toán phải được tra từ API tại thời điểm khách
  hỏi. Chatbot không dùng nội dung cũ trong hội thoại để thay cho lần tra mới.

Chatbot hiện chỉ tra cứu và hướng dẫn. Việc đặt phòng, thanh toán, hủy phòng,
thêm ngày, đổi ngày và đặt dịch vụ phải được khách thực hiện bằng chức năng
tương ứng trên website. Chatbot không được nói rằng một thao tác đã hoàn tất
nếu chưa nhận được kết quả thành công từ backend.

Các mức tiền được tính bằng VND. Thời gian áp dụng theo giờ Việt Nam
(`Asia/Ho_Chi_Minh`). Nếu một nội dung chưa được chốt ở đây, chatbot không tự
suy đoán và sẽ hướng khách liên hệ khách sạn để xác nhận.

## 1. Thuê phòng và nhận phòng

- Khách có thể thuê theo giờ hoặc theo gói ngày-đêm.
- Thời lượng thuê theo giờ được tính bằng giờ nguyên. Thời lượng dưới 3 giờ
  được tính tiền 3 giờ. Thời lượng có phút lẻ được làm tròn lên giờ kế tiếp:
  ví dụ 4 giờ 15 phút tính thành 5 giờ; đúng 4 giờ tính 4 giờ.
- Khách có thể yêu cầu gia hạn nếu không ảnh hưởng lượt đặt kế tiếp và gửi yêu
  cầu ít nhất 1 giờ trước giờ trả phòng dự kiến.
- Khách sạn không phục vụ nhận phòng sớm. Thời gian nhận phòng áp dụng theo
  giờ đã xác nhận trong booking.
- Ví dụ: nếu booking ghi nhận phòng lúc 14:00 mà khách đến lúc 08:00, khách
  chưa được nhận phòng ngay. Khách có thể gửi hành lý miễn phí và quay lại làm
  thủ tục theo giờ đã xác nhận. Chỉ khi chính booking ghi giờ nhận là 08:00 thì
  08:00 mới là giờ nhận phòng hợp lệ.
- Với booking ngày-đêm theo giờ tiêu chuẩn, nhận phòng lúc 14:00 và trả phòng
  lúc 12:00, trừ khi booking đã xác nhận ghi giờ khác.
- Người đứng tên booking và làm thủ tục nhận phòng phải trên 18 tuổi, xuất
  trình CCCD bản gốc còn hiệu lực. Yêu cầu giấy tờ đối với khách đi cùng chưa
  được quy định thêm trong tài liệu này.
- Khách đến trước giờ nhận phòng hoặc cần gửi hành lý sau checkout được giữ
  hành lý miễn phí tại quầy Concierge/Bellman ở sảnh tầng 1. Hành lý được gắn
  thẻ nhận riêng; khách nên tự giữ tiền mặt, trang sức và đồ giá trị cao.
- Khách đến thăm phải đăng ký thông tin và xuất trình giấy tờ tại lễ tân; chỉ
  được ở cùng khách lưu trú đến trước 22:00. Nếu ở lại qua đêm, khách thăm phải
  được đăng ký thành khách lưu trú, trong giới hạn sức chứa phòng. Mọi khoản
  phụ thu (nếu có) phải được khách sạn xác nhận trước.
- Khách tự gửi yêu cầu gia hạn thêm đêm trên đơn đặt phòng trước giờ nhận phòng
  **hơn 48 giờ**. Phần thêm phải bắt đầu đúng tại giờ checkout hiện tại, không
  được tạo ngày trống ở giữa. Tiền cọc đã trả tiếp tục áp dụng cho các đêm cũ;
  khách thanh toán bổ sung 50% tiền phòng của các đêm mới theo giá hiện tại từ
  API. Gia hạn chỉ hoàn tất sau khi hệ thống xác nhận phòng còn trống, sẵn sàng
  và nhận đủ cọc bổ sung.
- Khách chỉ được đổi ngày trước giờ nhận phòng **hơn 48 giờ**, phải giữ nguyên
  số đêm đã đặt và không phát sinh thêm tiền cọc. Nếu muốn tăng số đêm, khách
  dùng chức năng gia hạn. Lịch mới chỉ có hiệu lực khi database xác nhận tất cả
  phòng trong booking còn trống và sẵn sàng.
- Trong vòng 48 giờ trước giờ nhận phòng, bao gồm đúng mốc 48 giờ, khách không
  được thêm đêm hoặc đổi ngày trên đơn đã xác nhận.

## 2. Trả phòng muộn

Phụ thu được tính theo giờ trả phòng:

| Giờ trả phòng | Phụ thu |
|---|---:|
| Đến 12:20 | Miễn phí |
| 12:21–14:00 | 15% |
| 14:01–16:00 | 20% |
| 16:01–18:00 | 50% |
| 18:01–24:00 | 100% |
| Sau 24:00 | 100% giá phòng của ngày trước, tương đương thêm 1 đêm |

Phụ thu được tính trên giá phòng trước khi áp dụng giảm giá VIP.

## 3. Đặt phòng

- Mỗi khách được đặt tối đa 3 phòng cho cùng một kỳ lưu trú.
- Booking phụ thuộc vào tình trạng phòng còn khả dụng.
- Trẻ em dưới 6 tuổi không tính là một suất khách (slot) khi kiểm tra sức chứa
  phòng và có thể ngủ chung trên giường hiện có với bố mẹ, không bắt buộc đặt
  giường phụ. Gia đình vẫn phải khai báo trẻ đi cùng khi làm thủ tục. Nếu khách
  yêu cầu giường phụ, nôi hoặc dịch vụ riêng thì khả dụng và giá được kiểm tra
  theo danh mục hiện tại; quyền lợi ăn uống hoặc phụ thu riêng theo độ tuổi
  chưa được chốt nên chatbot không tự suy diễn.
- Website hiện lưu số khách đăng ký theo từng phòng, chưa thu ngày sinh của
  từng trẻ trong bước đặt phòng. Vì vậy việc áp dụng ngoại lệ trẻ dưới 6 tuổi
  và kiểm tra giấy tờ được nhân viên xác nhận khi làm thủ tục; chatbot không tự
  sửa số khách hoặc tự bảo đảm một phòng chắc chắn đủ sức chứa.

## 4. Hủy phòng và không đến nhận phòng

Thời hạn được tính ngược từ giờ nhận phòng theo lịch đã xác nhận:

| Thời điểm hủy | Chính sách |
|---|---|
| Hơn 48 giờ trước giờ nhận phòng | Miễn phí hủy |
| Trong vòng 48 giờ, bao gồm đúng mốc 48 giờ | Mất tiền đặt cọc; không thu thêm phí hủy |

- Từ lần hủy trong vòng 48 giờ thứ tư trở đi, khách sạn khóa các lượt đặt phòng
  trong tương lai.
- Khách có thể nhận phòng trong thời gian booking còn hiệu lực, trước giờ trả
  phòng dự kiến. Nếu hết thời gian booking mà khách chưa nhận phòng, booking
  được xem là không đến (`NO_SHOW`) và tiền đặt cọc không được hoàn lại.

## 5. Tiền đặt cọc, hóa đơn và thanh toán

- Tiền đặt cọc bằng 50% giá phòng.
- Tiền đặt cọc đã thanh toán được trừ vào tổng hóa đơn; khách không phải trả lại
  khoản này lần thứ hai.
- Tổng tiền cuối cùng có thể gồm tiền phòng, phụ thu, dịch vụ/minibar, bồi
  thường và gia hạn; sau đó trừ tiền đặt cọc và khoản giảm giá áp dụng.
- Khách sạn nhận thanh toán bằng tiền mặt, thẻ/POS hoặc chuyển khoản ngân hàng.
- Hóa đơn cuối cùng được làm tròn đến 1.000 VND gần nhất. Phần dư dưới 500 VND
  làm tròn xuống; từ 500 VND trở lên làm tròn lên. Ví dụ: 1.250.500 VND thành
  1.251.000 VND.
- Khách được cấp biên lai cho tiền đặt cọc, tiền phòng và dịch vụ.

## 6. Hạng thành viên VIP

Các mốc dưới đây tính theo số lượt lưu trú hoàn tất:

| Hạng | Số lượt lưu trú | Giảm trên giá phòng |
|---|---:|---:|
| Silver | 10 | 5% |
| Gold | 25 | 10% |
| Platinum | 50 | 15% |

- Lượt lưu trú được ghi nhận sau khi checkout hoàn tất. Booking bị hủy hoặc
  không đến nhận phòng không được tính.
- Booking combo ngày-đêm (hình thức thuê theo gói) được tính 1 lượt khi
  checkout hoàn tất. Một đêm tiêu chuẩn nhận phòng lúc 14:00 và trả phòng
  lúc 12:00 ngày hôm sau, tương đương 22 giờ, không phải 24 giờ. Booking
  nhiều đêm hoặc nhiều phòng của cùng khách vẫn chỉ tính 1 lượt.
- Booking theo giờ không được tính lượt VIP, kể cả kéo dài nhiều ngày.
  Không áp dụng ngưỡng thời lượng 24 giờ để xét lượt. Khách đến muộn hoặc
  trả sớm không làm đổi hình thức thuê đã xác nhận của booking.
- Khách sạn theo dõi riêng số lượt lưu trú và tổng chi tiêu tích lũy. Ngưỡng
  xét hạng theo tổng chi tiêu chưa được chốt trong tài liệu này; khách vui lòng
  liên hệ khách sạn để xác nhận.
- Giảm VIP chỉ áp dụng trên giá phòng, không áp dụng mặc định cho phụ thu,
  dịch vụ/minibar, bồi thường hoặc khoản khác.
- Các lần trả phòng muộn và hủy sát giờ được cộng dồn, không cần liên tiếp.
  Khi trả phòng muộn quá 3 lần hoặc hủy trong vòng 48 giờ quá 2 lần, hạng VIP
  giảm 1 bậc. Mỗi lần vượt ngưỡng tiếp theo tiếp tục giảm 1 bậc nếu còn hạng để
  giảm. Quy tắc hạ hạng không xác định thêm hành vi khi khách ở hạng Regular.

## 7. Bồi thường thiết bị

Mức bồi thường thiết bị bị hư hỏng được tính theo tuổi thiết bị:

| Tuổi thiết bị | Mức bồi thường |
|---|---:|
| Từ 2 năm trở xuống | 150% giá trị thiết bị |
| Trên 2 năm | 200% giá trị thiết bị |

## 8. Dịch vụ khách sạn

- Nhà hàng MaM Restaurant, spa và các dịch vụ phục vụ khách lưu trú thuộc
  khách sạn. Khách không thuê phòng không thể đặt dịch vụ trên website.
- Website hiển thị rõ dịch vụ miễn phí hoặc đơn giá. Dịch vụ tính phí phải có
  đơn giá xác định trước khi khách xác nhận.
- Khách thuê theo gói ngày-đêm được hưởng trong thời gian lưu trú:
  - Hồ bơi miễn phí, không giới hạn lượt cho số khách đã đăng ký. Hồ bơi chỉ
    hiển thị thông tin trên website, không nhận đặt trước.
  - Giặt ủi tiêu chuẩn miễn phí 1 lần/đơn mỗi ngày cho mỗi phòng.
  - Bữa sáng tại phòng miễn phí 1 suất mỗi ngày cho mỗi khách.
  - MaM Restaurant miễn phí 1 bữa trưa và 1 bữa tối mỗi ngày cho mỗi khách.
- Khách thuê theo giờ không có các quyền lợi miễn phí trên; dịch vụ sử dụng
  được tính theo giá niêm yết.
- Phần sử dụng trong hạn mức miễn phí không tính tiền. Phần vượt hạn mức tính
  theo giá niêm yết và được ghi rõ trên hóa đơn. Dịch vụ tính phí do khách sạn
  vận hành được cộng vào hóa đơn phòng và thanh toán lúc checkout.
- Khách có thể đặt trước dịch vụ sau khi booking được xác nhận đã thanh toán
  tiền đặt cọc. Dịch vụ chưa sử dụng sẽ bị hủy khi booking phòng bị hủy, khách
  không đến nhận phòng hoặc đã checkout. Chỉ dịch vụ đã sử dụng mới được tính
  vào hóa đơn.
- Trên website, khách mở đơn đặt phòng của mình, chọn **Đặt thêm dịch vụ**,
  chọn phòng, dịch vụ, thời gian nằm trong kỳ lưu trú và số lượng. MaM
  Restaurant yêu cầu chọn bữa trưa hoặc bữa tối; hồ bơi chỉ hiển thị thông tin
  và không nhận đặt trước. Nếu backend chấp nhận, yêu cầu dịch vụ có trạng thái
  **Đã xác nhận**. Khách có thể hủy dịch vụ chưa sử dụng trong đơn đặt phòng;
  dịch vụ đã sử dụng không thể hủy.

- Đơn giá hiện hành của dịch vụ được tra từ danh mục dịch vụ đang hoạt động qua
  API trước khi khách xác nhận. Giá này áp dụng cho khách thuê theo giờ và phần
  vượt hạn mức của khách thuê theo gói ngày-đêm. Nếu không tra được dịch vụ hoặc
  giá hiện hành, chatbot không dùng bảng giá cũ hay tự ước đoán; khách vui lòng
  liên hệ khách sạn để xác nhận.

### Thông tin giờ hoạt động và sử dụng tiện ích

- MaM Restaurant ở tầng 2: buffet sáng 06:30–10:00, bữa trưa 11:30–14:00 và
  bữa tối 18:00–22:00 hằng ngày. Bữa sáng tại phòng phục vụ 06:00–10:30.
- Khách có thể yêu cầu món chay, không gluten hoặc kiêng đường; cần báo trước
  ít nhất 2 giờ. Với dị ứng thực phẩm, khách phải báo rõ thành phần dị ứng và
  chờ nhà hàng xác nhận khả năng đáp ứng trước khi đặt món.
- Hồ bơi và Jacuzzi mở cửa 06:00–21:00. Khách cần mặc đồ bơi phù hợp; không
  mang đồ ăn hoặc ly thủy tinh vào khu vực hồ. Trẻ dưới 12 tuổi phải có người
  lớn giám sát. Hồ bơi không nhận đặt chỗ trước.
- Phòng gym mở cửa 06:00–22:00. Tên dịch vụ và đơn giá hiện hành, nếu có, được
  xác nhận theo danh mục dịch vụ đang hoạt động.
- Spa hoạt động 09:00–21:00, nhận lượt cuối lúc 20:00. Khách nên gửi yêu cầu
  đặt lịch trước ít nhất 2 giờ; lịch cần được khách sạn xác nhận.
- Với xe Limousine sân bay, khách nên gửi yêu cầu trước ít nhất 12 giờ và cung
  cấp số hiệu chuyến bay để khách sạn kiểm tra khả năng sắp xếp. Tên dịch vụ,
  tình trạng cung cấp và giá hiện tại lấy từ API; booking chỉ có hiệu lực sau
  khi được xác nhận.
- Nôi em bé cho trẻ dưới 2 tuổi được cung cấp miễn phí theo yêu cầu, số lượng
  có hạn; khách nên đăng ký trước.

## 9. Nội quy, an toàn và hỗ trợ khách

- Không tiếp nhận thú cưng trong khách sạn; khách cần hỗ trợ bằng chó dẫn đường
  có chứng nhận nên liên hệ khách sạn trước khi đến để được xác nhận phương án.
- Cấm hút thuốc và thuốc lá điện tử trong phòng cũng như khu vực trong nhà.
  Khách chỉ hút thuốc tại khu vực ngoài trời được khách sạn chỉ định; ban công
  không mặc nhiên là khu vực hút thuốc.
- Nếu hút thuốc trong phòng gây mùi, phí khử mùi chuyên sâu là 2.000.000 VND
  mỗi lần.
- Không mang sầu riêng, mít chín hoặc hải sản tươi sống vào phòng nghỉ.
- Không sử dụng flycam/drone trong khuôn viên nếu chưa được Ban Giám đốc cho
  phép.
- Đồ thất lạc được lưu giữ tối đa 90 ngày. Khách có thể yêu cầu lễ tân hỗ trợ
  gửi chuyển phát; phí vận chuyển (nếu có) được thông báo trước.
- Bộ sơ cứu cơ bản có tại lễ tân 24/7. Khi cần hỗ trợ y tế khẩn cấp, khách vui
  lòng liên hệ lễ tân để được hỗ trợ gọi cơ sở y tế.

## 10. Nhà hàng, dịch vụ sự kiện và yêu cầu hóa đơn

- Khách có nhu cầu xuất hóa đơn điện tử cho doanh nghiệp cần cung cấp tên công
  ty, mã số thuế và địa chỉ đăng ký thuế trước hoặc tại thời điểm checkout.
  Thuế suất áp dụng theo quy định hiện hành; tài liệu này không cố định một mức
  thuế suất.
- Phòng họp đa năng ở tầng 4 có sức chứa công bố từ 10 đến 200 khách, trang bị
  màn hình LED 4K và hệ thống âm thanh. Khách vui lòng liên hệ khách sạn để xác
  nhận tình trạng và giá hiện hành trước khi đặt.

## 11. Thông tin MaM Hotel & Resort

### Nhận diện và khu vực

- Tên sử dụng với khách hàng là **MaM Hotel** hoặc **MaM Hotel &
  Luxury Retreat**.
- Khách sạn được giới thiệu tại **Vũng Tàu, Việt Nam**.
- Địa chỉ: **Số 1 VVN, Vũng Tàu, Việt Nam**.
- Khách lưu trú được đỗ xe miễn phí tại tầng hầm B1 trong thời gian booking còn
  hiệu lực. Bãi xe hoạt động 24/7, có 35 chỗ ô tô và 80 chỗ xe máy, phục vụ
  theo thứ tự xe đến trước. Không nhận giữ chỗ trước qua website.
- Lối xuống hầm giới hạn chiều cao xe 2,1 m. Xe trên 16 chỗ, xe cao hơn 2,1 m
  hoặc đoàn từ 5 ô tô trở lên cần liên hệ trước ít nhất 24 giờ; khách sạn sẽ
  xác nhận chỗ trong khuôn viên hoặc hướng dẫn bãi đỗ liên kết gần nhất.
- Khách nhận thẻ xe khi vào bãi và xuất trình thẻ khi lấy xe. Khách làm mất thẻ
  cần xuất trình CCCD cùng thông tin booking để nhân viên đối chiếu; mọi khoản
  phí phát sinh nếu có phải được thông báo trước.
- Website giới thiệu WiFi trong toàn khu, hồ bơi, spa, gym, ẩm thực và dịch vụ
  đưa đón. Việc một tiện ích đang mở hay một dịch vụ còn nhận khách tại thời
  điểm cụ thể phải được kiểm tra theo API hoặc xác nhận với nhân viên.

### Lễ tân, WiFi và hỗ trợ tiếp cận

- Lễ tân và hỗ trợ khách lưu trú hoạt động 24/7. Concierge/Bellman hỗ trợ hành
  lý tại sảnh tầng 1.
- WiFi miễn phí trong phòng và khu vực chung. Tên mạng và mật khẩu được cung
  cấp khi check-in; chatbot không công khai mật khẩu dùng chung trong câu trả
  lời. Khi kết nối gặp lỗi, khách cung cấp số phòng cho lễ tân để được hỗ trợ.
- Lối vào sảnh, thang máy và hai vị trí đỗ xe gần thang máy B1 có thể tiếp cận
  bằng xe lăn. Khách sạn có 2 xe lăn cho mượn miễn phí theo thứ tự đăng ký.
- Phòng tắm hỗ trợ người khuyết tật không có ở mọi hạng phòng. Khách cần liên
  hệ trước khi đặt để nhân viên xác nhận đúng phòng phù hợp; chatbot không tự
  gán một phòng là phòng tiếp cận nếu API không công bố đặc điểm đó.

### Kênh liên hệ

- Hotline: **1900 6789**.
- Email: **retreat@mamresort.vn**.
- Website: **www.mamresort.vn**.
- Lễ tân là đầu mối hỗ trợ khách đang lưu trú, nhận hành lý, sự cố phòng, hỗ
  trợ y tế ban đầu và các yêu cầu chưa có chức năng tự phục vụ trên website.
- Chatbot không nhận số thẻ thanh toán, mật khẩu, mã OTP hoặc ảnh đầy đủ hai
  mặt CCCD. Khi cần đối soát booking, khách chỉ nên cung cấp mã booking qua
  kênh chính thức.

## 12. Hướng dẫn chọn hạng phòng

### Dữ liệu phòng phải lấy từ hệ thống

Tên phòng, mã phòng, hạng phòng, diện tích, loại giường, hướng nhìn, sức chứa,
tiện nghi, ảnh, giá theo đêm, giá theo giờ và khả dụng đều là dữ liệu được quản
lý trên website. Khi khách hỏi một phòng cụ thể, chatbot phải lấy dữ liệu hiện
tại từ API và không dùng giá hoặc tình trạng phòng ghi nhớ từ lần hỏi trước.

### Cách hiểu các nhóm phòng

- **Standard (STD)** hướng đến nhu cầu lưu trú gọn gàng và các tiện nghi thiết
  yếu. Hệ thống có thể có biến thể một giường hoặc hai giường.
- **Superior (SUP)** có không gian và trang bị nâng cấp hơn Standard; biến thể
  cụ thể có thể khác về giường, diện tích và sức chứa.
- **Deluxe (DLX)** hướng đến không gian rộng và trải nghiệm cao cấp hơn; bản
  Family phù hợp nhóm đông hơn nhưng vẫn phải tuân theo sức chứa API công bố.
- **Suite (SUT)** có khu vực sinh hoạt riêng và nhiều tiện nghi hơn. Không được
  mặc định mọi Suite đều có cùng hướng nhìn hoặc cùng loại giường.
- **VIP/biệt thự nguyên căn** ưu tiên không gian riêng tư và tiện nghi cao cấp.
  Tên gọi VIP của phòng không đồng nghĩa khách tự động có hạng thành viên VIP.

Đây là hướng dẫn để hiểu nhóm phòng, không phải cam kết về một phòng cụ thể.
Khi tư vấn, chatbot nên hỏi ngày nhận, ngày trả, số khách, nhu cầu giường và
ngân sách, sau đó dùng API để đưa ra các lựa chọn còn khả dụng.

## 13. Hướng dẫn đặt phòng và quản lý đơn trên website

### Tạo booking mới

1. Khách xem danh sách hoặc trang chi tiết phòng; thông tin phòng và giá được
   tải từ hệ thống.
2. Khách chọn thuê theo đêm hoặc theo giờ, thời gian lưu trú và số khách. Thuê
   theo giờ tối thiểu 3 giờ; thuê theo đêm dùng giờ tiêu chuẩn 14:00–12:00.
3. Khách phải đăng nhập tài khoản để gửi booking. Họ tên, số điện thoại và giấy
   tờ đại diện được lấy từ hồ sơ; email xác nhận có thể được nhập trong biểu
   mẫu.
4. Backend kiểm tra hạng phòng đang hoạt động, trạng thái sẵn sàng, sức chứa và
   lịch trùng trước khi tạo đơn. Việc thấy một thẻ phòng trên trang không thay
   thế bước kiểm tra cuối này.
5. Với VNPay, booking được giữ trong thời hạn thanh toán hiển thị trên đơn để
   khách hoàn tất cọc 50%. Thanh toán thành công mới xác nhận cọc.
6. Với lựa chọn thanh toán tại khách sạn, website gửi yêu cầu chờ lễ tân xác
   nhận; phòng chưa được xem là đã giữ chỉ vì khách đã bấm gửi.

### Theo dõi và thay đổi booking

- Trong mục **Đơn đặt**, khách xem trạng thái booking, phòng, kỳ lưu trú, tổng
  tiền dự kiến, tiền cọc và các dịch vụ đã đặt.
- Nút **Thêm ngày** và **Đổi ngày** chỉ xuất hiện với booking đủ điều kiện và
  còn hơn 48 giờ trước check-in. Nếu nút không xuất hiện, chatbot không hướng
  dẫn khách lách điều kiện mà cần giải thích trạng thái hoặc mốc thời gian.
- **Thêm ngày** luôn nối từ checkout hiện tại đến checkout mới. Hệ thống giữ
  phần ngày thêm trong thời hạn thanh toán và yêu cầu cọc bổ sung bằng 50% giá
  phòng của riêng các đêm mới theo giá API hiện tại.
- **Đổi ngày** dời toàn bộ kỳ lưu trú và giữ nguyên thời lượng. Hệ thống chỉ
  chấp nhận khi tất cả phòng trong booking còn trống, sẵn sàng ở lịch mới.
- Khách có thể hủy booking trong mục **Đơn đặt**. Kết quả hoàn hay giữ cọc tuân
  theo mục 4; trạng thái thực tế phải lấy từ phản hồi backend.

### Thanh toán bảo đảm và thanh toán cuối kỳ

VNPay hoặc lựa chọn thanh toán tại khách sạn trong biểu mẫu là phương thức bảo
đảm booking. Tiền còn lại và các khoản phát sinh được quyết toán khi checkout
bằng các phương thức khách sạn hỗ trợ tại mục 5. Hai bước này không được mô tả
như cùng một lần thanh toán.

## 14. Hướng dẫn nhận phòng và trả phòng

### Trước khi đến

- Khách kiểm tra mã booking, trạng thái xác nhận, giờ check-in, số phòng hoặc
  hạng phòng và trạng thái cọc trong mục **Đơn đặt**.
- Người đứng tên booking mang CCCD bản gốc còn hiệu lực và phải trên 18 tuổi.
- Nếu đến sớm, khách có thể gửi hành lý miễn phí nhưng không được nhận phòng
  trước giờ ghi trên booking.
- Các yêu cầu đặc biệt như nôi em bé, chế độ ăn, hỗ trợ di chuyển hoặc xe đón
  sân bay nên được gửi sớm theo thời hạn tương ứng và cần nhân viên xác nhận
  nếu website không có trường chức năng riêng.

### Khi nhận phòng

- Nhân viên đối chiếu booking, người đứng tên, giấy tờ và số khách thực tế.
- Phòng chỉ được bàn giao khi booking hợp lệ, còn trong thời gian lưu trú và
  phòng ở trạng thái sẵn sàng theo backend.
- Nếu số khách thực tế vượt sức chứa đã công bố, khách sạn có thể yêu cầu đổi
  phương án phòng; chatbot không tự hứa bố trí thêm người hoặc thêm giường.

### Khi trả phòng

- Khách kiểm tra thời gian checkout để tránh phụ thu tại mục 2.
- Khách sạn đối soát tiền phòng, dịch vụ đã sử dụng, minibar, phụ thu, bồi
  thường và tiền cọc đã trả trước khi chốt hóa đơn.
- Khách cần hóa đơn điện tử cho doanh nghiệp phải cung cấp thông tin tại mục
  10 trước hoặc trong lúc checkout.
- Khách có thể gửi hành lý miễn phí sau checkout và nhận lại bằng thẻ hành lý.

## 15. Hướng dẫn di chuyển và tham quan tại Vũng Tàu

### Đến khách sạn

- Khách sạn ở **Số 1 VVN, Vũng Tàu, Việt Nam**. Chatbot có thể cung cấp đúng
  địa chỉ này nhưng không tự tính quãng đường hoặc thời gian đến khách sạn khi
  chưa có dữ liệu bản đồ trực tiếp.
- Danh mục hiện có thể công bố dịch vụ Limousine giữa sân bay Tân Sơn Nhất và
  khách sạn tại Vũng Tàu. Giá, khả dụng và mô tả tuyến phải lấy từ API; khách
  nên cung cấp số hiệu chuyến bay và gửi yêu cầu trước ít nhất 12 giờ.
- Thời gian di chuyển phụ thuộc giao thông và điểm đón thực tế. Chatbot không
  đưa ra thời gian cam kết nếu không có dữ liệu bản đồ hoặc xác nhận của tài
  xế/khách sạn.

### Gợi ý khu vực

Khách có thể hỏi về biển, điểm tham quan, ăn uống hoặc tour tại Vũng Tàu.
Website có thể công bố tour địa phương trong danh mục dịch vụ. Tên tour, lịch,
giá và chỗ còn lại phải lấy từ API. Giờ mở cửa, vé vào cổng, thời tiết và tình
trạng giao thông của địa điểm bên ngoài không được lưu cố định trong tài liệu
này; nếu chưa có công cụ dữ liệu sống, chatbot phải nói chưa thể xác nhận thay
vì đoán.

Các gợi ý ổn định theo nhóm nhu cầu:

- Đi biển và dạo ven biển: Bãi Trước, Bãi Sau, Bãi Dứa hoặc Bãi Dâu.
- Ngắm cảnh thành phố và tìm hiểu lịch sử: Hải đăng Vũng Tàu trên Núi Nhỏ hoặc
  di tích Bạch Dinh.
- Tham quan cảnh quan và công trình tôn giáo: Tượng Chúa Kitô, Mũi Nghinh
  Phong, Hòn Bà hoặc Niết Bàn Tịnh Xá.
- Khách có hạn chế vận động, đi cùng trẻ nhỏ hoặc người cao tuổi nên kiểm tra
  trước đường tiếp cận, số bậc thang và điều kiện thời tiết của từng điểm.
- Chatbot chỉ gợi ý theo sở thích; không khẳng định địa điểm đang mở, an toàn
  để tắm biển hoặc có thể tiếp cận ngay nếu chưa có dữ liệu thời gian thực.

Danh sách danh thắng được đối chiếu từ cổng Du lịch Vũng Tàu và trang du lịch
chính thức Việt Nam. Các nguồn này chỉ dùng để xác nhận tên và loại điểm đến,
không thay cho dữ liệu trực tiếp về giờ mở cửa, giá vé hoặc giao thông:

- https://dulichvungtau.baria-vungtau.gov.vn/du-lich-vung-tau/vung-tau-nang-cao-hieu-qua-khai-thac-nui-nho-phat-trien-du-lich/
- https://www.vietnam.travel/vi/things-to-do/vung-tau-sightseeing-wonderland

## 16. Hỗ trợ trong thời gian lưu trú

### Dọn phòng, đồ dùng bổ sung và giờ yên tĩnh

- Buồng phòng phục vụ hằng ngày từ 08:00 đến 17:00. Nếu treo biển **Không làm
  phiền**, nhân viên không vào phòng; khách có thể liên hệ lễ tân để chọn thời
  gian dọn khác trong khung phục vụ.
- Nước uống, khăn tắm và đồ vệ sinh cá nhân cơ bản được bổ sung trong lượt dọn
  phòng hằng ngày. Yêu cầu thêm ngoài định mức được nhân viên xác nhận trước;
  chatbot không tự cam kết miễn phí cho số lượng vượt định mức.
- Khách có thể mượn bàn ủi, bộ chuyển đổi ổ cắm và ô che mưa miễn phí theo tình
  trạng còn sẵn. Các vật dụng mượn phải được hoàn trả trước checkout.
- Giờ yên tĩnh áp dụng từ 22:00 đến 07:00. Khách hạn chế âm thanh lớn ở phòng,
  hành lang và khu vực chung; sự kiện riêng cần được khách sạn chấp thuận.

### Sự cố trong phòng

- Khi mất điện, mất nước, điều hòa, khóa cửa, WiFi hoặc thiết bị trong phòng có
  vấn đề, khách liên hệ lễ tân và cung cấp số phòng cùng mô tả ngắn.
- Website khách hàng hiện chưa có chức năng tạo hoặc theo dõi phiếu kỹ thuật.
  Chatbot chỉ hướng dẫn liên hệ, không nói rằng đã tạo phiếu cho khách.
- Khách không tự tháo, sửa hoặc di chuyển thiết bị cố định. Nếu có nguy cơ mất
  an toàn, khách ngừng sử dụng thiết bị và báo nhân viên ngay.

### Mất đồ và đồ thất lạc

- Khách báo thời gian, địa điểm cuối cùng nhìn thấy đồ, mô tả vật dụng và mã
  booking cho lễ tân. Quy định lưu giữ đồ thất lạc tối đa 90 ngày áp dụng theo
  mục 9.
- Chatbot không được khẳng định đã tìm thấy đồ nếu chưa có xác nhận từ nhân
  viên. Phí chuyển phát, nếu có, phải được thông báo trước.

### Y tế và tình huống khẩn cấp

- Bộ sơ cứu cơ bản có tại lễ tân. Với tình trạng nghiêm trọng, khách cần báo
  ngay cho lễ tân hoặc dịch vụ khẩn cấp địa phương; chatbot không chẩn đoán,
  kê thuốc hoặc trì hoãn việc tìm trợ giúp trực tiếp.
- Khi có cháy, khói, mùi gas hoặc nguy cơ tức thời, khách rời khu vực nguy hiểm,
  làm theo chỉ dẫn thoát hiểm và báo nhân viên ngay.

### Khiếu nại và góp ý

- Khách có thể liên hệ lễ tân, hotline hoặc email chính thức, kèm mã booking,
  số phòng, thời gian và nội dung cần xử lý.
- Website hiện chưa có cổng khiếu nại dành cho khách và chatbot chưa có công
  cụ tạo ticket. Chatbot không được cấp mã khiếu nại giả hoặc hứa thời hạn giải
  quyết chưa được khách sạn xác nhận.

## 17. Câu hỏi thường gặp

### Tôi đến lúc 08:00 có được nhận phòng ngay không?

Không, trừ khi booking đã xác nhận giờ check-in là 08:00. Nếu booking dùng giờ
tiêu chuẩn 14:00, khách có thể gửi hành lý miễn phí tại quầy Concierge/Bellman
và quay lại nhận phòng theo giờ đã xác nhận.

### Tôi có thể thêm ngày hoặc đổi ngày ở đâu?

Khách đăng nhập, mở mục **Đơn đặt** và mở booking đủ điều kiện. Nút **Thêm
ngày** hoặc **Đổi ngày** chỉ hiện khi booking đã xác nhận cọc, chưa check-in,
không có thay đổi đang chờ và còn hơn 48 giờ trước check-in.

### Tại sao tôi thấy phòng trên website nhưng không đặt được?

Danh sách công bố và khả dụng tại thời điểm xác nhận là hai việc khác nhau.
Phòng có thể vừa phát sinh lịch trùng, đang dọn hoặc bảo trì. Kết quả kiểm tra
của backend khi gửi booking là kết quả quyết định.

### Giá phòng hoặc dịch vụ hiện tại là bao nhiêu?

Chatbot phải tra API tại thời điểm hỏi. Nếu API không phản hồi, chatbot nói
chưa thể xác nhận và hướng khách thử lại hoặc liên hệ khách sạn; không lấy một
mức giá cũ trong tài liệu để trả lời.

### Tôi chưa thuê phòng có đặt spa hoặc nhà hàng trên website được không?

Không. Luồng đặt dịch vụ trên website yêu cầu booking thuộc tài khoản, đã xác
nhận tiền cọc và thời gian dịch vụ nằm trong kỳ lưu trú. Khách chưa lưu trú cần
liên hệ khách sạn để hỏi phương án phục vụ ngoài website.

### Trẻ dưới 6 tuổi có tính vào sức chứa không?

Không tính một slot theo quy định đã chốt và trẻ có thể ngủ chung trên giường
hiện có với bố mẹ, không bắt buộc đặt giường phụ. Website chưa thu ngày sinh
từng trẻ trong bước đặt phòng nên gia đình vẫn phải khai báo trẻ đi cùng để
nhân viên xác nhận tuổi. Giường phụ, nôi và dịch vụ riêng phụ thuộc khả dụng.

### Khách sạn có cho mang thú cưng hoặc hút thuốc không?

Không tiếp nhận thú cưng; trường hợp chó dẫn đường có chứng nhận cần hỏi trước.
Cấm hút thuốc và thuốc lá điện tử trong phòng và khu vực trong nhà; khách chỉ
hút tại khu vực ngoài trời được khách sạn chỉ định.

### Khách sạn ở đâu và có chỗ đỗ xe không?

Khách sạn ở **Số 1 VVN, Vũng Tàu, Việt Nam** và có khu vực đỗ xe cho khách.
Khách lưu trú được đỗ miễn phí trong thời gian booking tại tầng hầm B1. Bãi xe
mở 24/7, có 35 chỗ ô tô, 80 chỗ xe máy và giới hạn chiều cao 2,1 m. Xe trên 16
chỗ, xe cao hơn giới hạn hoặc đoàn từ 5 ô tô cần liên hệ trước ít nhất 24 giờ.

### Khách sạn có hỗ trợ xe lăn không?

Có lối tiếp cận từ sảnh và bãi xe B1 đến thang máy, hai chỗ đỗ ưu tiên và 2 xe
lăn cho mượn miễn phí theo tình trạng còn sẵn. Vì không phải phòng nào cũng có
phòng tắm hỗ trợ, khách cần liên hệ trước để xác nhận loại phòng phù hợp.

### WiFi có miễn phí không?

WiFi miễn phí trong phòng và khu vực chung. Tên mạng và mật khẩu được cung cấp
khi check-in. Nếu kết nối gặp lỗi, khách liên hệ lễ tân 24/7 và cung cấp số
phòng để được hỗ trợ.
