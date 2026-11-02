/* Niffler Tracker — không build, chạy thẳng trên GitHub Pages. */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $app = document.getElementById('app');
const STATUS = { get todo() { return tr('Nhận'); }, get doing() { return tr('Đang làm'); }, get done() { return tr('Hoàn thành'); } };
const roleLabel = (r) => (r === 'admin' ? 'Admin' : LANG === 'en' ? 'Member' : 'Thành viên');
const ORDER = ['todo', 'doing', 'done'];
const S = { me: null, profiles: [], tasks: [], meetings: [], events: [], projects: [], view: 'board', mine: false, proj: '', openTask: null };
const SUPER = 'niffler.hugo@gmail.com'; // chỉ tài khoản này đổi được vai trò (DB cũng chặn bằng trigger profiles_role_guard)
const isAdmin = () => S.me?.role === 'admin';
const isSuper = () => S.me?.email?.toLowerCase() === SUPER;
// "Sự kiện" trong UI = bảng projects (bảng events là mốc timeline). Việc của sự kiện đã đóng bị ẩn khỏi bảng/timeline.
const projMap = () => Object.fromEntries(S.projects.map((p) => [p.id, p]));
const live = () => { const pm = projMap(); return S.tasks.filter((t) => !pm[t.project_id]?.closed_at); };
async function ensureProject(name) {
  name = name.trim(); if (!name) return null;
  const hit = S.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.closed_at ? Promise.reject(new Error(`Sự kiện "${hit.name}" đã hoàn thành, đặt tên khác.`)) : hit.id;
  const { data, error } = await sb.from('projects').insert({ name }).select().single();
  if (error) throw error; S.projects.push(data); return data.id;
}

