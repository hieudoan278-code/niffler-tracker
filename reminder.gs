/**
 * Niffler Tracker — deadline reminder / overdue emails (English) + event log export to Drive.
 * (Tiếng Việt: gửi mail nhắc hạn / báo trễ hạn, xuất log sự kiện vào Drive.)
 * Dán vào Apps Script khi đăng nhập bằng niffler.hugo@gmail.com (mail gửi từ chính tài khoản này, không cần mật khẩu).
 * Project Settings > Script properties: SUPABASE_URL, SERVICE_KEY (service_role, KHÔNG đưa lên GitHub), APP_URL.
 * Chạy `setup` một lần (cấp quyền gửi mail + tạo Doc trong Drive). Sau đó: `tick` tự chạy mỗi phút (báo trễ hạn + log Drive), `run` mỗi giờ (nhắc còn dưới 24h).
 */
const PROP = PropertiesService.getScriptProperties();
const SB = PROP.getProperty('SUPABASE_URL');
const KEY = PROP.getProperty('SERVICE_KEY');
const APP = PROP.getProperty('APP_URL') || '';
const SENDER = 'Niffler · Hugo English Club';

function api_(path, method, body) {
  const res = UrlFetchApp.fetch(SB + '/rest/v1/' + path, {
    method: method || 'get', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'return=minimal' },
    payload: body ? JSON.stringify(body) : undefined,
  });
  if (res.getResponseCode() >= 300) throw new Error(res.getResponseCode() + ' ' + res.getContentText());
  const t = res.getContentText();
  return t ? JSON.parse(t) : null;
}
const esc_ = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt_ = (d) => Utilities.formatDate(new Date(d), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM/yyyy') + ' (GMT+7)';
// Sticker từ GitHub Pages (assets/stickers/N.png); Gmail tải ảnh qua proxy của Google.
const sticker_ = (n) => APP ? '<p style="text-align:center;margin:8px 0"><img src="' + esc_(APP.replace(/\/?$/, '/')) + 'assets/stickers/' + n + '.png" width="150" alt="Niffler sticker"></p>' : '';
const shell_ = (inner, stickerNo) => '<div style="font-family:Arial,sans-serif;max-width:560px;border:1px solid #e6dcea;border-radius:10px;overflow:hidden">' +
  '<div style="background:#6a0f7a;color:#fff;padding:12px 16px;font-weight:bold;letter-spacing:.05em">NIFFLER · HUGO ENGLISH CLUB<div style="font-weight:normal;font-style:italic;font-size:12px;letter-spacing:0;color:#f2c230">Friends Forever</div></div>' +
  '<div style="padding:16px;color:#1f1a24;line-height:1.5">' + inner + sticker_(stickerNo) + (APP ? '<p style="text-align:center"><a href="' + esc_(APP) + '" style="color:#6a0f7a;font-weight:bold">Open Niffler Tracker</a></p>' : '') + '</div>' +
  '<div style="background:#faf5fb;color:#6a0f7a;text-align:center;padding:8px;font-size:12px;font-style:italic">Niffler · Friends Forever</div></div>';

function run() {
  const now = new Date(), in24 = new Date(+now + 24 * 3600 * 1000);
  const sel = 'id,title,deadline,profiles(name,email)';

  // 1) Nhắc người được giao: còn <= 24h, chưa xong, chưa nhắc.
  const soon = api_('tasks?select=' + sel + '&status=neq.done&reminded=eq.false&deadline=gt.' + now.toISOString() + '&deadline=lte.' + in24.toISOString());
  soon.forEach((t) => {
    try {
      MailApp.sendEmail({ to: t.profiles.email, name: SENDER, subject: 'Due soon: ' + t.title,
        htmlBody: shell_('<p>Hi ' + esc_(t.profiles.name) + ',</p><p>Your task <b>' + esc_(t.title) + '</b> is due on <b>' + fmt_(t.deadline) + '</b>.</p><p>Please upload a proof file when you move it to <i>Done</i>. You can do it!</p>', 13) });
      api_('tasks?id=eq.' + t.id, 'patch', { reminded: true });
    } catch (e) { console.error('remind ' + t.id, e); }   // lỗi thì không đánh dấu, lần sau thử lại
  });

  notifyLate_();   // lưới an toàn: tick() mỗi phút đã lo phần này
  exportLogs_();
}

// Chạy mỗi phút: chỉ 2 truy vấn nhẹ rồi thoát nếu không có gì. Việc vừa trễ hạn là báo admin ngay; sự kiện vừa hoàn thành là tạo log Drive ngay.
// Các cờ overdue_notified / drive_url bảo đảm không gửi trùng dù run() cũng gọi lại.
function tick() {
  try { notifyLate_(); } catch (e) { console.error('notifyLate', e); }   // lỗi một phần không chặn phần còn lại
  try { exportLogs_(); } catch (e) { console.error('exportLogs', e); }
}

// Báo admin: đã trễ hạn, chưa xong, chưa báo — 1 mail tổng hợp (không gửi mail khi giao việc, chủ ý).
function notifyLate_() {
  const now = new Date(), sel = 'id,title,deadline,profiles(name,email)';
  const late = api_('tasks?select=' + sel + '&status=neq.done&overdue_notified=eq.false&deadline=lt.' + now.toISOString() + '&order=deadline');
  if (late.length) {
    const admins = api_('profiles?select=email&role=eq.admin').map((a) => a.email);
    if (admins.length) {
      const rows = late.map((t) => '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">' + esc_(t.profiles.name) + '</td><td style="padding:4px 8px;border-bottom:1px solid #eee">' + esc_(t.title) + '</td><td style="padding:4px 8px;border-bottom:1px solid #eee">' + fmt_(t.deadline) + '</td></tr>').join('');
      MailApp.sendEmail({ to: admins.join(','), name: SENDER, subject: late.length + (late.length > 1 ? ' tasks are' : ' task is') + ' overdue',
        htmlBody: shell_('<p><b>' + late.length + (late.length > 1 ? ' tasks have' : ' task has') + '</b> passed the deadline without being completed:</p><table style="border-collapse:collapse;font-size:14px"><tr><th align="left" style="padding:4px 8px">Assignee</th><th align="left" style="padding:4px 8px">Task</th><th align="left" style="padding:4px 8px">Deadline</th></tr>' + rows + '</table>', 9) });
      late.forEach((t) => { try { api_('tasks?id=eq.' + t.id, 'patch', { overdue_notified: true }); } catch (e) { console.error('late ' + t.id, e); } });
    }
  }
}

// Sự kiện đã "Hoàn thành" trên web (closed_at) mà chưa có drive_url: tạo Google Doc log trong Drive của tài khoản này.
const LOG_FOLDER = 'Niffler - Event logs';
function exportLogs_() {
  const done = api_('projects?select=*&closed_at=not.is.null&drive_url=is.null');
  done.forEach((p) => {
    try {
      const tasks = api_('tasks?select=id,title,deadline,proof_path,profiles(name,email)&project_id=eq.' + p.id + '&order=deadline');
      const ids = tasks.map((t) => t.id).join(',');
      const comments = tasks.length ? api_('comments?select=task_id,body,created_at,profiles(name)&task_id=in.(' + ids + ')&order=created_at') : [];
      const evs = tasks.length ? api_('task_events?select=task_id,detail,created_at&kind=eq.status&task_id=in.(' + ids + ')&order=created_at') : [];
      const doneAt = {}; evs.forEach((e) => { if (e.detail && e.detail.to === 'done') doneAt[e.task_id] = e.created_at; });
      const doc = DocumentApp.create('Event log: ' + p.name + ' (' + Utilities.formatDate(new Date(p.closed_at), 'Asia/Ho_Chi_Minh', 'dd-MM-yyyy') + ')');
      const body = doc.getBody();
      body.appendParagraph(p.name).setHeading(DocumentApp.ParagraphHeading.TITLE);
      body.appendParagraph('Completed on ' + fmt_(p.closed_at) + ' · ' + tasks.length + (tasks.length === 1 ? ' task' : ' tasks'));
      body.appendParagraph('Tasks').setHeading(DocumentApp.ParagraphHeading.HEADING1);
      const rows = [['Assignee', 'Task', 'Deadline', 'Completed at', 'Proof file (path in Supabase Storage)']];
      tasks.forEach((t) => rows.push([t.profiles ? (t.profiles.name || t.profiles.email) : '?', t.title, fmt_(t.deadline), doneAt[t.id] ? fmt_(doneAt[t.id]) : '—', t.proof_path || '—']));
      body.appendTable(rows);
      if (comments.length) {
        body.appendParagraph('Comments').setHeading(DocumentApp.ParagraphHeading.HEADING1);
        const title = {}; tasks.forEach((t) => { title[t.id] = t.title; });
        comments.forEach((c) => body.appendListItem(fmt_(c.created_at) + ' · ' + (c.profiles ? c.profiles.name : '?') + ' · [' + title[c.task_id] + '] ' + c.body));
      }
      doc.saveAndClose();
      DriveApp.getFileById(doc.getId()).moveTo(folder_());
      api_('projects?id=eq.' + p.id, 'patch', { drive_url: doc.getUrl() });
    } catch (e) { console.error('log ' + p.id, e); }   // lỗi thì lần sau thử lại
  });
}
function folder_() {
  const it = DriveApp.getFoldersByName(LOG_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(LOG_FOLDER);
}

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();    // nếu vượt hạn mức 90 phút/ngày: đổi thành everyMinutes(5)
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
  run();   // lần đầu: cấp quyền gửi mail và chạy thử
}
