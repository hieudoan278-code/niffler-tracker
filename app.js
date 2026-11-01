/* Niffler Tracker — không build, chạy thẳng trên GitHub Pages. */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $app = document.getElementById('app');
const STATUS = { todo: 'Nhận', doing: 'Đang làm', done: 'Hoàn thành' };
const ORDER = ['todo', 'doing', 'done'];
const S = { me: null, profiles: [], tasks: [], meetings: [], events: [], view: 'board', mine: false, openTask: null };
const isAdmin = () => S.me?.role === 'admin';

/* ---------- tiện ích ---------- */
// replaceChildren gốc in ra "false" và "[object ...]": làm nó bỏ qua false/null và mở mảng, giống h().
const _rc = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...k) { _rc.apply(this, k.flat(Infinity).filter((c) => c != null && c !== false)); };
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v; // chỉ nhận chuỗi đã qua DOMPurify (md())
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const svg = (d) => { const e = document.createElement('span'); e.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; return e.firstChild; };
const ICON = {
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  up: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>', pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', clip: '<path d="M21 12l-9 9a5 5 0 01-7-7l9-9a3 3 0 014 4l-9 9a1 1 0 01-2-2l8-8"/>',
};
const $ = (s, r = document) => r.querySelector(s);
const pmap = () => Object.fromEntries(S.profiles.map((p) => [p.id, p]));
const fmt = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const md = (t) => DOMPurify.sanitize(marked.parse(t || ''));
const safeName = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w.\-]+/g, '_');
const initials = (p) => (p.name || p.email).trim().split(/\s+/).slice(-1)[0][0].toUpperCase();
const isLate = (t) => t.status !== 'done' && new Date(t.deadline) < new Date();
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
function when(t) {
  if (t.status === 'done') return { txt: 'Xong', cls: '' };
  const ms = new Date(t.deadline) - Date.now(), a = Math.abs(ms);
  const d = Math.floor(a / 864e5), hr = Math.max(1, Math.floor((a % 864e5) / 36e5));
  const span = d > 0 ? `${d} ngày` : `${hr} giờ`;
  return ms < 0 ? { txt: `Trễ ${span}`, cls: 'late' } : { txt: `Còn ${span}`, cls: ms < 864e5 ? 'soon' : '' };
}
let toastEl;
function toast(msg) { toastEl?.remove(); toastEl = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(toastEl); setTimeout(() => toastEl?.remove(), 4000); }
function modal(content, locked) {
  const scrim = h('div', { class: 'scrim' }), box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, content);
  const close = () => { scrim.remove(); box.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => e.key === 'Escape' && close();
  if (!locked) { scrim.onclick = close; document.addEventListener('keydown', esc); } document.body.append(scrim, box);
  (box.querySelector('input,textarea,button') || box).focus();
  return { close, box };
}
async function openFile(path) {
  const w = window.open('about:blank', '_blank');
  const { data, error } = await sb.storage.from('files').createSignedUrl(path, 300);
  if (error) { w?.close(); return toast('Không mở được file: ' + error.message); }
  w.location = data.signedUrl;
}
const fileLink = (path, label) => path ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); openFile(path); } }, svg(ICON.clip), ' ', label || path.split('/').pop().replace(/^\d+-/, '')) : '—';
async function upload(path, file) {
  const { error } = await sb.storage.from('files').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/* ---------- đăng nhập / khởi động ---------- */
function renderLogin(msg) {
  $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-box' },
    h('img', { src: 'assets/logo.png', alt: 'Logo Hugo English Club — Niffler' }),
    h('h1', {}, 'Niffler Tracker'),
    h('p', { class: 'muted' }, 'Theo dõi tiến độ việc của cả đội. Đăng nhập bằng email Google đã được admin thêm.'),
    msg && h('p', { class: 'err' }, msg),
    h('button', { class: 'btn primary', onclick: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }) }, 'Đăng nhập bằng Google'))));
}
async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) return renderLogin('Chưa cấu hình: điền SUPABASE_URL và SUPABASE_ANON_KEY trong config.js (xem docs/cai-dat.md).');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  const { data: me, error } = await sb.rpc('claim_profile');
  if (error || !me?.id) {
    $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-box' }, h('img', { src: 'assets/logo.png', alt: '' }),
      h('h1', {}, 'Chưa có trong danh sách'), h('p', { class: 'muted' }, `Email ${session.user.email} chưa được admin thêm vào CLB. Nhờ admin thêm email này rồi đăng nhập lại.`),
      h('button', { class: 'btn', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Đăng xuất'))));
    return;
  }
  S.me = me; await loadAll(); subscribe(); renderShell();
  if (!S.me.named) nameDialog(true);
}
async function loadAll() {
  const [p, t, m, e] = await Promise.all([
    sb.from('profiles').select('*').order('name'), sb.from('tasks').select('*').order('deadline'),
    sb.from('meetings').select('*').order('held_on', { ascending: false }), sb.from('events').select('*').order('on_date'),
  ]);
  S.profiles = p.data || []; S.tasks = t.data || []; S.meetings = m.data || []; S.events = e.data || [];
  // chưa đặt tên thì hiện phần trước @ của email; named = đã tự đặt tên
  S.profiles.forEach((x) => { x.named = !!x.name; x.name = x.name || x.email.split('@')[0]; });
  if (S.me) S.me = S.profiles.find((x) => x.id === S.me.id) || S.me;
}
function subscribe() {
  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { await loadAll(); renderView(); if (S.openTask) loadDrawerLists(S.openTask); }, 250); };
  sb.channel('db').on('postgres_changes', { event: '*', schema: 'public' }, refresh).subscribe();
}
['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (!e.target.closest?.('[data-drop]')) e.preventDefault(); }));

/* ---------- khung trang ---------- */
const TABS = [['board', 'Bảng việc'], ['timeline', 'Timeline'], ['meetings', 'Log họp'], ['guide', 'Hướng dẫn'], ['templates', 'Tải mẫu']];
function renderShell() {
  const tabs = [...TABS, ...(isAdmin() ? [['members', 'Thành viên']] : [])];
  $app.replaceChildren(
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('img', { src: 'assets/logo.png', alt: '' }), h('span', {}, 'Niffler')),
      h('nav', { class: 'tabs', 'aria-label': 'Chức năng' }, tabs.map(([k, l]) => h('button', { class: 'tab', 'data-tab': k, onclick: () => { S.view = k; renderShell(); } }, l))),
      h('div', { class: 'who' }, h('span', {}, S.me.name), h('button', { class: 'btn rename', onclick: () => nameDialog(false) }, svg(ICON.pencil), ' Đổi tên'), isAdmin() && h('span', { class: 'role' }, 'Admin'),
        h('button', { class: 'linkbtn', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Đăng xuất'))),
    h('main', { id: 'view' }));
  document.querySelectorAll('.tab').forEach((b) => b.dataset.tab === S.view && b.setAttribute('aria-current', 'page'));
  renderView();
}
function renderView() {
  ({ board: renderBoard, timeline: renderTimeline, meetings: renderMeetings, guide: renderGuide, templates: renderTemplates, members: renderMembers }[S.view])();
}
const head = (title, ...right) => h('div', { class: 'pagehead' }, h('h1', {}, title), h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, right));

/* ---------- bảng việc ---------- */
const canMove = (t) => isAdmin() || t.assignee === S.me.id;
async function moveTask(t, to) {
  if (t.status === to) return;
  if (to === 'done' && !t.proof_path) return proofDialog(t);
  const { error } = await sb.from('tasks').update({ status: to }).eq('id', t.id);
  if (error) toast('Không đổi được: ' + error.message); else { t.status = to; renderView(); }
}
function card(t) {
  const w = when(t), can = canMove(t);
  const idx = ORDER.indexOf(t.status);
  const mv = (dir) => h('button', { class: 'btn', 'aria-label': `Chuyển "${t.title}" sang ${STATUS[ORDER[idx + dir]]}`, onclick: (e) => { e.stopPropagation(); moveTask(t, ORDER[idx + dir]); } }, svg(dir < 0 ? ICON.left : ICON.right), ' ', STATUS[ORDER[idx + dir]]);
  const el = h('div', { class: `task status-${t.status}${w.cls === 'late' ? ' late' : ''}`, draggable: can ? 'true' : false, tabindex: '0', role: 'button', 'aria-label': `${t.title}. ${w.txt}` },
    h('div', { class: 'title' }, t.title),
    h('div', { class: 'meta' }, h('span', {}, 'Hạn ' + fmtDay(t.deadline)), h('span', { class: 'chip ' + w.cls }, w.txt)),
    can && h('div', { class: 'movers' }, idx > 0 && mv(-1), idx < 2 && mv(1)));
  el.onclick = () => openDrawer(t.id);
  el.onkeydown = (e) => { if (e.key === 'Enter' && e.target === el) openDrawer(t.id); };
  el.ondragstart = (e) => { e.dataTransfer.setData('text/task', t.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); };
  el.ondragend = () => el.classList.remove('dragging');
  return el;
}
function renderBoard() {
  const v = $('#view'), late = S.tasks.filter(isLate), soon = S.tasks.filter((t) => when(t).cls === 'soon');
  const byP = Object.fromEntries(S.profiles.map((p) => [p.id, []]));
  S.tasks.forEach((t) => byP[t.assignee]?.push(t));
  let people = S.profiles.filter((p) => p.role === 'member' || byP[p.id].length || p.id === S.me.id);
  people.sort((a, b) => (b.id === S.me.id) - (a.id === S.me.id) || (a.name || a.email).localeCompare(b.name || b.email, 'vi'));
  if (S.mine) people = people.filter((p) => p.id === S.me.id);
  v.replaceChildren(
    head('Bảng việc', isAdmin() && h('button', { class: 'btn hot', onclick: () => createDialog(null, null) }, '+ Thêm việc'), h('label', { class: 'muted' }, h('input', { type: 'checkbox', checked: S.mine, onchange: (e) => { S.mine = e.target.checked; renderBoard(); } }), ' Chỉ việc của tôi')),
    isAdmin() && late.length > 0 && h('div', { class: 'banner late', role: 'alert' }, `${late.length} việc đang trễ hạn: ` + late.slice(0, 4).map((t) => `${t.title} (${pmap()[t.assignee]?.name || '?'})`).join('; ') + (late.length > 4 ? '…' : '')),
    !isAdmin() && S.tasks.some((t) => t.assignee === S.me.id && when(t).cls !== '' && t.status !== 'done') && h('div', { class: 'banner soon' }, 'Bạn có việc sắp đến hạn hoặc đã trễ. Mở thẻ để xem chi tiết.'),
    isAdmin() && bulkZone(),
    people.length === 0 && h('p', { class: 'muted' }, 'Chưa có thành viên. Admin thêm ở tab "Thành viên".'),
    people.map((p) => lane(p, byP[p.id])));
}
function lane(p, tasks) {
  const el = h('section', { class: 'lane', 'data-drop': '', 'aria-label': `Việc của ${p.name || p.email}` },
    h('header', {}, h('span', { class: 'avatar' }, initials(p)), h('h2', {}, p.name || p.email),
      h('span', { class: 'count muted' }, `${tasks.filter((t) => t.status !== 'done').length} đang mở${isAdmin() ? ' · thả file vào đây để giao việc' : ''}`),
      isAdmin() && h('button', { class: 'btn', style: 'margin-left:8px', onclick: () => createDialog(p, null) }, '+ Thêm việc')),
    h('div', { class: 'cols' }, ORDER.map((s) => {
      const items = tasks.filter((t) => t.status === s);
      const col = h('div', { class: 'col', 'data-assignee': p.id }, h('h3', {}, h('span', { class: `dot ${s}` }), STATUS[s], ` (${items.length})`),
        items.length ? items.map(card) : h('div', { class: 'empty' }, s === 'todo' ? [h('img', { src: 'assets/logo.png', alt: '' }), 'Chưa có việc nào.'] : '—'));
      col.ondragover = (e) => { if (e.dataTransfer.types.includes('text/task')) { e.preventDefault(); col.classList.add('over'); } };
      col.ondragleave = () => col.classList.remove('over');
      col.ondrop = (e) => {
        col.classList.remove('over');
        const t = S.tasks.find((x) => x.id === e.dataTransfer.getData('text/task'));
        if (t && t.assignee === p.id && canMove(t)) { e.preventDefault(); e.stopPropagation(); moveTask(t, s); }
      };
      return col;
    })));
  if (isAdmin()) {
    el.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); el.classList.add('over'); } };
    el.ondragleave = (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); };
    el.ondrop = (e) => {
      el.classList.remove('over'); const f = e.dataTransfer.files[0]; if (!f) return; e.preventDefault();
      f.name.toLowerCase().endsWith('.csv') ? bulkFile(f) : createDialog(p, f);
    };
  }
  return el;
}

