# Hướng dẫn cho admin

## 1. Thêm thành viên
Tab **Thành viên** → nhập **email Google** và vai trò → **Thêm**. Không cần nhập tên: người đó đăng nhập lần đầu sẽ tự đặt tên (sau này bấm vào tên ở góc phải trên để đổi). Chỉ email đã có trong danh sách mới đăng nhập được. Cột "Đã đăng nhập" cho biết ai đã vào lần nào.

## 2. Giao việc hàng loạt bằng 1 file CSV
1. Tab **Tải mẫu** → tải `mau-phan-cong.csv`.
2. Mở bằng Excel hoặc Google Sheets, điền mỗi việc một dòng, **giữ nguyên dòng đầu**:

| Cột | Bắt buộc | Ví dụ |
|---|---|---|
| `email` | Có | `lan@gmail.com` (phải có trong tab Thành viên) |
| `title` | Có | `Thiết kế poster` (tối đa 200 ký tự) |
| `deadline` | Có | `2026-12-05 23:59` hoặc `05/12/2026` (không ghi giờ thì tính 23:59) |
| `description` | Không | Mô tả ngắn |

3. Lưu thành **CSV** (Excel: *Save As → CSV UTF-8*; Google Sheets: *Tải xuống → CSV*). Dùng UTF-8 để không lỗi tiếng Việt. Dấu `,` hoặc `;` đều được.
4. Vào **Bảng việc**, thả file vào khung **Giao việc hàng loạt** (hoặc bấm Chọn file CSV).
5. Đọc bảng **Xem trước**. Dòng đỏ là dòng lỗi và sẽ bị bỏ qua: email lạ, ngày sai, hạn đã qua, trùng việc đã có. Bấm **Giao N việc hợp lệ**.

Mỗi việc rơi đúng vào cột **Nhận** của người có email đó.

## 3. Giao một việc lẻ
Có hai cách, không bắt buộc kéo thả:
- Bấm **+ Thêm việc** (đầu trang, hoặc ngay trên hàng của người đó) → chọn người, điền tên việc, hạn chót, mô tả, file đính kèm nếu có → **Giao việc**.
- Hoặc thả file bất kỳ (đề bài, brief…, trừ `.csv`) vào **hàng của người đó**, form tự mở sẵn với file đó.

## 4. Theo dõi
- Banner đỏ đầu Bảng việc liệt kê các việc **trễ hạn**.
- Bấm thẻ để xem bình luận, lịch sử, file minh chứng. Admin dời hạn hoặc xoá việc ở ngăn này (xoá phải bấm 2 lần).
- Admin kéo được thẻ của mọi người, kể cả sang Hoàn thành khi đã có minh chứng.

## 5. Log họp
Tab **Log họp** → ô **Thêm log họp**: chọn ngày, tiêu đề, dán nội dung (Markdown) hoặc thả file `.md/.txt`. Mẫu ở tab Tải mẫu. Mọi người đều đọc được.

## 6. Timeline
Tab **Timeline**: thêm **mốc sự kiện** (hạn nộp hồ sơ, ngày diễn ra sự kiện…) bằng form phía trên. Buổi họp tự hiện thành hình thoi vàng.

## 7. Email tự động
`niffler.hugo@gmail.com` tự gửi:
- Cho người được giao: khi việc còn dưới 24 giờ đến hạn và chưa xong.
- Cho tất cả admin: một email tổng hợp khi có việc trễ hạn (mỗi việc báo một lần). Dời hạn thì việc đó được tính lại.

Cài đặt xem `docs/cai-dat.md`.
