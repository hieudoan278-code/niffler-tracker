/* Tiếng Việt (gốc) -> English. tr() dịch đúng nguyên chuỗi, hoặc theo mẫu cho chuỗi có số/tên. Thiếu bản dịch thì giữ tiếng Việt. */
let LANG = 'vi';
try { LANG = localStorage.getItem('lang') === 'en' ? 'en' : 'vi'; } catch (e) { /* chế độ riêng tư: dùng mặc định */ }
const setLang = (l) => { LANG = l; try { localStorage.setItem('lang', l); } catch (e) { /* bỏ qua */ } document.documentElement.lang = l; };
const LOCALE = () => (LANG === 'en' ? 'en-GB' : 'vi-VN');

const EN = {
  // khung + đăng nhập
  'Chức năng': 'Navigation', 'Bảng việc': 'Task board', 'Timeline': 'Timeline', 'Log họp': 'Meeting log', 'Hướng dẫn': 'Guide', 'Tải mẫu': 'Templates', 'Sự kiện': 'Events', 'Thành viên': 'Members',
  'Đổi tên': 'Rename', 'Đăng xuất': 'Log out', 'Đăng nhập bằng Google': 'Sign in with Google', 'Chưa có trong danh sách': 'Not on the list',
  'Theo dõi tiến độ việc của cả đội. Đăng nhập bằng email Google đã được admin thêm.': 'Track the whole team\'s progress. Sign in with the Google email an admin added for you.',
  // bảng việc
  '+ Thêm việc': '+ Add task', 'Sự kiện: ': 'Event: ', 'Tất cả': 'All', 'Không thuộc sự kiện': 'No event', ' Chỉ việc của tôi': ' My tasks only',
  'Bạn có việc sắp đến hạn hoặc đã trễ. Mở thẻ để xem chi tiết.': 'You have tasks that are due soon or overdue. Open a card for details.',
  'Chưa có thành viên. Admin thêm ở tab "Thành viên".': 'No members yet. Admins add them in the "Members" tab.', 'Chưa có việc nào.': 'No tasks yet.',
  'Nhận': 'To do', 'Đang làm': 'Doing', 'Hoàn thành': 'Done', 'Xong': 'Done',
  // giao việc
  'Thêm việc mới': 'Add a new task', 'Giao cho': 'Assign to', 'Tên việc': 'Task name', 'Hạn chót': 'Deadline', 'Mô tả (không bắt buộc)': 'Description (optional)',
  'File đính kèm (không bắt buộc)': 'Attachment (optional)', 'Hoặc gõ tên sự kiện mới': 'Or type a new event name', 'Huỷ': 'Cancel', 'Giao việc': 'Assign task', 'Ví dụ: Thiết kế poster': 'e.g. Design the poster',
  // tên
  'Chào mừng đến Niffler Tracker': 'Welcome to Niffler Tracker', 'Đổi tên hiển thị': 'Change display name', 'Đây là lần đầu bạn đăng nhập. Hãy đặt tên để mọi người nhận ra bạn.': 'This is your first sign-in. Pick a name so everyone recognises you.',
  'Tên hiển thị': 'Display name', 'Tên của bạn': 'Your name', 'Lưu': 'Save', 'Ví dụ: Nguyễn Văn An': 'e.g. Nguyen Van An', 'Đã lưu tên': 'Name saved',
  // minh chứng
  'Chưa chọn file.': 'No file chosen.', 'Đang tải lên…': 'Uploading…', 'Hoàn thành! Đã nộp minh chứng.': 'Done! Proof submitted.', 'Nộp và hoàn thành': 'Submit and complete',
  'Thả file minh chứng vào đây': 'Drop your proof file here', ' hoặc bấm để chọn (ảnh, PDF, file bài làm…).': ' or click to choose (photo, PDF, your work file…).',
  'Cần có file minh chứng trước khi chuyển sang Hoàn thành.': 'A proof file is required before a task can move to Done.', 'Huỷ, giữ nguyên cột cũ': 'Cancel, keep it where it was',
  // CSV
  'Giao việc hàng loạt: ': 'Bulk assign: ', 'thả 1 file CSV tổng vào đây, hệ thống tự chia về từng người.': 'drop one master CSV here and tasks are split to each person automatically.', 'Chọn file CSV': 'Choose CSV file',
  'Email chưa có trong danh sách thành viên': 'Email is not in the member list', 'Thiếu tên việc hoặc quá 200 ký tự': 'Task name missing or over 200 characters',
  'Ngày sai định dạng (dùng 2025-12-31 hoặc 31/12/2025)': 'Wrong date format (use 2025-12-31 or 31/12/2025)', 'Hạn đã qua': 'Deadline already passed', 'Trùng việc đã có': 'Duplicate of an existing task',
  'Sự kiện này đã hoàn thành': 'This event is already completed', 'Tên sự kiện quá 100 ký tự': 'Event name over 100 characters', 'Xem trước phân công': 'Assignment preview',
  'Dòng': 'Row', 'Người nhận': 'Assignee', 'Việc': 'Task', 'Hạn': 'Deadline', 'Trạng thái': 'Status', 'OK': 'OK',
  'Chỉ nhận file .csv (xuất từ Excel/Google Sheets: Lưu thành CSV).': 'Only .csv files (from Excel/Google Sheets: Save as CSV).',
  'Dòng đầu phải có các cột: email, title, deadline (và description). Xem file mẫu.': 'The first row must have the columns: email, title, deadline (and description, event). See the template.',
  // ngăn kéo
  'Xoá việc': 'Delete task', 'Bấm lần nữa để xoá hẳn': 'Click again to delete for good', 'Đóng': 'Close', 'Người làm': 'Assignee', 'File giao việc': 'Task file', 'Minh chứng': 'Proof',
  'Dời hạn': 'Move deadline', 'Đã dời hạn': 'Deadline moved', 'Đã đổi sự kiện': 'Event changed', 'Bình luận': 'Comments', 'Lịch sử cập nhật': 'Activity history', 'Viết bình luận…': 'Write a comment…',
  'Gửi': 'Send', 'Chưa có bình luận.': 'No comments yet.', 'tạo việc': 'created the task', 'nộp minh chứng': 'submitted proof', 'Ai đó': 'Someone',
  // timeline
  'Timeline tổng': 'Overall timeline', 'Người / sự kiện': 'Person / event', 'Tên sự kiện': 'Event name', 'Ngày': 'Date', 'Thêm mốc sự kiện': 'Add event marker', 'Chưa có việc nào để vẽ.': 'No tasks to draw yet.', 'Hôm nay': 'Today',
  // log họp
  'Tìm theo tiêu đề hoặc nội dung': 'Search by title or content', 'Tìm log họp': 'Search meeting log', 'Xoá': 'Delete', 'Bấm lần nữa để xoá': 'Click again to delete', 'Chưa có log họp nào.': 'No meeting logs yet.',
  'Thêm log họp': 'Add meeting log', 'Ngày họp': 'Meeting date', 'Tiêu đề': 'Title', 'Họp tuần 12': 'Week 12 meeting', 'Dán log họp (Markdown) hoặc thả file .md/.txt vào ô này': 'Paste the meeting log (Markdown) or drop a .md/.txt file here',
  'Nội dung': 'Content', 'Lưu log họp': 'Save meeting log', 'Đã lưu log họp': 'Meeting log saved',
  // hướng dẫn / mẫu
  'Dành cho thành viên': 'For members', 'Dành cho admin': 'For admins', 'Tải về': 'Download', 'Mẫu phân công (CSV)': 'Assignment template (CSV)',
  'File tổng để admin thả vào Bảng việc. Mở bằng Excel hoặc Google Sheets, giữ nguyên dòng đầu.': 'Master file admins drop onto the Task board. Open it in Excel or Google Sheets and keep the first row.',
  'Mẫu log họp (Markdown)': 'Meeting log template (Markdown)', 'Dán hoặc thả vào ô Thêm log họp. Có sẵn các mục: quyết định, việc giao, việc tồn.': 'Paste or drop it into "Add meeting log". It has sections for decisions, assigned tasks and open items.',
  // sự kiện
  'Chưa có sự kiện. Thêm ở trên, hoặc gõ tên sự kiện khi giao việc / thêm cột event vào file CSV.': 'No events yet. Add one above, type an event name when assigning a task, or add an event column to the CSV.',
  'Hoàn thành sự kiện': 'Complete event', 'Bấm lần nữa để hoàn thành sự kiện': 'Click again to complete the event', 'Mở log trong Drive': 'Open log in Drive',
  'Đang tạo log trong Drive (tối đa ~1 giờ)…': 'Creating the log in Drive (up to ~1 hour)…', 'Đang chạy': 'Running', 'Thêm sự kiện': 'Add event', 'Tiến độ': 'Progress',
  'Đã hoàn thành sự kiện. Log sẽ được lưu vào Drive của Niffler.': 'Event completed. The log will be saved to Niffler\'s Drive.', 'Ví dụ: Chung kết Hugo Cup': 'e.g. Hugo Cup Finals', 'Đã xoá sự kiện': 'Event deleted',
  'Đã xoá sự kiện. Log trong Drive vẫn được giữ.': 'Event deleted. The log in Drive is kept.', 'Thêm': 'Add',
  // thành viên
  'Thêm người vào CLB': 'Add someone to the club', 'Email Google': 'Google email', 'Họ tên (không bắt buộc)': 'Full name (optional)', 'Để trống: người đó tự đặt tên': 'Leave empty: they will set their own name',
  'Vai trò': 'Role', 'Họ tên': 'Name', 'Email': 'Email', 'Đã đăng nhập': 'Signed in', 'Rồi': 'Yes', 'Chưa': 'Not yet', '(chưa đặt tên)': '(no name yet)', 'Bấm lần nữa để xoá (xoá cả việc của họ)': 'Click again to delete (also deletes their tasks)',
  'Đã đổi vai trò': 'Role changed',
  'Admin': 'Admin', 'Sự kiện đã hoàn thành!': 'Event completed!', 'Cảm ơn cả đội. Log sẽ được lưu vào Drive của Niffler.': "Thank you, team. The log will be saved to Niffler's Drive.", 'Tuyệt vời': 'Awesome',
};
for (const k of Object.keys(EN)) if (k !== k.trim()) EN[k.trim()] = EN[k].trim(); // khoá có khoảng trắng đầu/cuối vẫn khớp (tr() cắt khoảng trắng)
// Vai trò (Member) khác tab (Members): app.js dùng roleLabel() cho cột/ô chọn vai trò.