/* ---------- giao 1 việc (thả file brief vào hàng) ---------- */
function createDialog(p, file) {
  const m = modal(null); let chosen = file || null;
  const who = h('select', {}, S.profiles.map((x) => h('option', { value: x.id, selected: x.id === p?.id }, x.name)));
  const title = h('input', { value: file ? file.name.replace(/.[^.]+$/, '') : '', required: true, maxlength: '200', placeholder: 'Ví dụ: Thiết kế poster' });
  const dl = h('input', { type: 'datetime-local', value: toLocalInput(new Date(Date.now() + 7 * 864e5).setHours(23, 59)), required: true });
  const desc = h('textarea', {});
  const fileIn = h('input', { type: 'file', onchange: () => { chosen = fileIn.files[0] || null; } });
  const err = h('p', { class: 'err' });
  const go = h('button', { class: 'btn primary', type: 'submit' }, 'Giao việc');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); go.disabled = true; err.textContent = '';
    try {
      const id = crypto.randomUUID(), person = S.profiles.find((x) => x.id === who.value);
      const brief_path = chosen ? await upload(`brief/${id}/${Date.now()}-${safeName(chosen.name)}`, chosen) : null;
      const { error } = await sb.from('tasks').insert({ id, title: title.value.trim(), description: desc.value, assignee: who.value, deadline: new Date(dl.value).toISOString(), brief_path });
      if (error) throw error;
      m.close(); toast(`Đã giao "${title.value.trim()}" cho ${person.name}`); await loadAll(); renderView();
    } catch (x) { err.textContent = x.message; go.disabled = false; }
  } },
    h('h2', {}, 'Thêm việc mới'),
    h('label', { class: 'field' }, 'Giao cho', who), h('label', { class: 'field' }, 'Tên việc', title), h('label', { class: 'field' }, 'Hạn chót', dl),
    h('label', { class: 'field' }, 'Mô tả (không bắt buộc)', desc),
    h('label', { class: 'field' }, file ? `File đính kèm: ${file.name} (chọn file khác nếu cần)` : 'File đính kèm (không bắt buộc)', fileIn), err,
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: m.close }, 'Huỷ'), go));
  m.box.replaceChildren(form); title.focus();
}

