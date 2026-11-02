# Cài đặt Niffler Tracker (một lần, khoảng 30 phút, miễn phí)

## 0. Logo
Lưu logo của CLB thành `assets/logo.png` (PNG, vuông, nền trong hoặc trắng). Thiếu file này thì header và đăng nhập sẽ hiện ảnh vỡ.

## 1. Supabase (cơ sở dữ liệu, đăng nhập, lưu file)
1. Vào supabase.com, đăng nhập, **New project** (chọn vùng Singapore). Đặt mật khẩu database và cất kỹ.
2. **Storage → New bucket**, tên `files`, **để Private**.
3. **SQL Editor → New query**, dán toàn bộ `schema.sql` → Run.
4. Mở lại SQL Editor, chạy dòng thêm admin đầu tiên (ở cuối `schema.sql`, bỏ dấu `--`, sửa đúng email của bạn):
   `insert into profiles(email,name,role) values ('niffler.hugo@gmail.com','Niffler Admin','admin');`
5. **Settings → API**: chép *Project URL* và *anon public key* vào `config.js`.

## 2. Đăng nhập Google
1. console.cloud.google.com → tạo project → **APIs & Services → OAuth consent screen** (External) → **Credentials → Create OAuth client ID** (Web application).
2. *Authorized redirect URI*: chép từ Supabase (**Authentication → Providers → Google**, ô "Callback URL").
3. Dán Client ID và Secret vào Supabase (Providers → Google) → bật Enable → Save.
4. Supabase **Authentication → URL Configuration**: *Site URL* và *Redirect URLs* = địa chỉ GitHub Pages của bạn (bước 3), thêm `http://localhost:3000` để thử máy.

## 3. GitHub Pages
1. Tạo repo GitHub, đẩy toàn bộ thư mục này lên. `config.js` chỉ chứa anon key công khai nên đẩy được; khoá bí mật (service_role) chỉ nằm trong Script properties của Apps Script, không nằm trong file nào.
2. Repo → **Settings → Pages** → Deploy from branch `main` / root. Địa chỉ dạng `https://<tên>.github.io/<repo>/`.

## 4. Mail tự động (Apps Script)
1. Đăng nhập Chrome bằng `niffler.hugo@gmail.com` → script.google.com → **New project** → dán `reminder.gs`.
   (Từ bản có Sự kiện: script cũng tạo Google Doc log trong Drive, nên khi chạy `setup` lại sẽ xin thêm quyền Drive/Docs. Dán lại bản `reminder.gs` mới trước.)
2. **Project Settings → Script properties** thêm:
   - `SUPABASE_URL` = Project URL
   - `SERVICE_KEY` = *service_role key* (Supabase Settings → API; khoá **bí mật**, không dán lên GitHub hay gửi người khác)
   - `APP_URL` = địa chỉ GitHub Pages
3. Chọn hàm `setup` → Run → cấp quyền khi Google hỏi. Xong: hai trigger tự chạy: `tick` mỗi phút (báo trễ hạn + log Drive) và `run` mỗi giờ (nhắc còn dưới 24 giờ). Kiểm tra ở Trình kích hoạt (biểu tượng đồng hồ): phải thấy cả hai dòng. Nếu vượt hạn mức trigger 90 phút/ngày, đổi `everyMinutes(1)` thành `everyMinutes(5)` trong `setup` rồi chạy lại `setup`.

## Thử nhanh
- Đăng nhập admin, thêm 1 thành viên (email phụ của bạn), giao 1 việc hạn sau 1 giờ, chạy tay hàm `run` → thành viên nhận mail.
- Đăng nhập bằng tài khoản thành viên: kéo thẻ vào Hoàn thành phải đòi file.

## Lưu ý bảo mật
Không bao giờ đưa mật khẩu Gmail cho ứng dụng hay gửi qua chat. Hệ thống này gửi mail nhờ quyền Apps Script, không cần mật khẩu. Nếu mật khẩu từng bị chụp màn hình hay gửi đi, hãy đổi ngay.