// Mẫu cho chuỗi có số / tên: [regex, hàm tạo bản English]
const PATTERNS = [
  [/^Trễ (\d+) (ngày|giờ)$/, (m) => `${m[1]} ${m[2] === 'ngày' ? 'day' : 'hour'}${m[1] === '1' ? '' : 's'} late`],
  [/^Còn (\d+) (ngày|giờ)$/, (m) => `${m[1]} ${m[2] === 'ngày' ? 'day' : 'hour'}${m[1] === '1' ? '' : 's'} left`],
  [/^Hạn (\d\d\/\d\d)$/, (m) => `Due ${m[1]}`],
  [/^(\d+) việc đang trễ hạn: (.*)$/s, (m) => `${m[1]} task${m[1] === '1' ? ' is' : 's are'} overdue: ${m[2]}`],
  [/^(\d+) đang mở · thả file vào đây để giao việc$/, (m) => `${m[1]} open · drop a file here to assign a task`],
  [/^(\d+) đang mở$/, (m) => `${m[1]} open`],
  [/^Việc của (.*)$/s, (m) => `Tasks of ${m[1]}`],
  [/^Chuyển "(.*)" sang (.*)$/s, (m) => `Move "${m[1]}" to ${tr(m[2])}`],
  [/^Đã giao "(.*)" cho (.*)$/s, (m) => `Assigned "${m[1]}" to ${m[2]}`],
  [/^File đính kèm: (.*) \(chọn file khác nếu cần\)$/s, (m) => `Attachment: ${m[1]} (choose another file if needed)`],
  [/^Đổi tên cho (.*)$/s, (m) => `Rename ${m[1]}`],
  [/^Đã chọn: (.*)$/s, (m) => `Chosen: ${m[1]}`],
  [/^Hoàn thành "(.*)"$/s, (m) => `Complete "${m[1]}"`],
  [/^(\d+) dòng: (\d+) hợp lệ, (\d+) lỗi \(dòng lỗi sẽ bị bỏ qua\)\.$/, (m) => `${m[1]} rows: ${m[2]} valid, ${m[3]} with errors (rows with errors are skipped).`],
  [/^Giao (\d+) việc hợp lệ$/, (m) => `Assign ${m[1]} valid task${m[1] === '1' ? '' : 's'}`],
  [/^Đã giao (\d+) việc\.$/, (m) => `Assigned ${m[1]} task${m[1] === '1' ? '' : 's'}.`],
  [/^Lỗi: (.*)$/s, (m) => `Error: ${m[1]}`],
  [/^Không mở được file: (.*)$/s, (m) => `Could not open the file: ${m[1]}`],
  [/^Không đổi được: (.*)$/s, (m) => `Could not change: ${m[1]}`],
  [/^Email (.*) chưa được admin thêm vào CLB\. Nhờ admin thêm email này rồi đăng nhập lại\.$/s, (m) => `${m[1]} has not been added to the club by an admin. Ask an admin to add this email, then sign in again.`],
  [/^Họp: (.*)$/s, (m) => `Meeting: ${m[1]}`],
  [/^(.*) — hạn (.*)$/s, (m) => `${m[1]} — due ${m[2]}`],
  [/^(\d+)\/(\d+) việc xong$/, (m) => `${m[1]}/${m[2]} tasks done`],
  [/^Đã hoàn thành (.*)$/s, (m) => `Completed ${m[1]}`],
  [/^Bấm lần nữa để xoá sự kiện(?: và (\d+) việc)?$/, (m) => `Click again to delete the event${m[1] ? ` and ${m[1]} task${m[1] === '1' ? '' : 's'}` : ''}`],
  [/^Còn (\d+) việc chưa Hoàn thành\. Hoàn thành hết rồi mới đóng sự kiện được\.$/, (m) => `${m[1]} task${m[1] === '1' ? ' is' : 's are'} not Done yet. Finish them all before completing the event.`],
  [/^Sự kiện "(.*)" đã hoàn thành, đặt tên khác\.$/s, (m) => `Event "${m[1]}" is already completed, pick another name.`],
  [/^Vai trò của (.*)$/s, (m) => `Role of ${m[1]}`],
  [/^chuyển (.*) → (.*)$/s, (m) => `moved ${tr(m[1])} → ${tr(m[2])}`],
  [/^dời hạn từ (.*) sang (.*)$/s, (m) => `moved the deadline from ${m[1]} to ${m[2]}`],
  [/^đổi người làm sang (.*)$/s, (m) => `reassigned to ${m[1]}`],
  [/^bình luận: (.*)$/s, (m) => `commented: ${m[1]}`],
];

function tr(s) {
  if (LANG !== 'en' || typeof s !== 'string' || !s) return s;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); if (!m[2]) return s;
  const core = m[2];
  let out = EN[core];
  if (out == null) for (const [re, fn] of PATTERNS) { const x = core.match(re); if (x) { out = fn(x); break; } }
  return out == null ? s : m[1] + out + m[3];
}

document.documentElement.lang = LANG;