/* ---------- đặt / đổi tên hiển thị ---------- */
function nameDialog(first, target) {
  const who = target || S.me, m = modal(null, first);
  const inp = h('input', { value: who.named ? who.name : '', required: true, maxlength: '60', placeholder: 'Ví dụ: Nguyễn Văn An' }), err = h('p', { class: 'err' });
  m.box.replaceChildren(h('form', { onsubmit: async (e) => {
    e.preventDefault(); const n = inp.value.trim(); if (!n) return;
    const { error } = target && target.id !== S.me.id ? await sb.from('profiles').update({ name: n.slice(0, 60) }).eq('id', target.id) : await sb.rpc('set_my_name', { n });
    if (error) { err.textContent = error.message; return; }
    m.close(); await loadAll(); renderShell(); toast('Đã lưu tên');
  } }, h('h2', {}, first ? 'Chào mừng đến Niffler Tracker' : target ? `Đổi tên cho ${target.email}` : 'Đổi tên hiển thị'),
    first && h('p', { class: 'muted' }, 'Đây là lần đầu bạn đăng nhập. Hãy đặt tên để mọi người nhận ra bạn.'),
    h('label', { class: 'field' }, target ? 'Tên hiển thị' : 'Tên của bạn', inp), err,
    h('div', { class: 'actions' }, !first && h('button', { class: 'btn', type: 'button', onclick: m.close }, 'Huỷ'), h('button', { class: 'btn primary', type: 'submit' }, 'Lưu'))));
  inp.focus();
}

