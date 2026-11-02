# Hướng dẫn cho admin

## 1. Thêm thành viên
Tab **Thành viên** → nhập **email Google** và vai trò → **Thêm**. Không cần nhập tên: người đó đăng nhập lần đầu sẽ tự đặt tên (sau này bấm nút **Đổi tên** ở góc phải trên để đổi). Admin cũng đổi được tên của bất kỳ ai bằng nút **Đổi tên** ở cuối mỗi dòng trong tab Thành viên. Chỉ email đã có trong danh sách mới đăng nhập được. Cột "Đã đăng nhập" cho biết ai đã vào lần nào.

**Vai trò:** chỉ tài khoản `niffler.hugo@gmail.com` đổi được vai trò Admin/Thành viên (chọn ngay trong cột Vai trò) và thêm admin mới. Admin khác chỉ thêm được thành viên.

## 2. Giao nhiều việc cùng lúc
Trên **Bảng việc**, bấm **Giao nhiều việc** để mở bảng nhập: mỗi dòng là một việc gồm người nhận (chọn trong danh sách), tên việc, hạn chót, sự kiện (chọn hoặc gõ tên mới) và mô tả. Bấm **+ Thêm dòng** để thêm, **×** để xoá dòng, dòng để trống sẽ bị bỏ qua.

**Dán từ Excel / Google Sheets:** mở mục *Dán từ Excel / Google Sheets*, dán các ô đã copy (cột theo thứ tự: người nhận (email hoặc tên), tên việc, hạn, sự kiện, mô tả), bấm **Điền vào bảng**. Hạn ghi dạng `2026-12-05 23:59` hoặc `05/12/2026` (không ghi giờ thì tính 23:59). Dòng lỗi (chưa chọn người, hạn đã qua, trùng việc…) báo đỏ ngay trên dòng; sửa xong bấm **Giao tất cả**.

**Nhập từ file CSV (phụ):** bấm **Nhập từ CSV** hoặc thả file vào khung. Mẫu ở tab **Tải mẫu** (`mau-phan-cong.csv`, cột `email,title,deadline,description,event`; lưu *CSV UTF-8*). Có bảng xem trước, dòng lỗi bị bỏ qua.

Mỗi việc rơi đúng vào cột **Nhận** của người được giao.

## 3. Giao một việc lẻ
Có hai cách, không bắt buộc kéo thả:
- Bấm **+ Thêm việc** (đầu trang, hoặc ngay trên hàng của người đó) → chọn người, điền tên việc, hạn chót, mô tả, file đính kèm nếu có → **Giao việc**.
- Hoặc thả file bất kỳ (đề bài, brief…, trừ `.csv`) vào **hàng của người đó**, form tự mở sẵn với file đó.

## 4. Theo dõi
- Banner đỏ đầu Bảng việc liệt kê các việc **trễ hạn**.
- Bấm thẻ để xem bình luận, lịch sử, file minh chứng. Admin dời hạn hoặc xoá việc ở ngăn này (xoá phải bấm 2 lần).
- Admin kéo được thẻ của mọi người, kể cả sang Hoàn thành khi đã có minh chứng.

## 4b. Sự kiện và hoàn thành sự kiện
Mỗi việc có thể thuộc một **sự kiện** (chọn hoặc gõ tên mới khi giao việc, hoặc cột `event` trong CSV). Thẻ hiện nhãn sự kiện, Bảng việc có ô lọc theo sự kiện, nên một người chạy nhiều sự kiện vẫn phân biệt được việc nào của sự kiện nào. Admin đổi sự kiện của việc trong ngăn chi tiết.

Tab **Sự kiện** → **Hoàn thành sự kiện** (bấm 2 lần; phải xong hết việc của sự kiện). Việc của sự kiện đó ẩn khỏi bảng, dữ liệu vẫn giữ. Trong tối đa khoảng 1 giờ, hệ thống tạo một Google Doc log (danh sách việc, người làm, hạn, ngày xong, minh chứng, bình luận) trong thư mục Drive **"Niffler - Event logs"** của `niffler.hugo@gmail.com`, và link hiện ở tab Sự kiện.

## 5. Log họp
Tab **Log họp** → ô **Thêm log họp**: chọn ngày, tiêu đề, và sửa nội dung. **Mẫu đã hiện sẵn trong ô nội dung** (xoá hoặc sửa theo buổi họp), hoặc thả file `.md/.txt` vào ô. Mọi người đều đọc được.

**Tự đẩy việc từ log:** giữ nguyên bảng ở mục **Việc giao** (cột *Ai | Việc | Hạn | Sự kiện*; Ai là tên hoặc email, hạn dạng `10/12/2026`), rồi bấm **Tạo việc từ mục Việc giao**. Bảng nhập nhiều việc mở ra với các dòng đã điền sẵn để bạn kiểm tra, sửa, rồi bấm **Giao tất cả**. Việc không tự tạo khi chỉ lưu log, bạn luôn xác nhận trước.

## 6. Timeline
Tab **Timeline**: thêm **mốc sự kiện** (hạn nộp hồ sơ, ngày diễn ra sự kiện…) bằng form phía trên. Buổi họp tự hiện thành hình thoi vàng.

## 7. Email tự động
`niffler.hugo@gmail.com` tự gửi:
- Cho người được giao: khi việc còn dưới 24 giờ đến hạn và chưa xong.
- Cho tất cả admin: một email tổng hợp khi có việc trễ hạn (mỗi việc báo một lần). Dời hạn thì việc đó được tính lại.

Cài đặt xem `docs/cai-dat.md`.
