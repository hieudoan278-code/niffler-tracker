/**
 * Niffler Tracker — gửi mail nhắc hạn / báo trễ hạn.
 * Dán vào Apps Script khi đăng nhập bằng niffler.hugo@gmail.com (mail gửi từ chính tài khoản này, không cần mật khẩu).
 * Project Settings > Script properties: SUPABASE_URL, SERVICE_KEY (service_role, KHÔNG đưa lên GitHub), APP_URL.
 * Chạy `setup` một lần (cấp quyền gửi mail); sau đó trigger tự chạy `run` mỗi giờ.
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
const fmt_ = (d) => Utilities.formatDate(new Date(d), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM/yyyy');
const shell_ = (inner) => '<div style="font-family:Arial,sans-serif;max-width:560px;border:1px solid #e6dcea;border-radius:10px;overflow:hidden">' +
  '<div style="background:#6a0f7a;color:#fff;padding:12px 16px;font-weight:bold;letter-spacing:.05em">NIFFLER · HUGO ENGLISH CLUB</div>' +
  '<div style="padding:16px;color:#1f1a24;line-height:1.5">' + inner + (APP ? '<p><a href="' + esc_(APP) + '" style="color:#6a0f7a;font-weight:bold">Mở Niffler Tracker</a></p>' : '') + '</div></div>';

function run() {
  const now = new Date(), in24 = new Date(+now + 24 * 3600 * 1000);
  const sel = 'id,title,deadline,profiles(name,email)';

  // 1) Nhắc người được giao: còn <= 24h, chưa xong, chưa nhắc.
  const soon = api_('tasks?select=' + sel + '&status=neq.done&reminded=eq.false&deadline=gt.' + now.toISOString() + '&deadline=lte.' + in24.toISOString());
  soon.forEach((t) => {
    try {
      MailApp.sendEmail({ to: t.profiles.email, name: SENDER, subject: 'Sắp đến hạn: ' + t.title,
        htmlBody: shell_('<p>Chào ' + esc_(t.profiles.name) + ',</p><p>Việc <b>' + esc_(t.title) + '</b> sẽ đến hạn lúc <b>' + fmt_(t.deadline) + '</b>.</p><p>Nhớ nộp file minh chứng khi chuyển sang Hoàn thành nhé.</p>') });
      api_('tasks?id=eq.' + t.id, 'patch', { reminded: true });
    } catch (e) { console.error('remind ' + t.id, e); }   // lỗi thì không đánh dấu, lần sau thử lại
  });

  // 2) Báo admin: đã trễ hạn, chưa xong, chưa báo — 1 mail tổng hợp.
  const late = api_('tasks?select=' + sel + '&status=neq.done&overdue_notified=eq.false&deadline=lt.' + now.toISOString() + '&order=deadline');
  if (late.length) {
    const admins = api_('profiles?select=email&role=eq.admin').map((a) => a.email);
    if (admins.length) {
      const rows = late.map((t) => '<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">' + esc_(t.profiles.name) + '</td><td style="padding:4px 8px;border-bottom:1px solid #eee">' + esc_(t.title) + '</td><td style="padding:4px 8px;border-bottom:1px solid #eee">' + fmt_(t.deadline) + '</td></tr>').join('');
      MailApp.sendEmail({ to: admins.join(','), name: SENDER, subject: late.length + ' việc đã trễ hạn',
        htmlBody: shell_('<p><b>' + late.length + ' việc</b> đã quá hạn mà chưa hoàn thành:</p><table style="border-collapse:collapse;font-size:14px"><tr><th align="left" style="padding:4px 8px">Người làm</th><th align="left" style="padding:4px 8px">Việc</th><th align="left" style="padding:4px 8px">Hạn</th></tr>' + rows + '</table>') });
      late.forEach((t) => { try { api_('tasks?id=eq.' + t.id, 'patch', { overdue_notified: true }); } catch (e) { console.error('late ' + t.id, e); } });
    }
  }
}

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
  run();   // lần đầu: cấp quyền gửi mail và chạy thử
}