/* ---------- nộp minh chứng để hoàn thành ---------- */
function proofDialog(t) {
  const m = modal(null); let file = null;
  const info = h('p', { class: 'muted' }, 'Chưa chọn file.'), err = h('p', { class: 'err' });
  const pick = h('input', { type: 'file', hidden: true, onchange: () => set(pick.files[0]) });
  const set = (f) => { file = f; info.textContent = f ? `Đã chọn: ${f.name}` : 'Chưa chọn file.'; go.disabled = !f; };
  const go = h('button', { class: 'btn primary', disabled: true, onclick: async () => {
    go.disabled = true; err.textContent = 'Đang tải lên…';
    try {
      const path = await upload(`proof/${t.id}/${Date.now()}-${safeName(file.name)}`, file);
      const { error } = await sb.from('tasks').update({ proof_path: path, status: 'done' }).eq('id', t.id);
      if (error) throw error;
      m.close(); toast('Hoàn thành! Đã nộp minh chứng.'); await loadAll(); renderView();
    } catch (x) { err.textContent = x.message; go.disabled = false; }
  } }, 'Nộp và hoàn thành');
  const zone = h('div', { class: 'dropzone', 'data-drop': '', tabindex: '0', role: 'button', onclick: () => pick.click() }, svg(ICON.up), h('span', {}, h('strong', {}, 'Thả file minh chứng vào đây'), ' hoặc bấm để chọn (ảnh, PDF, file bài làm…).'));
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('over'); }; zone.ondragleave = () => zone.classList.remove('over');
  zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('over'); set(e.dataTransfer.files[0]); };
  zone.onkeydown = (e) => e.key === 'Enter' && pick.click();
  m.box.replaceChildren(h('h2', {}, `Hoàn thành "${t.title}"`), h('p', {}, 'Cần có file minh chứng trước khi chuyển sang Hoàn thành.'), zone, pick, info, err,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: m.close }, 'Huỷ, giữ nguyên cột cũ'), go));
}