/* ---------- tiện ích ---------- */
// replaceChildren gốc in ra "false" và "[object ...]": làm nó bỏ qua false/null và mở mảng, giống h().
const _rc = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...k) { _rc.apply(this, k.flat(Infinity).filter((c) => c != null && c !== false)); };
const TR_ATTR = new Set(['placeholder', 'aria-label', 'title', 'alt']);
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v; // chỉ nhận chuỗi đã qua DOMPurify (md())
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : TR_ATTR.has(k) ? tr(v) : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(typeof c === 'string' ? tr(c) : c));
  return e;
}
const svg = (d) => { const e = document.createElement('span'); e.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; return e.firstChild; };
const ICON = {
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  up: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>', pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', clip: '<path d="M21 12l-9 9a5 5 0 01-7-7l9-9a3 3 0 014 4l-9 9a1 1 0 01-2-2l8-8"/>',
};
const $ = (s, r = document) => r.querySelector(s);
const pmap = () => Object.fromEntries(S.profiles.map((p) => [p.id, p]));
const fmt = (d) => new Date(d).toLocaleString(LOCALE(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString(LOCALE(), { day: '2-digit', month: '2-digit' });
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
function toast(msg) { toastEl?.remove(); toastEl = h('div', { class: 'toast', role: 'status' }, tr(msg)); document.body.append(toastEl); setTimeout(() => toastEl?.remove(), 4000); }
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
const STK = (n, cls = 'sticker') => h('img', { class: cls, src: `assets/stickers/${n}.png`, alt: '' });
// Nút đổi ngôn ngữ Việt/Anh; sau khi đổi vẽ lại khung (đã đăng nhập) hoặc màn hình `again` (chưa đăng nhập).
const langBtn = (again) => h('button', { class: 'linkbtn', 'aria-label': 'Language', onclick: () => { setLang(LANG === 'en' ? 'vi' : 'en'); S.me ? renderShell() : again(); } }, LANG === 'en' ? 'Tiếng Việt' : 'English');
function renderLogin(msg) {
  $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-box' },
    STK(1, 'sticker big'),
    h('h1', {}, 'Niffler Tracker'),
    h('p', { class: 'muted' }, 'Theo dõi tiến độ việc của cả đội. Đăng nhập bằng email Google đã được admin thêm.'),
    msg && h('p', { class: 'err' }, msg),
    h('button', { class: 'btn primary', onclick: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }) }, 'Đăng nhập bằng Google'), langBtn(renderLogin))));
}
async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT')) return renderLogin('Chưa cấu hình: điền SUPABASE_URL và SUPABASE_ANON_KEY trong config.js (xem docs/cai-dat.md).');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  const { data: me, error } = await sb.rpc('claim_profile');
  if (error || !me?.id) {
    $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-box' }, STK(10, 'sticker big'),
      h('h1', {}, 'Chưa có trong danh sách'), h('p', { class: 'muted' }, `Email ${session.user.email} chưa được admin thêm vào CLB. Nhờ admin thêm email này rồi đăng nhập lại.`),
      h('button', { class: 'btn', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Đăng xuất'))));
    return;
  }
  S.me = me; await loadAll(); subscribe(); renderShell();
  if (!S.me.named) nameDialog(true);
}
async function loadAll() {
  const [p, t, m, e, pr] = await Promise.all([
    sb.from('profiles').select('*').order('name'), sb.from('tasks').select('*').order('deadline'),
    sb.from('meetings').select('*').order('held_on', { ascending: false }), sb.from('events').select('*').order('on_date'),
    sb.from('projects').select('*').order('created_at'),
  ]);
  S.profiles = p.data || []; S.tasks = t.data || []; S.meetings = m.data || []; S.events = e.data || []; S.projects = pr.data || [];
  // chưa đặt tên thì hiện phần trước @ của email; named = đã tự đặt tên
  S.profiles.forEach((x) => { x.named = !!x.name; x.name = x.name || x.email.split('@')[0]; });
  if (S.me) S.me = S.profiles.find((x) => x.id === S.me.id) || S.me;
}
function subscribe() {
  let timer;
  // Trang Log họp (admin): không vẽ lại cả trang khi có thay đổi, kẻo mất bản nháp đang soạn; chỉ vẽ lại danh sách khi không có log nào đang sửa.
  const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { await loadAll(); if (S.view === 'meetings' && isAdmin()) { if (!S.editing) S.meetingsDraw?.(); } else renderView(); if (S.openTask) loadDrawerLists(S.openTask); }, 250); };
  sb.channel('db').on('postgres_changes', { event: '*', schema: 'public' }, (p) => { if (p.table !== 'meeting_blocks') refresh(); }).subscribe();
}
['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (!e.target.closest?.('[data-drop]')) e.preventDefault(); }));

/* ---------- khung trang ---------- */
const TABS = [['board', 'Bảng việc'], ['timeline', 'Timeline'], ['meetings', 'Log họp'], ['guide', 'Hướng dẫn'], ['templates', 'Tải mẫu']];
function renderShell() {
  const tabs = [...TABS, ...(isAdmin() ? [['projects', 'Sự kiện'], ['members', 'Thành viên']] : [])];
  $app.replaceChildren(
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('img', { src: 'assets/logo.png', alt: '' }), h('span', {}, 'Niffler')),
      h('nav', { class: 'tabs', 'aria-label': 'Chức năng' }, tabs.map(([k, l]) => h('button', { class: 'tab', 'data-tab': k, onclick: () => { S.view = k; renderShell(); } }, l))),
      h('div', { class: 'who' }, h('span', {}, S.me.name), h('button', { class: 'btn rename', onclick: () => nameDialog(false) }, svg(ICON.pencil), ' Đổi tên'), isAdmin() && h('span', { class: 'role' }, 'Admin'),
        langBtn(), h('button', { class: 'linkbtn', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'Đăng xuất'))),
    isAdmin() && h('div', { class: 'usage', id: 'usage' }),
    h('main', { id: 'view' }));
  isAdmin() && showUsage();
  document.querySelectorAll('.tab').forEach((b) => b.dataset.tab === S.view && b.setAttribute('aria-current', 'page'));
  renderView();
}
// Dung lượng gói Free của Supabase (1 GB file, 500 MB database); số liệu từ RPC storage_usage (chỉ admin).
async function showUsage() {
  const { data, error } = await sb.rpc('storage_usage'), box = $('#usage'); if (error || !data || !box) return;
  const mb = (b) => b >= 2 ** 30 ? (b / 2 ** 30).toFixed(2) + ' GB' : (b / 2 ** 20).toFixed(1) + ' MB';
  const bar = (label, used, max) => { const pct = Math.min(100, (used / max) * 100); return h('div', { class: 'ubar' + (pct > 80 ? ' warn' : '') }, h('span', {}, `${label}: ${mb(used)} / ${mb(max)} (${pct.toFixed(1)}%)`), h('div', { class: 'track', role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${pct}%` }))); };
  box.replaceChildren(bar('File (Storage)', +data.files, 2 ** 30), bar('Database', +data.db, 500 * 2 ** 20));
}
function renderView() {
  ({ board: renderBoard, timeline: renderTimeline, meetings: renderMeetings, guide: renderGuide, templates: renderTemplates, projects: renderProjects, members: renderMembers }[S.view])();
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
  const el = h('div', { class: `task status-${t.status}${w.cls === 'late' ? ' late' : ''}`, draggable: can ? 'true' : false, tabindex: '0', role: 'button', 'aria-label': `${t.title}. ${tr(w.txt)}` },
    projMap()[t.project_id] && h('div', { class: 'evtag' }, projMap()[t.project_id].name),
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
  const open = S.projects.filter((p) => !p.closed_at);
  if (S.proj && S.proj !== 'none' && !open.some((p) => p.id === S.proj)) S.proj = '';
  const tasks = live().filter((t) => !S.proj || (S.proj === 'none' ? !t.project_id : t.project_id === S.proj));
  const v = $('#view'), late = tasks.filter(isLate);
  const byP = Object.fromEntries(S.profiles.map((p) => [p.id, []]));
  tasks.forEach((t) => byP[t.assignee]?.push(t));
  const filter = open.length > 0 && h('label', { class: 'muted' }, 'Sự kiện: ', h('select', { onchange: (e) => { S.proj = e.target.value; renderBoard(); } },
    h('option', { value: '' }, 'Tất cả'), open.map((p) => h('option', { value: p.id, selected: S.proj === p.id }, p.name)), h('option', { value: 'none', selected: S.proj === 'none' }, 'Không thuộc sự kiện')));
  let people = S.profiles.filter((p) => p.role === 'member' || byP[p.id].length || p.id === S.me.id);
  people.sort((a, b) => (b.id === S.me.id) - (a.id === S.me.id) || (a.name || a.email).localeCompare(b.name || b.email, 'vi'));
  if (S.mine) people = people.filter((p) => p.id === S.me.id);
  v.replaceChildren(
    head('Bảng việc', isAdmin() && h('button', { class: 'btn hot', onclick: () => createDialog(null, null) }, '+ Thêm việc'), filter, h('label', { class: 'muted' }, h('input', { type: 'checkbox', checked: S.mine, onchange: (e) => { S.mine = e.target.checked; renderBoard(); } }), ' Chỉ việc của tôi')),
    isAdmin() && late.length > 0 && h('div', { class: 'banner late', role: 'alert' }, `${late.length} việc đang trễ hạn: ` + late.slice(0, 4).map((t) => `${t.title} (${pmap()[t.assignee]?.name || '?'})`).join('; ') + (late.length > 4 ? '…' : '')),
    !isAdmin() && tasks.some((t) => t.assignee === S.me.id && when(t).cls !== '' && t.status !== 'done') && h('div', { class: 'banner soon' }, 'Bạn có việc sắp đến hạn hoặc đã trễ. Mở thẻ để xem chi tiết.'),
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
  const proj = h('select', {}, h('option', { value: '' }, 'Không thuộc sự kiện'), S.projects.filter((x) => !x.closed_at).map((x) => h('option', { value: x.id, selected: x.id === S.proj }, x.name)));
  const newProj = h('input', { maxlength: '100', placeholder: 'Hoặc gõ tên sự kiện mới' });
  const fileIn = h('input', { type: 'file', onchange: () => { chosen = fileIn.files[0] || null; } });
  const err = h('p', { class: 'err' });
  const go = h('button', { class: 'btn primary', type: 'submit' }, 'Giao việc');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); go.disabled = true; err.textContent = '';
    try {
      const id = crypto.randomUUID(), person = S.profiles.find((x) => x.id === who.value);
      const brief_path = chosen ? await upload(`brief/${id}/${Date.now()}-${safeName(chosen.name)}`, chosen) : null;
      const project_id = newProj.value.trim() ? await ensureProject(newProj.value) : proj.value || null;
      const { error } = await sb.from('tasks').insert({ id, title: title.value.trim(), description: desc.value, assignee: who.value, deadline: new Date(dl.value).toISOString(), brief_path, project_id });
      if (error) throw error;
      m.close(); toast(`Đã giao "${title.value.trim()}" cho ${person.name}`); await loadAll(); renderView();
    } catch (x) { err.textContent = x.message; go.disabled = false; }
  } },
    h('h2', {}, 'Thêm việc mới'),
    h('label', { class: 'field' }, 'Giao cho', who), h('label', { class: 'field' }, 'Tên việc', title), h('label', { class: 'field' }, 'Hạn chót', dl),
    h('label', { class: 'field' }, 'Sự kiện', proj, newProj),
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
  } }, first && STK(6), h('h2', {}, first ? 'Chào mừng đến Niffler Tracker' : target ? `Đổi tên cho ${target.email}` : 'Đổi tên hiển thị'),
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
  const set = (f) => { file = f; info.textContent = tr(f ? `Đã chọn: ${f.name}` : 'Chưa chọn file.'); go.disabled = !f; };
  const go = h('button', { class: 'btn primary', disabled: true, onclick: async () => {
    go.disabled = true; err.textContent = tr('Đang tải lên…');
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
  m.box.replaceChildren(STK(13), h('h2', {}, `Hoàn thành "${t.title}"`), h('p', {}, 'Cần có file minh chứng trước khi chuyển sang Hoàn thành.'), zone, pick, info, err,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: m.close }, 'Huỷ, giữ nguyên cột cũ'), go));
}

/* ---------- giao hàng loạt từ CSV ---------- */
function bulkZone() {
  const pick = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: () => pick.files[0] && bulkFile(pick.files[0]) });
  const z = h('div', { class: 'dropzone', 'data-drop': '' }, svg(ICON.up), h('span', { style: 'flex:1' }, h('strong', {}, 'Giao nhiều việc: '), 'điền bảng ngay trên web, hoặc thả 1 file CSV vào đây.'),
    h('button', { class: 'btn primary', onclick: () => gridDialog() }, 'Giao nhiều việc'), h('button', { class: 'btn', onclick: () => pick.click() }, 'Nhập từ CSV'), h('button', { class: 'btn', onclick: () => { S.view = 'templates'; renderShell(); } }, 'Tải mẫu'), pick);
  z.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); z.classList.add('over'); } };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); e.dataTransfer.files[0] && bulkFile(e.dataTransfer.files[0]); };
  return z;
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0], cnt = (c) => first.split(c).length - 1, delim = cnt('\t') > 0 ? '\t' : cnt(';') > cnt(',') ? ';' : ',';
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
// Kiểm tra 1 việc (dùng chung cho bảng nhập và CSV); `seen` gom "người|tên việc" để bắt trùng. Trả về chuỗi lỗi hoặc rỗng.
function checkTask(p, title, dl, event, seen, noPerson = 'Email chưa có trong danh sách thành viên', noDate = 'Ngày sai định dạng (dùng 2025-12-31 hoặc 31/12/2025)') {
  let bad = '';
  if (S.projects.some((x) => x.closed_at && x.name.toLowerCase() === event.toLowerCase())) bad = 'Sự kiện này đã hoàn thành';
  else if (event.length > 100) bad = 'Tên sự kiện quá 100 ký tự';
  else if (!p) bad = noPerson;
  else if (!title || title.length > 200) bad = 'Thiếu tên việc hoặc quá 200 ký tự';
  else if (!dl || isNaN(dl)) bad = noDate;
  else if (dl < new Date()) bad = 'Hạn đã qua';
  else if (seen.has(p.id + '|' + title.toLowerCase())) bad = 'Trùng việc đã có';
  if (!bad) seen.add(p.id + '|' + title.toLowerCase());
  return bad;
}
async function assignTasks(good) {
  const ids = {}; for (const n of new Set(good.map((x) => x.event).filter(Boolean))) ids[n.toLowerCase()] = await ensureProject(n);
  const { error } = await sb.from('tasks').insert(good.map((x) => ({ ...(x.id ? { id: x.id } : {}), title: x.title, description: x.description || '', assignee: x.p.id, deadline: x.dl.toISOString(), project_id: ids[x.event.toLowerCase()] || null })));
  if (error) throw error;
}

/* ---------- bảng nhập nhiều việc ngay trên web ---------- */
function gridDialog(pre) {
  const m = modal(null); m.box.classList.add('wide');
  const dl0 = () => toLocalInput(new Date(Date.now() + 7 * 864e5).setHours(23, 59));
  const rows = [], tbody = h('tbody', {}), msg = h('p', { class: 'err' });
  const list = h('datalist', { id: 'ev-list' }, S.projects.filter((x) => !x.closed_at).map((x) => h('option', { value: x.name })));
  const isBlank = (r) => !r.who.value && !r.title.value.trim() && !r.event.value.trim() && !r.desc.value.trim();
  function addRow(v = {}) {
    const r = {
      who: h('select', { 'aria-label': 'Người nhận' }, h('option', { value: '' }, '— Chọn người —'), S.profiles.map((x) => h('option', { value: x.id, selected: x.id === v.who }, x.name))),
      title: h('input', { maxlength: '200', 'aria-label': 'Tên việc', value: v.title || '' }), dl: h('input', { type: 'datetime-local', 'aria-label': 'Hạn chót', value: v.dl ?? dl0() }),
      event: h('input', { list: 'ev-list', maxlength: '100', 'aria-label': 'Sự kiện', value: v.event || '' }), desc: h('input', { 'aria-label': 'Mô tả', value: v.desc || '' }), err: h('td', { class: 'err' }),
    };
    r.tr = h('tr', {}, h('td', {}, r.who), h('td', {}, r.title), h('td', {}, r.dl), h('td', {}, r.event), h('td', {}, r.desc), r.err,
      h('td', {}, h('button', { class: 'btn', type: 'button', 'aria-label': 'Xoá dòng', onclick: () => { rows.splice(rows.indexOf(r), 1); r.tr.remove(); } }, '×')));
    rows.push(r); tbody.append(r.tr);
  }
  const paste = h('textarea', { rows: '3', placeholder: 'Dán các dòng copy từ Excel/Google Sheets, mỗi dòng: người nhận (email hoặc tên) | tên việc | hạn | sự kiện | mô tả' });
  // data: mảng dòng [người nhận (email/tên), việc, hạn, sự kiện, mô tả]
  const load = (data) => {
    const byKey = {}; S.profiles.forEach((p) => { byKey[p.email.toLowerCase()] = p; byKey[p.name.toLowerCase()] = p; });
    rows.filter(isBlank).forEach((r) => { rows.splice(rows.indexOf(r), 1); r.tr.remove(); });
    data.forEach((r) => {
      const raw = (r[2] || '').trim(), d = raw ? parseDeadline(raw) : null;
      addRow({ who: byKey[(r[0] || '').trim().toLowerCase()]?.id, title: (r[1] || '').trim(), dl: raw ? (d ? toLocalInput(d) : '') : undefined, event: (r[3] || '').trim(), desc: (r[4] || '').trim() });
    });
  };
  const fill = () => { const data = parseCSV(paste.value); if (!data.length) return; load(data); paste.value = ''; };
  const go = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    msg.textContent = ''; const seen = new Set(S.tasks.map((t) => t.assignee + '|' + t.title.toLowerCase()));
    const used = rows.filter((r) => !isBlank(r)); if (!used.length) { msg.textContent = tr('Chưa có dòng nào để giao.'); return; }
    let bad = 0; const good = [];
    used.forEach((r) => {
      const p = S.profiles.find((x) => x.id === r.who.value), title = r.title.value.trim(), dl = r.dl.value ? new Date(r.dl.value) : null, event = r.event.value.trim();
      const why = checkTask(p, title, dl, event, seen, 'Chưa chọn người nhận', 'Hạn chót không hợp lệ');
      r.err.textContent = tr(why); r.tr.classList.toggle('bad', !!why);
      if (why) bad++; else good.push({ p, title, dl, event, description: r.desc.value.trim() });
    });
    if (bad) { msg.textContent = tr(`Còn ${bad} dòng lỗi, sửa rồi bấm Giao lại.`); return; }
    go.disabled = true;
    try { await assignTasks(good); } catch (e) { go.disabled = false; return toast('Lỗi: ' + e.message); }
    m.close(); toast(`Đã giao ${good.length} việc.`); await loadAll(); renderView();
  } }, 'Giao tất cả');
  if (pre?.length) load(pre); else for (let i = 0; i < 3; i++) addRow();
  m.box.replaceChildren(h('h2', {}, 'Giao nhiều việc cùng lúc'), h('p', { class: 'muted' }, 'Mỗi dòng là một việc. Dòng để trống sẽ bị bỏ qua.'), list,
    h('div', { class: 'scroll' }, h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, ['Người nhận', 'Việc', 'Hạn chót', 'Sự kiện', 'Mô tả', 'Lỗi', ''].map((x) => h('th', {}, x)))), tbody)),
    h('div', { style: 'margin:8px 0' }, h('button', { class: 'btn', type: 'button', onclick: () => addRow() }, '+ Thêm dòng')),
    h('details', {}, h('summary', {}, 'Dán từ Excel / Google Sheets'), paste, h('button', { class: 'btn', type: 'button', onclick: fill }, 'Điền vào bảng')),
    msg, h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: m.close }, 'Huỷ'), go));
}

async function bulkFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) return toast('Chỉ nhận file .csv (xuất từ Excel/Google Sheets: Lưu thành CSV).');
  const rows = parseCSV(await file.text());
  const hdr = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
  const col = Object.fromEntries(['email', 'title', 'deadline', 'description', 'event'].map((k) => [k, hdr.indexOf(k)]));
  if (col.email < 0 || col.title < 0 || col.deadline < 0) return toast('Dòng đầu phải có các cột: email, title, deadline (và description). Xem file mẫu.');
  const byEmail = Object.fromEntries(S.profiles.map((p) => [p.email.toLowerCase(), p]));
  const seen = new Set(S.tasks.map((t) => t.assignee + '|' + t.title.toLowerCase()));
  const items = rows.map((r, i) => {
    const email = (r[col.email] || '').trim().toLowerCase(), title = (r[col.title] || '').trim(), dl = parseDeadline(r[col.deadline] || ''), p = byEmail[email];
    const event = col.event >= 0 ? (r[col.event] || '').trim() : '';
    const bad = checkTask(p, title, dl, event, seen);
    return { line: i + 2, email, title, dl, p, bad, event, description: col.description >= 0 ? (r[col.description] || '').trim() : '' };
  });
  const good = items.filter((x) => !x.bad), m = modal(null);
  const go = h('button', { class: 'btn primary', disabled: !good.length, onclick: async () => {
    go.disabled = true;
    try { await assignTasks(good); } catch (e) { go.disabled = false; return toast('Lỗi: ' + e.message); }
    m.close(); toast(`Đã giao ${good.length} việc.`); await loadAll(); renderView();
  } }, `Giao ${good.length} việc hợp lệ`);
  m.box.replaceChildren(h('h2', {}, 'Xem trước phân công'), h('p', { class: 'muted' }, `${items.length} dòng: ${good.length} hợp lệ, ${items.length - good.length} lỗi (dòng lỗi sẽ bị bỏ qua).`),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Dòng', 'Người nhận', 'Việc', 'Sự kiện', 'Hạn', 'Trạng thái'].map((x) => h('th', {}, x)))),
      h('tbody', {}, items.map((x) => h('tr', { class: x.bad ? 'bad' : '' }, h('td', {}, x.line), h('td', {}, x.p?.name || x.email), h('td', {}, x.title), h('td', {}, x.event || '—'), h('td', {}, x.dl ? fmt(x.dl) : '—'), h('td', {}, x.bad || 'OK')))))),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: m.close }, 'Huỷ'), go));
}

/* ---------- ngăn kéo chi tiết thẻ ---------- */
let drawerEls = null;
function closeDrawer() { drawerEls?.forEach((e) => e.remove()); drawerEls = null; S.openTask = null; }
function openDrawer(id) {
  closeDrawer(); const t = S.tasks.find((x) => x.id === id); if (!t) return;
  S.openTask = id; const P = pmap()[t.assignee], w = when(t);
  const del = h('button', { class: 'btn', onclick: async () => {
    if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = tr('Bấm lần nữa để xoá hẳn'); return; }
    const { error } = await sb.from('tasks').delete().eq('id', t.id); if (error) return toast(error.message);
    closeDrawer(); await loadAll(); renderView();
  } }, 'Xoá việc');
  const dl = h('input', { type: 'datetime-local', value: toLocalInput(t.deadline) });
  const body = h('div', { class: 'drawer', role: 'dialog', 'aria-label': t.title },
    h('header', {}, h('h2', {}, t.title), h('button', { class: 'btn', onclick: closeDrawer }, 'Đóng')),
    h('section', {}, h('dl', { class: 'kv' },
      h('dt', {}, 'Người làm'), h('dd', {}, P?.name || P?.email), h('dt', {}, 'Trạng thái'), h('dd', {}, STATUS[t.status]),
      h('dt', {}, 'Sự kiện'), h('dd', {}, isAdmin() ? h('select', { 'aria-label': 'Sự kiện', onchange: async (e) => { const { error } = await sb.from('tasks').update({ project_id: e.target.value || null }).eq('id', t.id); toast(error ? error.message : 'Đã đổi sự kiện'); await loadAll(); renderView(); openDrawer(t.id); } },
        h('option', { value: '' }, 'Không thuộc sự kiện'), S.projects.filter((x) => !x.closed_at).map((x) => h('option', { value: x.id, selected: x.id === t.project_id }, x.name))) : (projMap()[t.project_id]?.name || '—')),
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
  const tasks = live(), now = new Date();
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
      h('div', { class: 'tl-row', style: 'min-height:54px' }, h('div', { class: 'name' }, 'Sự kiện'), track('', h('div', { class: 'today lab', 'data-label': tr('Hôm nay'), style: `left:${todayX}px` }),
        marks.map((m) => h('div', { class: 'marker', style: `left:${x(m.d)}px`, title: `${fmtDay(m.d)} · ${m.t}` })),
        marks.map((m) => h('span', { style: `position:absolute;left:${x(m.d) + 14}px;top:28px;font-size:11px;white-space:nowrap` }, m.t)))),
      rows.map(({ p, ts }) => h('div', { class: 'tl-row', style: `min-height:${ts.length * 28 + 12}px` }, h('div', { class: 'name' }, p.name || p.email),
        track('', h('div', { class: 'today', style: `left:${todayX}px` }), ts.map((t, i) => {
          const l = x(t.created_at), w = Math.max(x(t.deadline) - l, 110), c = isLate(t) ? 'late' : t.status;
          return h('button', { class: `bar ${c}`, style: `left:${l}px;width:${w}px;top:${6 + i * 28}px`, title: `${t.title} — hạn ${fmt(t.deadline)}`, onclick: () => openDrawer(t.id) }, (projMap()[t.project_id] ? `[${projMap()[t.project_id].name}] ` : '') + t.title);
        }))))),
    rows.length === 0 && h('p', { class: 'muted', style: 'padding:14px' }, 'Chưa có việc nào để vẽ.')));
}

/* ---------- log họp ---------- */
function renderMeetings() {
  const v = $('#view'), q = h('input', { type: 'search', placeholder: 'Tìm theo tiêu đề hoặc nội dung', 'aria-label': 'Tìm log họp', style: 'min-height:40px;padding:8px 10px;border:1px solid #cdbfd3;border-radius:8px' });
  const list = h('div', {});
  const draw = () => {
    const k = q.value.trim().toLowerCase(), ms = S.meetings.filter((m) => !k || (m.title + m.body_md).toLowerCase().includes(k));
    list.replaceChildren(...(ms.length ? ms.map((m) => {
      const art = h('article', { class: 'meeting' }, h('header', {}, h('h2', {}, m.title), h('span', { class: 'muted' }, new Date(m.held_on).toLocaleDateString(LOCALE())),
        isAdmin() && h('button', { class: 'btn', style: 'margin-left:auto', onclick: () => editLog(m, art, draw) }, 'Sửa'),
        isAdmin() && h('button', { class: 'btn', onclick: async (e) => { if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = tr('Bấm lần nữa để xoá'); return; } await sb.from('meetings').delete().eq('id', m.id); await loadAll(); draw(); } }, 'Xoá')),
        h('div', { class: 'prose', html: md(m.body_md) }));
      return art;
    }) : [h('p', { class: 'muted' }, 'Chưa có log họp nào.')]));
  };
  q.oninput = draw; S.meetingsDraw = draw; S.editing = null;
  v.replaceChildren(head('Log họp', q), isAdmin() && meetingForm(draw), list); draw();
}
const tplFile = () => `templates/mau-log-hop${LANG === 'en' ? '.en' : ''}.md`;
const tplText = () => fetch(tplFile()).then((r) => r.text());
// Kiểm tra các thẻ giao việc CHƯA giao của trình soạn; tô lỗi trong thẻ. Trả về các việc hợp lệ sẵn sàng tạo.
function validateTasks(ed, blocks) {
  const seen = new Set(S.tasks.map((t) => t.assignee + '|' + t.title.toLowerCase())), good = []; let bad = 0;
  blocks.forEach((b) => {
    if (b.type !== 'task' || b.task_id) return; const c = b.content;
    const p = S.profiles.find((x) => x.id === c.who), dl = c.deadline ? new Date(c.deadline) : null, event = c.event || '';
    const why = checkTask(p, c.title, dl, event, seen, 'Chưa chọn người nhận', 'Hạn chót không hợp lệ');
    ed.mark(b.id, why ? tr(why) : ''); if (why) bad++; else good.push({ id: crypto.randomUUID(), blockId: b.id, p, title: c.title, dl, event, description: '' });
  });
  return { ok: !bad, good };
}
const blankTask = (b) => b.type === 'task' && !b.task_id && !b.content.who && !b.content.whoText && !b.content.title;
// Log cũ chỉ có body_md: chuyển thành khối một lần (người đến trước giành quyền chuyển, người sau chờ khối xuất hiện).
async function ensureBlocks(m) {
  if (m.blocks_ready) return;
  const claim = await sb.from('meetings').update({ blocks_ready: true }).eq('id', m.id).eq('blocks_ready', false).select('id');
  if (claim.error) throw claim.error;
  if (claim.data?.length) {
    const bl = mdToBlocks(m.body_md), r = await sb.from('meeting_blocks').insert(bl.map((b, i) => ({ id: b.id, meeting_id: m.id, pos: i + 1, type: b.type, content: b.content, task_id: b.task_id, updated_by: S.me.id })));
    if (r.error) { await sb.from('meetings').update({ blocks_ready: false }).eq('id', m.id); throw r.error; }
  } else for (let i = 0; i < 10; i++) { const { data } = await sb.from('meeting_blocks').select('id').eq('meeting_id', m.id).limit(1); if (data?.length) break; await new Promise((r) => setTimeout(r, 500)); }
}
// Sửa log đã lưu ngay tại chỗ: mỗi thay đổi tự lưu theo khối, nhiều admin cùng sửa được; "Xong" tạo việc cho thẻ mới và cập nhật bản đọc.
async function editLog(m, art, draw) {
  if (S.editing) return toast(L2('Đang sửa một log khác, bấm Xong ở log đó trước.', 'Another log is being edited, click Done there first.'));
  S.editing = { id: m.id };
  try {
    await ensureBlocks(m);
    const { data: rows, error } = await sb.from('meeting_blocks').select('*').eq('meeting_id', m.id).order('pos'); if (error) throw error;
    const date = h('input', { type: 'date', required: true, value: m.held_on }), title = h('input', { required: true, value: m.title }), who = h('span', { class: 'muted' });
    const done = h('button', { class: 'btn primary', type: 'button' }, 'Xong'), close = h('button', { class: 'btn', type: 'button' }, 'Đóng');
    let busy = false, sync; const ed = blockEditor({ onChange: () => {
      const n = ed.read().filter((b) => b.type === 'task' && !b.task_id && !blankTask(b)).length;
      done.textContent = n ? L2(`Xong và giao ${n} việc`, `Done and assign ${n} task${n === 1 ? '' : 's'}`) : tr('Xong');
    } });
    ed.setBlocks(rows.length ? rows : [{ id: crypto.randomUUID(), type: 'p', content: {} }]);
    sync = syncEditor(ed, m.id, rows, (names) => { who.textContent = names.length ? L2('Đang soạn: ', 'Editing now: ') + names.join(', ') : ''; });
    const finish = async (msg, createTasks) => {
      if (busy) return; busy = true; done.disabled = close.disabled = true;
      try {
        ed.pruneBlankTasks(); await sync.flush(); const all = ed.read(); let made = 0;
        const ttl = title.value.trim() || m.title;
        if (createTasks) {
          const { ok, good } = validateTasks(ed, all);
          if (!ok) { toast(L2('Có thẻ giao việc chưa hợp lệ, xem chữ đỏ trong thẻ.', 'Some task cards are not valid, see the red text in the cards.')); return; }
          good.forEach((g) => { g.description = L2(`Giao từ log họp: ${ttl}`, `Assigned from meeting log: ${ttl}`); });
          if (good.length) {
            await assignTasks(good);
            for (const g of good) {                                           // giành khối: chỉ một người tạo được việc cho một thẻ
              const r = await sb.rpc('claim_block', { p_id: g.blockId, p_task: g.id });
              if (r.error) { await sb.from('tasks').delete().in('id', good.map((x) => x.id)); throw r.error; }
              if (r.data) made++; else await sb.from('tasks').delete().eq('id', g.id);   // người khác đã giao thẻ này rồi: bỏ bản trùng
            }
          }
        }
        const u = await sb.from('meetings').update({ title: ttl, held_on: date.value, body_md: blocksToMd(ed.read()), updated_at: new Date().toISOString() }).eq('id', m.id); if (u.error) throw u.error;
        await sync.stop(); S.editing = null; await loadAll(); draw();
        toast(made ? L2(`Đã lưu log và giao ${made} việc`, `Log saved and ${made} task${made === 1 ? '' : 's'} assigned`) : msg);
      } catch (x) { toast('Lỗi: ' + x.message); } finally { busy = false; done.disabled = close.disabled = false; }
    };
    done.onclick = () => finish('Đã lưu log họp', true); close.onclick = () => finish('Đã lưu log họp', false);
    art.replaceChildren(h('header', {}, h('h2', {}, 'Sửa log họp'), who), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('label', { class: 'field' }, 'Ngày họp', date), h('label', { class: 'field', style: 'flex:1;min-width:200px' }, 'Tiêu đề', title)),
      h('p', { class: 'muted' }, 'Thay đổi tự lưu theo từng khối. Người khác cũng mở được log này; khối ai đang gõ sẽ chỉ đọc với người còn lại.'), ed.root, h('div', { class: 'actions' }, close, done));
  } catch (x) { S.editing = null; toast('Lỗi: ' + x.message); }
}
function meetingForm(redraw) {
  const date = h('input', { type: 'date', required: true, value: new Date().toISOString().slice(0, 10) }), title = h('input', { required: true, placeholder: 'Họp tuần 12' });
  const save = h('button', { class: 'btn primary', type: 'submit' }, 'Lưu log họp'); let busy = false;
  const refresh = () => {
    const n = ed.read().filter((b) => b.type === 'task' && !b.task_id && !blankTask(b)).length;
    save.textContent = n ? L2(`Lưu log và giao ${n} việc`, `Save log and assign ${n} task${n === 1 ? '' : 's'}`) : tr('Lưu log họp');
  };
  const ed = blockEditor({ onChange: refresh, onFile: (f) => { if (!title.value) title.value = f.name.replace(/\.[^.]+$/, ''); } });
  const loadTpl = () => tplText().then((t) => ed.setBlocks(mdToBlocks(t)));   // mẫu hiện sẵn dạng khối
  loadTpl();
  return h('form', { class: 'meeting', 'data-drop': '', onsubmit: async (e) => {
    e.preventDefault(); if (busy) return;
    const all = ed.read().filter((b) => !blankTask(b)), { ok, good } = validateTasks(ed, all);
    if (!ok) return toast(L2('Có thẻ giao việc chưa hợp lệ, xem chữ đỏ trong thẻ.', 'Some task cards are not valid, see the red text in the cards.'));
    busy = true; save.disabled = true; const made = [], ttl = title.value.trim();
    try {
      const mid = crypto.randomUUID();
      good.forEach((g) => { g.description = L2(`Giao từ log họp: ${ttl}`, `Assigned from meeting log: ${ttl}`); });
      if (good.length) { await assignTasks(good); made.push(...good.map((g) => g.id)); good.forEach((g) => { all.find((b) => b.id === g.blockId).task_id = g.id; }); }
      let r = await sb.from('meetings').insert({ id: mid, held_on: date.value, title: ttl, body_md: blocksToMd(all), author: S.me.id, blocks_ready: true });
      if (!r.error) r = await sb.from('meeting_blocks').insert(all.map((b, i) => ({ id: b.id, meeting_id: mid, pos: i + 1, type: b.type, content: b.content, task_id: b.task_id, updated_by: S.me.id })));
      if (r.error) { await sb.from('meetings').delete().eq('id', mid); throw r.error; }   // blocks xoá theo (cascade)
      title.value = ''; loadTpl(); await loadAll(); redraw();
      toast(good.length ? L2(`Đã lưu log và giao ${good.length} việc`, `Log saved and ${good.length} task${good.length === 1 ? '' : 's'} assigned`) : 'Đã lưu log họp');
    } catch (x) { if (made.length) await sb.from('tasks').delete().in('id', made); toast('Lỗi: ' + x.message); }   // bù trừ: không để việc mồ côi
    finally { busy = false; save.disabled = false; }
  } }, h('h2', {}, 'Thêm log họp'), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, h('label', { class: 'field' }, 'Ngày họp', date), h('label', { class: 'field', style: 'flex:1;min-width:200px' }, 'Tiêu đề', title)),
    h('div', { class: 'field' }, h('span', {}, 'Nội dung'), ed.root), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, save));
}

/* ---------- hướng dẫn, mẫu ---------- */
async function renderGuide() {
  const v = $('#view'), docs = [['huong-dan-thanh-vien', 'Dành cho thành viên'], ...(isAdmin() ? [['huong-dan-admin', 'Dành cho admin']] : [])];
  const out = h('article', { class: 'prose' }), pick = async (f) => { out.innerHTML = md(await (await fetch(`docs/${f}${LANG === 'en' ? '.en' : ''}.md`)).text()); };
  v.replaceChildren(head('Hướng dẫn', docs.map(([f, l]) => h('button', { class: 'btn', onclick: () => pick(f) }, l))), out); pick(docs[isAdmin() ? 1 : 0][0]);
}
async function renderTemplates() {
  const view = $('#view'), text = await tplText(), out = h('article', { class: 'prose', html: md(text) });
  if (S.view !== 'templates') return;
  view.replaceChildren(head('Tải mẫu'), h('div', { class: 'tpl' }, h('h2', { style: 'font-size:18px' }, 'Mẫu log họp (Markdown)'),
    h('p', { class: 'muted' }, 'Mẫu này đã hiện sẵn trong ô "Thêm log họp". Bảng ở mục "Việc giao" có thể chuyển thành việc bằng nút "Tạo việc từ mục Việc giao".'),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      h('button', { class: 'btn primary', onclick: () => navigator.clipboard.writeText(text).then(() => toast('Đã sao chép mẫu')) }, 'Sao chép mẫu'),
      h('a', { class: 'btn', href: tplFile(), download: '', style: 'text-decoration:none' }, 'Tải về')), out),
    h('p', { class: 'muted', style: 'margin-top:12px' }, 'Cần nhập việc từ file? ', h('a', { href: 'templates/mau-phan-cong.csv', download: '' }, 'Tải mẫu CSV')));
}

/* ---------- sự kiện (admin): gom việc, hoàn thành sự kiện -> Apps Script xuất log vào Drive ---------- */
function celebrate() {
  const m = modal(null);
  m.box.replaceChildren(STK(4, 'sticker big'), h('h2', {}, 'Sự kiện đã hoàn thành!'), h('p', { class: 'muted' }, 'Cảm ơn cả đội. Log sẽ được lưu vào Drive của Niffler.'), h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: m.close }, 'Tuyệt vời')));
}
function renderProjects() {
  const name = h('input', { required: true, maxlength: '100', placeholder: 'Ví dụ: Chung kết Hugo Cup' });
  const stat = (p) => { const ts = S.tasks.filter((t) => t.project_id === p.id); return { n: ts.length, done: ts.filter((t) => t.status === 'done').length }; };
  const row = (p) => {
    const { n, done } = stat(p);
    const act = p.closed_at
      ? (p.drive_url ? h('a', { href: p.drive_url, target: '_blank', rel: 'noopener' }, 'Mở log trong Drive') : h('span', { class: 'muted' }, 'Đang tạo log trong Drive (tối đa ~1 giờ)…'))
      : h('button', { class: 'btn', onclick: async (e) => {
        if (done < n) return toast(`Còn ${n - done} việc chưa Hoàn thành. Hoàn thành hết rồi mới đóng sự kiện được.`);
        if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = tr('Bấm lần nữa để hoàn thành sự kiện'); return; }
        const { error } = await sb.from('projects').update({ closed_at: new Date().toISOString() }).eq('id', p.id);
        if (error) return toast(error.message); await loadAll(); renderProjects(); celebrate();
      } }, 'Hoàn thành sự kiện');
    const del = h('button', { class: 'btn', style: 'margin-left:8px', onclick: async (e) => {
      if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = tr(`Bấm lần nữa để xoá sự kiện${n ? ` và ${n} việc` : ''}`); return; }
      const r1 = await sb.from('tasks').delete().eq('project_id', p.id); if (r1.error) return toast(r1.error.message);
      const r2 = await sb.from('projects').delete().eq('id', p.id); if (r2.error) return toast(r2.error.message);
      await loadAll(); renderProjects(); toast('Đã xoá sự kiện' + (p.drive_url ? '. Log trong Drive vẫn được giữ.' : ''));
    } }, 'Xoá');
    return h('tr', {}, h('td', {}, p.name), h('td', {}, `${done}/${n} việc xong`), h('td', {}, p.closed_at ? 'Đã hoàn thành ' + fmt(p.closed_at) : 'Đang chạy'), h('td', {}, act, del));
  };
  const rows = [...S.projects].sort((a, b) => !!a.closed_at - !!b.closed_at || a.name.localeCompare(b.name, 'vi'));
  $('#view').replaceChildren(head('Sự kiện'),
    h('form', { class: 'meeting', onsubmit: async (e) => { e.preventDefault(); try { await ensureProject(name.value); } catch (x) { return toast(x.message); } name.value = ''; await loadAll(); renderProjects(); } },
      h('h2', {}, 'Thêm sự kiện'), h('label', { class: 'field' }, 'Tên sự kiện', name), h('button', { class: 'btn primary', type: 'submit' }, 'Thêm')),
    rows.length ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Sự kiện', 'Tiến độ', 'Trạng thái', ''].map((x) => h('th', {}, x)))), h('tbody', {}, rows.map(row))))
      : h('div', {}, STK(15), h('p', { class: 'muted' }, 'Chưa có sự kiện. Thêm ở trên, hoặc gõ tên sự kiện khi giao việc / thêm cột event vào file CSV.')));
}

/* ---------- thành viên (admin) ---------- */
function renderMembers() {
  const email = h('input', { type: 'email', required: true, placeholder: 'ten@gmail.com' }), name = h('input', { placeholder: 'Để trống: người đó tự đặt tên' }), role = h('select', {}, h('option', { value: 'member' }, roleLabel('member')), isSuper() && h('option', { value: 'admin' }, 'Admin'));
  const roleCell = (p) => !isSuper() || p.email.toLowerCase() === SUPER ? roleLabel(p.role)
    : h('select', { 'aria-label': 'Vai trò của ' + p.name, onchange: async (e) => { const { error } = await sb.from('profiles').update({ role: e.target.value }).eq('id', p.id); toast(error ? error.message : 'Đã đổi vai trò'); await loadAll(); renderMembers(); } },
      h('option', { value: 'member', selected: p.role === 'member' }, roleLabel('member')), h('option', { value: 'admin', selected: p.role === 'admin' }, 'Admin'));
  $('#view').replaceChildren(head('Thành viên'),
    h('form', { class: 'meeting', onsubmit: async (e) => { e.preventDefault(); const { error } = await sb.from('profiles').insert({ email: email.value.trim().toLowerCase(), name: name.value.trim(), role: role.value }); if (error) return toast(error.message); await loadAll(); renderMembers(); } },
      h('h2', {}, 'Thêm người vào CLB'), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px' }, h('label', { class: 'field' }, 'Email Google', email), h('label', { class: 'field' }, 'Họ tên (không bắt buộc)', name), h('label', { class: 'field' }, 'Vai trò', role)),
      h('button', { class: 'btn primary', type: 'submit' }, 'Thêm')),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Họ tên', 'Email', 'Vai trò', 'Đã đăng nhập', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, S.profiles.map((p) => h('tr', {}, h('td', {}, p.named ? p.name : '(chưa đặt tên)'), h('td', {}, p.email), h('td', {}, roleCell(p)), h('td', {}, p.auth_id ? 'Rồi' : 'Chưa'),
        h('td', {}, h('button', { class: 'btn', style: 'margin-right:6px', onclick: () => nameDialog(false, p) }, 'Đổi tên'), p.id !== S.me.id && h('button', { class: 'btn', onclick: async (e) => { if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = tr('Bấm lần nữa để xoá (xoá cả việc của họ)'); return; } const { error } = await sb.from('profiles').delete().eq('id', p.id); if (error) return toast(error.message); await loadAll(); renderMembers(); } }, 'Xoá'))))))));
}

boot();