/* ---------- giao hàng loạt từ CSV ---------- */
function bulkZone() {
  const pick = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: () => pick.files[0] && bulkFile(pick.files[0]) });
  const z = h('div', { class: 'dropzone', 'data-drop': '' }, svg(ICON.up), h('span', { style: 'flex:1' }, h('strong', {}, 'Giao việc hàng loạt: '), 'thả 1 file CSV tổng vào đây, hệ thống tự chia về từng người.'),
    h('button', { class: 'btn', onclick: () => pick.click() }, 'Chọn file CSV'), h('button', { class: 'btn', onclick: () => { S.view = 'templates'; renderShell(); } }, 'Tải mẫu'), pick);
  z.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); z.classList.add('over'); } };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); e.dataTransfer.files[0] && bulkFile(e.dataTransfer.files[0]); };
  return z;
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0], delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
function parseDeadline(s) {
  s = s.trim(); let y, mo, d, hh = 23, mi = 59, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/))) [, y, mo, d, hh = 23, mi = 59] = m;
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/))) [, d, mo, y, hh = 23, mi = 59] = m;
  else return null;
  const dt = new Date(+y, mo - 1, +d, +hh, +mi);
  return dt.getMonth() === mo - 1 && dt.getDate() === +d && +hh < 24 && +mi < 60 ? dt : null;
}
async function bulkFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) return toast('Chỉ nhận file .csv (xuất từ Excel/Google Sheets: Lưu thành CSV).');
  const rows = parseCSV(await file.text());
  const hdr = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
  const col = Object.fromEntries(['email', 'title', 'deadline', 'description'].map((k) => [k, hdr.indexOf(k)]));
  if (col.email < 0 || col.title < 0 || col.deadline < 0) return toast('Dòng đầu phải có các cột: email, title, deadline (và description). Xem file mẫu.');
  const byEmail = Object.fromEntries(S.profiles.map((p) => [p.email.toLowerCase(), p]));
  const seen = new Set(S.tasks.map((t) => t.assignee + '|' + t.title.toLowerCase()));
  const items = rows.map((r, i) => {
    const email = (r[col.email] || '').trim().toLowerCase(), title = (r[col.title] || '').trim(), dl = parseDeadline(r[col.deadline] || ''), p = byEmail[email];
    let bad = '';
    if (!p) bad = 'Email chưa có trong danh sách thành viên';
    else if (!title || title.length > 200) bad = 'Thiếu tên việc hoặc quá 200 ký tự';
    else if (!dl) bad = 'Ngày sai định dạng (dùng 2025-12-31 hoặc 31/12/2025)';
    else if (dl < new Date()) bad = 'Hạn đã qua';
    else if (seen.has(p.id + '|' + title.toLowerCase())) bad = 'Trùng việc đã có';
    if (!bad) seen.add(p.id + '|' + title.toLowerCase());
    return { line: i + 2, email, title, dl, p, bad, description: col.description >= 0 ? (r[col.description] || '').trim() : '' };
  });
  const good = items.filter((x) => !x.bad), m = modal(null);
  const go = h('button', { class: 'btn primary', disabled: !good.length, onclick: async () => {
    go.disabled = true;
    const { error } = await sb.from('tasks').insert(good.map((x) => ({ title: x.title, description: x.description, assignee: x.p.id, deadline: x.dl.toISOString() })));
    if (error) { go.disabled = false; return toast('Lỗi: ' + error.message); }
    m.close(); toast(`Đã giao ${good.length} việc.`); await loadAll(); renderView();
  } }, `Giao ${good.length} việc hợp lệ`);
  m.box.replaceChildren(h('h2', {}, 'Xem trước phân công'), h('p', { class: 'muted' }, `${items.length} dòng: ${good.length} hợp lệ, ${items.length - good.length} lỗi (dòng lỗi sẽ bị bỏ qua).`),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Dòng', 'Người nhận', 'Việc', 'Hạn', 'Trạng thái'].map((x) => h('th', {}, x)))),
      h('tbody', {}, items.map((x) => h('tr', { class: x.bad ? 'bad' : '' }, h('td', {}, x.line), h('td', {}, x.p?.name || x.email), h('td', {}, x.title), h('td', {}, x.dl ? fmt(x.dl) : '—'), h('td', {}, x.bad || 'OK')))))),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: m.close }, 'Huỷ'), go));
}

/* ---------- ngăn kéo chi tiết thẻ ---------- */
let drawerEls = null;
function closeDrawer() { drawerEls?.forEach((e) => e.remove()); drawerEls = null; S.openTask = null; }
function openDrawer(id) {
  closeDrawer(); const t = S.tasks.find((x) => x.id === id); if (!t) return;
  S.openTask = id; const P = pmap()[t.assignee], w = when(t);
  const del = h('button', { class: 'btn', onclick: async () => {
    if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Bấm lần nữa để xoá hẳn'; return; }
    const { error } = await sb.from('tasks').delete().eq('id', t.id); if (error) return toast(error.message);
    closeDrawer(); await loadAll(); renderView();
  } }, 'Xoá việc');
  const dl = h('input', { type: 'datetime-local', value: toLocalInput(t.deadline) });
  const body = h('div', { class: 'drawer', role: 'dialog', 'aria-label': t.title },
    h('header', {}, h('h2', {}, t.title), h('button', { class: 'btn', onclick: closeDrawer }, 'Đóng')),
    h('section', {}, h('dl', { class: 'kv' },
      h('dt', {}, 'Người làm'), h('dd', {}, P?.name || P?.email), h('dt', {}, 'Trạng thái'), h('dd', {}, STATUS[t.status]),
      h('dt', {}, 'Hạn chót'), h('dd', {}, fmt(t.deadline) + ' ', h('span', { class: 'chip ' + w.cls }, w.txt)),
      h('dt', {}, 'File giao việc'), h('dd', {}, fileLink(t.brief_path)), h('dt', {}, 'Minh chứng'), h('dd', {}, fileLink(t.proof_path))),
      t.description && h('p', { style: 'white-space:pre-wrap' }, t.description),
      isAdmin() && h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px' }, dl,
        h('button', { class: 'btn', onclick: async () => { const { error } = await sb.from('tasks').update({ deadline: new Date(dl.value).toISOString() }).eq('id', t.id); toast(error ? error.message : 'Đã dời hạn'); await loadAll(); renderView(); openDrawer(t.id); } }, 'Dời hạn'), del)),
    h('section', {}, h('h3', {}, 'Bình luận'), h('div', { id: 'dr-comments' }), commentForm(t.id)),
    h('section', {}, h('h3', {}, 'Lịch sử cập nhật'), h('div', { id: 'dr-hist' })));
  const scrim = h('div', { class: 'scrim', onclick: closeDrawer });
  document.body.append(scrim, body); drawerEls = [scrim, body]; loadDrawerLists(id);
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', esc); } });
}
function commentForm(taskId) {
  const ta = h('textarea', { maxlength: '2000', placeholder: 'Viết bình luận…', 'aria-label': 'Bình luận' });
  return h('form', { onsubmit: async (e) => {
    e.preventDefault(); const body = ta.value.trim(); if (!body) return;
    const { error } = await sb.from('comments').insert({ task_id: taskId, author: S.me.id, body });
    if (error) return toast(error.message); ta.value = ''; loadDrawerLists(taskId);
  } }, h('div', { class: 'field' }, ta), h('button', { class: 'btn primary', type: 'submit' }, 'Gửi'));
}
async function loadDrawerLists(id) {
  const [c, ev] = await Promise.all([sb.from('comments').select('*').eq('task_id', id).order('created_at'), sb.from('task_events').select('*').eq('task_id', id).order('created_at', { ascending: false })]);
  const P = pmap(), name = (x) => P[x]?.name || P[x]?.email || 'Ai đó';
  const cEl = $('#dr-comments'), hEl = $('#dr-hist'); if (!cEl || S.openTask !== id) return;
  cEl.replaceChildren(...(c.data?.length ? c.data.map((x) => h('div', { class: 'comment' }, h('b', {}, name(x.author)), h('time', {}, fmt(x.created_at)), h('div', { style: 'white-space:pre-wrap;overflow-wrap:anywhere' }, x.body))) : [h('p', { class: 'muted' }, 'Chưa có bình luận.')]));
  const text = (e) => ({
    created: () => 'tạo việc', status: () => `chuyển ${STATUS[e.detail.from]} → ${STATUS[e.detail.to]}`, deadline: () => `dời hạn từ ${fmt(e.detail.from)} sang ${fmt(e.detail.to)}`,
    assignee: () => `đổi người làm sang ${name(e.detail.to)}`, proof: () => 'nộp minh chứng', comment: () => `bình luận: “${e.detail.body}”`,
  }[e.kind]?.() ?? e.kind);
  hEl.replaceChildren(...(ev.data || []).map((e) => h('div', { class: 'hist' }, h('b', {}, name(e.actor)), ' ', text(e), h('time', {}, fmt(e.created_at)))));
}

/* ---------- timeline tổng ---------- */
function renderTimeline() {
  const v = $('#view'), DAY = 28, P = S.profiles;
  const tasks = S.tasks, now = new Date();
  const start = new Date(Math.min(now - 7 * 864e5, ...tasks.map((t) => +new Date(t.created_at)), ...S.meetings.map((m) => +new Date(m.held_on)))); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lùi về thứ Hai để nhãn tuần không đè nhau
  const end = new Date(Math.max(+now + 21 * 864e5, ...tasks.map((t) => +new Date(t.deadline)), ...S.events.map((e) => +new Date(e.on_date)))); end.setDate(end.getDate() + 3);
  const x = (d) => ((new Date(d) - start) / 864e5) * DAY, width = x(end);
  const ticks = []; for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) if (d.getDay() === 1) ticks.push(h('div', { class: 'tick', style: `left:${x(d)}px` }, fmtDay(d)));
  const marks = [...S.meetings.map((m) => ({ d: m.held_on, t: 'Họp: ' + m.title })), ...S.events.map((e) => ({ d: e.on_date, t: e.title }))];
  const rows = P.map((p) => ({ p, ts: tasks.filter((t) => t.assignee === p.id) })).filter((r) => r.ts.length);
  const track = (cls, ...kids) => h('div', { class: 'tl-track ' + cls, style: `width:${width}px` }, ...kids);
  const todayX = x(now);
  const evForm = isAdmin() && (() => {
    const d = h('input', { type: 'date', required: true, 'aria-label': 'Ngày' }), t = h('input', { placeholder: 'Tên sự kiện', required: true, 'aria-label': 'Tên sự kiện' });
    return h('form', { style: 'display:flex;gap:8px;flex-wrap:wrap', onsubmit: async (e) => { e.preventDefault(); const { error } = await sb.from('events').insert({ on_date: d.value, title: t.value.trim() }); if (error) return toast(error.message); await loadAll(); renderView(); } },
      d, t, h('button', { class: 'btn', type: 'submit' }, 'Thêm mốc sự kiện'));
  })();
  v.replaceChildren(head('Timeline tổng', evForm || ''),
    h('div', { class: 'tl' }, h('div', { class: 'tl-grid', style: `min-width:${width + 150}px` },
      h('div', { class: 'tl-head' }, h('div', { class: 'name', style: 'padding:6px 12px;font-weight:700' }, 'Người / sự kiện'), h('div', { class: 'tl-ticks', style: `width:${width}px` }, ticks)),
      h('div', { class: 'tl-row', style: 'min-height:54px' }, h('div', { class: 'name' }, 'Sự kiện'), track('', h('div', { class: 'today lab', style: `left:${todayX}px` }),
        marks.map((m) => h('div', { class: 'marker', style: `left:${x(m.d)}px`, title: `${fmtDay(m.d)} · ${m.t}` })),
        marks.map((m) => h('span', { style: `position:absolute;left:${x(m.d) + 14}px;top:28px;font-size:11px;white-space:nowrap` }, m.t)))),
      rows.map(({ p, ts }) => h('div', { class: 'tl-row', style: `min-height:${ts.length * 28 + 12}px` }, h('div', { class: 'name' }, p.name || p.email),
        track('', h('div', { class: 'today', style: `left:${todayX}px` }), ts.map((t, i) => {
          const l = x(t.created_at), w = Math.max(x(t.deadline) - l, 110), c = isLate(t) ? 'late' : t.status;
          return h('button', { class: `bar ${c}`, style: `left:${l}px;width:${w}px;top:${6 + i * 28}px`, title: `${t.title} — hạn ${fmt(t.deadline)}`, onclick: () => openDrawer(t.id) }, t.title);
        }))))),
    rows.length === 0 && h('p', { class: 'muted', style: 'padding:14px' }, 'Chưa có việc nào để vẽ.')));
}

/* ---------- log họp ---------- */
function renderMeetings() {
  const v = $('#view'), q = h('input', { type: 'search', placeholder: 'Tìm theo tiêu đề hoặc nội dung', 'aria-label': 'Tìm log họp', style: 'min-height:40px;padding:8px 10px;border:1px solid #cdbfd3;border-radius:8px' });
  const list = h('div', {});
  const draw = () => {
    const k = q.value.trim().toLowerCase(), ms = S.meetings.filter((m) => !k || (m.title + m.body_md).toLowerCase().includes(k));
    list.replaceChildren(...(ms.length ? ms.map((m) => h('article', { class: 'meeting' }, h('header', {}, h('h2', {}, m.title), h('span', { class: 'muted' }, new Date(m.held_on).toLocaleDateString('vi-VN')),
      isAdmin() && h('button', { class: 'btn', style: 'margin-left:auto', onclick: async (e) => { if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = 'Bấm lần nữa để xoá'; return; } await sb.from('meetings').delete().eq('id', m.id); await loadAll(); draw(); } }, 'Xoá')),
      h('div', { class: 'prose', html: md(m.body_md) }))) : [h('p', { class: 'muted' }, 'Chưa có log họp nào.')]));
  };
  q.oninput = draw;
  v.replaceChildren(head('Log họp', q), isAdmin() && meetingForm(draw), list); draw();
}
function meetingForm(redraw) {
  const date = h('input', { type: 'date', required: true, value: new Date().toISOString().slice(0, 10) }), title = h('input', { required: true, placeholder: 'Họp tuần 12' }), body = h('textarea', { placeholder: 'Dán log họp (Markdown) hoặc thả file .md/.txt vào ô này' });
  body.ondragover = (e) => e.preventDefault();
  const read = async (f) => { if (!f) return; body.value = await f.text(); if (!title.value) title.value = f.name.replace(/\.[^.]+$/, ''); };
  body.ondrop = (e) => { e.preventDefault(); read(e.dataTransfer.files[0]); };
  const box = h('form', { class: 'meeting', 'data-drop': '', onsubmit: async (e) => {
    e.preventDefault(); const { error } = await sb.from('meetings').insert({ held_on: date.value, title: title.value.trim(), body_md: body.value, author: S.me.id });
    if (error) return toast(error.message); title.value = ''; body.value = ''; await loadAll(); redraw(); toast('Đã lưu log họp');
  } }, h('h2', {}, 'Thêm log họp'), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('label', { class: 'field' }, 'Ngày họp', date), h('label', { class: 'field', style: 'flex:1;min-width:200px' }, 'Tiêu đề', title)),
    h('label', { class: 'field' }, 'Nội dung', body), h('button', { class: 'btn primary', type: 'submit' }, 'Lưu log họp'));
  return box;
}

/* ---------- hướng dẫn, mẫu ---------- */
async function renderGuide() {
  const v = $('#view'), docs = [['huong-dan-thanh-vien', 'Dành cho thành viên'], ...(isAdmin() ? [['huong-dan-admin', 'Dành cho admin']] : [])];
  const out = h('article', { class: 'prose' }), pick = async (f) => { out.innerHTML = md(await (await fetch(`docs/${f}.md`)).text()); };
  v.replaceChildren(head('Hướng dẫn', docs.map(([f, l]) => h('button', { class: 'btn', onclick: () => pick(f) }, l))), out); pick(docs[isAdmin() ? 1 : 0][0]);
}
function renderTemplates() {
  const T = [['templates/mau-phan-cong.csv', 'Mẫu phân công (CSV)', 'File tổng để admin thả vào Bảng việc. Mở bằng Excel hoặc Google Sheets, giữ nguyên dòng đầu.'], ['templates/mau-log-hop.md', 'Mẫu log họp (Markdown)', 'Dán hoặc thả vào ô Thêm log họp. Có sẵn các mục: quyết định, việc giao, việc tồn.']];
  $('#view').replaceChildren(head('Tải mẫu'), h('div', { class: 'tplgrid' }, T.map(([href, t, d]) => h('div', { class: 'tpl' }, h('h2', { style: 'font-size:18px' }, t), h('p', { class: 'muted' }, d), h('a', { class: 'btn primary', href, download: '', style: 'text-decoration:none;text-align:center' }, 'Tải về')))));
}

/* ---------- thành viên (admin) ---------- */
function renderMembers() {
  const email = h('input', { type: 'email', required: true, placeholder: 'ten@gmail.com' }), name = h('input', { placeholder: 'Để trống: người đó tự đặt tên' }), role = h('select', {}, h('option', { value: 'member' }, 'Thành viên'), h('option', { value: 'admin' }, 'Admin'));
  $('#view').replaceChildren(head('Thành viên'),
    h('form', { class: 'meeting', onsubmit: async (e) => { e.preventDefault(); const { error } = await sb.from('profiles').insert({ email: email.value.trim().toLowerCase(), name: name.value.trim(), role: role.value }); if (error) return toast(error.message); await loadAll(); renderMembers(); } },
      h('h2', {}, 'Thêm người vào CLB'), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px' }, h('label', { class: 'field' }, 'Email Google', email), h('label', { class: 'field' }, 'Họ tên (không bắt buộc)', name), h('label', { class: 'field' }, 'Vai trò', role)),
      h('button', { class: 'btn primary', type: 'submit' }, 'Thêm')),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Họ tên', 'Email', 'Vai trò', 'Đã đăng nhập', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, S.profiles.map((p) => h('tr', {}, h('td', {}, p.named ? p.name : '(chưa đặt tên)'), h('td', {}, p.email), h('td', {}, p.role === 'admin' ? 'Admin' : 'Thành viên'), h('td', {}, p.auth_id ? 'Rồi' : 'Chưa'),
        h('td', {}, h('button', { class: 'btn', style: 'margin-right:6px', onclick: () => nameDialog(false, p) }, 'Đổi tên'), p.id !== S.me.id && h('button', { class: 'btn', onclick: async (e) => { if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = 'Bấm lần nữa để xoá (xoá cả việc của họ)'; return; } const { error } = await sb.from('profiles').delete().eq('id', p.id); if (error) return toast(error.message); await loadAll(); renderMembers(); } }, 'Xoá'))))))));
}

boot();
