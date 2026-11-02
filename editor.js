/* Trình soạn log họp kiểu Notion: các khối contenteditable, lệnh "/", thẻ giao việc, gợi ý tên.
   Dùng các hàm/biến của app.js (S, h, tr, toast, pmap, parseDeadline, toLocalInput, openDrawer...) lúc chạy, không lúc nạp. */
const L2 = (vi, en) => (LANG === 'en' ? en : vi);                      // chuỗi riêng của trình soạn, không qua từ điển
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const uid = () => crypto.randomUUID();
const dmy = (iso) => new Date(iso).toLocaleDateString('en-GB');          // dd/mm/yyyy
const TASK_HEAD = /^(việc giao|tasks? assigned|action items)\b/i;
const TEXT_TYPES = ['h1', 'h2', 'p', 'li'], isHead = (t) => t === 'h1' || t === 'h2';

/* ---------- chuyển đổi nội dung ---------- */
const inlineToHtml = (t) => DOMPurify.sanitize(marked.parseInline(t || ''), { ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'br'] });
function htmlToInline(el) {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += n.textContent; return; }
    if (n.nodeType !== 1) return;
    const inner = htmlToInline(n), t = n.tagName, mk = /^(B|STRONG)$/.test(t) ? '**' : /^(I|EM)$/.test(t) ? '*' : '';
    if (mk && inner.trim()) { const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/); out += m[1] + mk + m[2] + mk + m[3]; } else out += t === 'BR' ? ' ' : inner;
  });
  return out.replace(/ /g, ' ');
}
// Khối -> Markdown (body_md để thành viên đọc, tìm kiếm). Các thẻ giao việc liên tiếp thành một bảng.
function blocksToMd(blocks) {
  const pm = pmap(), out = [], cell = (x) => String(x || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim(); let i = 0;
  while (i < blocks.length) {
    const b = blocks[i], t = (b.content?.t || '').trim();
    if (b.type === 'task') {
      const rows = []; while (i < blocks.length && blocks[i].type === 'task') rows.push(blocks[i++]);
      const used = rows.filter((r) => r.content.title || r.content.who || r.content.whoText);
      if (used.length) out.push(`| ${L2('Ai', 'Who')} | ${L2('Việc', 'Task')} | ${L2('Hạn', 'Deadline')} | ${L2('Sự kiện', 'Event')} |\n|---|---|---|---|\n` +
        used.map((r) => `| ${cell(pm[r.content.who]?.name || r.content.whoText)} | ${cell(r.content.title)} | ${r.content.deadline ? dmy(r.content.deadline) : ''} | ${cell(r.content.event)} |`).join('\n'));
      continue;
    }
    if (b.type === 'li') { const li = []; while (i < blocks.length && blocks[i].type === 'li') { const x = (blocks[i++].content?.t || '').trim(); if (x) li.push('- ' + x); } if (li.length) out.push(li.join('\n')); continue; }
    i++; if (!t) continue;
    out.push(b.type === 'h1' ? '# ' + t : b.type === 'h2' ? '## ' + t : t);
  }
  return out.join('\n\n') + '\n';
}
// Markdown -> khối (nạp mẫu / file .md, và chuyển log cũ). Bảng dưới "Việc giao" / "Tasks assigned" thành thẻ giao việc.
function mdToBlocks(mdText) {
  const out = [], byKey = {}; let inTasks = false, rowNo = 0;
  S.profiles.forEach((p) => { byKey[fold(p.email)] = p; byKey[fold(p.name)] = p; });
  for (const raw of String(mdText).replace(/\r/g, '').split('\n')) {
    const ln = raw.replace(/\s+$/, ''); if (!ln.trim()) continue; let m;
    if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { inTasks = TASK_HEAD.test(m[2].trim()); rowNo = 0; out.push({ id: uid(), type: m[1].length === 1 ? 'h1' : 'h2', content: { t: m[2].trim() } }); continue; }
    if (inTasks && ln.trim().startsWith('|')) {
      const c = ln.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim()); rowNo++;
      if (rowNo === 1 || c.every((x) => /^:?-{2,}:?$/.test(x))) continue;     // dòng tiêu đề cột + dòng phân cách
      const p = byKey[fold(c[0])], d = c[2] ? parseDeadline(c[2]) : null, title = c[1] || '';
      const made = p && S.tasks.find((t) => t.assignee === p.id && t.title.toLowerCase() === title.toLowerCase());
      out.push({ id: uid(), type: 'task', task_id: made?.id || null, content: { who: p?.id || '', whoText: p ? '' : c[0], title, deadline: d ? d.toISOString() : '', event: c[3] || '' } });
      continue;
    }
    if ((m = ln.match(/^\s*[-*](?:\s+(.*))?$/))) { out.push({ id: uid(), type: 'li', content: { t: (m[1] || '').trim() } }); continue; }
    out.push({ id: uid(), type: 'p', content: { t: ln.trim() } });
  }
  return out.length ? out : [{ id: uid(), type: 'p', content: {} }];
}

/* ---------- trình soạn ---------- */
function blockEditor(opts = {}) {
  const doc = h('div', { class: 'ed-doc', 'data-drop': '' }), menu = h('div', { class: 'slashmenu', role: 'listbox', hidden: true });
  let last = null, items = [], idx = 0, pick = null, composing = false;
  const ls = [], change = () => { opts.onChange?.(); ls.forEach((f) => f()); };
  const PH = () => ({ h1: L2('Tiêu đề', 'Title'), h2: L2('Tiêu đề mục', 'Heading'), p: L2('Gõ nội dung, hoặc gõ / để chọn lệnh', 'Type here, or / for commands'), li: L2('Mục', 'Item') });
  const blocks = () => [...doc.children];
  const isText = (el) => el && TEXT_TYPES.includes(el.dataset.type);

  /* --- khối --- */
  function setType(el, type) { el.dataset.type = type; el.className = `blk blk-${type}`; el.dataset.ph = PH()[type]; }
  function makeBlock(b) {
    if (b.type === 'task') return makeTask(b);
    const el = h('div', { class: `blk blk-${b.type}`, 'data-id': b.id || uid(), 'data-type': b.type, contenteditable: 'true', 'data-ph': PH()[b.type], role: 'textbox', 'aria-multiline': 'true' });
    if (b.pos != null) el.dataset.pos = b.pos;
    el.innerHTML = inlineToHtml(b.content?.t); return el;
  }
  function makeTask(b) {
    const c = b.content || {}, done = !!b.task_id, lst = 'evl-' + uid().slice(0, 8);
    const who = h('input', { class: 'tk-who', autocomplete: 'off', 'aria-label': 'Người nhận', placeholder: 'Người nhận', value: c.who ? pmap()[c.who]?.name || c.whoText || '' : c.whoText || '' });
    who.dataset.pid = c.who || '';
    const title = h('input', { class: 'tk-title', maxlength: '200', 'aria-label': 'Việc', placeholder: 'Việc cần làm', value: c.title || '' });
    const dl = h('input', { class: 'tk-dl', type: 'datetime-local', 'aria-label': 'Hạn chót', value: c.deadline ? toLocalInput(c.deadline) : toLocalInput(new Date(Date.now() + 7 * 864e5).setHours(23, 59)) });
    const ev = h('input', { class: 'tk-ev', list: lst, maxlength: '100', 'aria-label': 'Sự kiện', placeholder: 'Sự kiện', value: c.event || '' });
    const err = h('div', { class: 'tk-err', role: 'alert' });
    const el = h('div', { class: 'blk blk-task' + (done ? ' done' : ''), 'data-id': b.id || uid(), 'data-type': 'task', contenteditable: 'false' },
      h('datalist', { id: lst }, S.projects.filter((x) => !x.closed_at).map((x) => h('option', { value: x.name }))),
      h('div', { class: 'tk-grid' },
        h('label', {}, h('span', {}, 'Người nhận'), who), h('label', {}, h('span', {}, 'Việc'), title), h('label', {}, h('span', {}, 'Hạn chót'), dl), h('label', {}, h('span', {}, 'Sự kiện'), ev),
        h('div', { class: 'tk-side' }, done ? [h('span', { class: 'chip' }, L2('Đã giao', 'Assigned')), h('button', { class: 'btn', type: 'button', onclick: () => openDrawer(b.task_id) }, L2('Mở việc', 'Open task'))] : null,
          h('button', { class: 'btn', type: 'button', 'aria-label': 'Xoá thẻ', onclick: () => { el.remove(); ensureOne(); change(); } }, '×'))), err);
    if (b.task_id) el.dataset.taskId = b.task_id;
    if (done) [who, title, dl, ev].forEach((i) => { i.disabled = true; });
    who.addEventListener('input', () => { who.dataset.pid = ''; suggestWho(who); change(); });
    who.addEventListener('focus', () => suggestWho(who));
    who.addEventListener('blur', () => { setTimeout(closeMenu, 120); if (!who.dataset.pid) who.dataset.pid = resolveName(who.value); });
    [title, dl, ev].forEach((i) => i.addEventListener('input', change));
    if (b.pos != null) el.dataset.pos = b.pos;
    return el;
  }
  const resolveName = (txt) => { const k = fold(txt).trim(); if (!k) return ''; const m = S.profiles.filter((p) => fold(p.name) === k || fold(p.email) === k); return m.length === 1 ? m[0].id : ''; };
  function readTask(el) {
    const who = el.querySelector('.tk-who'), pid = who.dataset.pid || resolveName(who.value), dl = el.querySelector('.tk-dl').value;
    return { who: pid, whoText: pid ? '' : who.value.trim(), title: el.querySelector('.tk-title').value.trim(), deadline: dl ? new Date(dl).toISOString() : '', event: el.querySelector('.tk-ev').value.trim() };
  }
  function readBlock(el) {
    const type = el.dataset.type, id = el.dataset.id;
    return type === 'task' ? { id, type, content: readTask(el), task_id: el.dataset.taskId || null } : { id, type, content: { t: htmlToInline(el).trim() }, task_id: null };
  }
  const read = () => blocks().map(readBlock);
  function ensureOne() { if (!doc.children.length) doc.append(makeBlock({ id: uid(), type: 'p', content: {} })); }
  function setBlocks(list) { doc.replaceChildren(...list.map(makeBlock)); ensureOne(); closeMenu(); change(); }

  /* --- con trỏ --- */
  function place(el, atEnd = true) {
    if (!el) return; const inp = el.querySelector?.('.tk-who'); if (el.dataset.type === 'task') { (inp || el).focus(); return; }
    el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  const caret = () => { const s = getSelection(); return s.rangeCount && s.isCollapsed ? s.getRangeAt(0) : null; };
  function atEdge(el, end) {
    const r = caret(); if (!r || !el.contains(r.startContainer)) return false;
    const x = document.createRange(); x.selectNodeContents(el); end ? x.setStart(r.endContainer, r.endOffset) : x.setEnd(r.startContainer, r.startOffset);
    return x.toString() === '';
  }
  function caretRect(el) {
    const r = caret(); let rect = r && r.getClientRects()[0];
    if (!rect) { rect = (r?.startContainer?.nodeType === 1 ? r.startContainer : el).getBoundingClientRect(); }
    return rect;
  }

  /* --- menu nổi (lệnh "/" và gợi ý tên) --- */
  function openMenu(list, rect, onPick) {
    items = list; idx = 0; pick = onPick;
    if (!list.length) return closeMenu();
    menu.replaceChildren(...list.map((it, i) => h('button', { type: 'button', role: 'option', class: i === 0 ? 'on' : '', onmousedown: (e) => { e.preventDefault(); pick?.(it); closeMenu(); } },
      h('b', {}, it.label), it.hint ? h('span', {}, it.hint) : null)));
    menu.hidden = false; menu.style.left = Math.min(rect.left, innerWidth - 300) + 'px';
    const hh = menu.offsetHeight; menu.style.top = (rect.bottom + hh + 12 > innerHeight && rect.top > hh + 12 ? rect.top - hh - 4 : rect.bottom + 4) + 'px';
  }
  function closeMenu() { menu.hidden = true; items = []; pick = null; }
  function moveMenu(d) { idx = (idx + d + items.length) % items.length; [...menu.children].forEach((c, i) => c.classList.toggle('on', i === idx)); menu.children[idx]?.scrollIntoView({ block: 'nearest' }); }
  window.addEventListener('scroll', () => { if (!menu.hidden) closeMenu(); }, true);

  function suggestWho(inp) {
    const q = fold(inp.value).trim(), list = S.profiles.filter((p) => !q || fold(p.name).includes(q) || fold(p.email).includes(q));
    const dupe = (p) => S.profiles.filter((x) => fold(x.name) === fold(p.name)).length > 1;
    openMenu(list.slice(0, 8).map((p) => ({ label: p.name, hint: dupe(p) || !p.named ? p.email : '', p })), inp.getBoundingClientRect(), (it) => {
      inp.value = it.p.name; inp.dataset.pid = it.p.id; change(); inp.closest('.blk').querySelector('.tk-title').focus();
    });
  }

  /* --- lệnh "/" --- */
  const SECT = {
    decision: [/quyết định|decisions?/i, () => L2('Quyết định', 'Decisions')],
    carry: [/việc tồn|carried over/i, () => L2('Việc tồn từ tuần trước', 'Carried over from last week')],
    note: [/ghi chú|other notes/i, () => L2('Ghi chú khác', 'Other notes')],
  };
  function sectionBullet(key, cur) {
    const [re, name] = SECT[key];
    let bl = blocks(), hi = bl.findIndex((b) => isHead(b.dataset.type) && re.test(b.textContent));
    if (hi < 0) { const els = replaceWith(cur, [{ id: uid(), type: 'h2', content: { t: name() } }, { id: uid(), type: 'li', content: {} }]); place(els[1]); return; }
    cur.remove(); bl = blocks(); hi = bl.findIndex((b) => isHead(b.dataset.type) && re.test(b.textContent));
    let end = hi + 1; while (end < bl.length && !isHead(bl[end].dataset.type)) end++;
    const lastB = bl[end - 1];
    if (lastB.dataset.type === 'li' && !lastB.textContent.trim()) { place(lastB); return; }
    const [li] = insertAfter(lastB, [{ id: uid(), type: 'li', content: {} }]); place(li);
  }
  function replaceWith(cur, list) { const els = list.map(makeBlock); cur.replaceWith(...els); ensureOne(); return els; }
  function insertAfter(ref, list) { const els = list.map(makeBlock); ref.after(...els); return els; }
  const CMDS = () => [
    { k: 'task', label: '/task', hint: L2('Giao việc: lưu log là tự tạo việc', 'Assign a task: saving the log creates it'), run: (cur) => { const els = replaceWith(cur, [{ id: uid(), type: 'task', content: {} }]); if (!els[0].nextElementSibling) els[0].after(makeBlock({ id: uid(), type: 'p', content: {} })); place(els[0]); } },
    { k: 'decision', label: '/decision', hint: L2('Thêm vào mục Quyết định', 'Add to Decisions'), run: (cur) => sectionBullet('decision', cur) },
    { k: 'carry', label: '/carry', hint: L2('Thêm vào mục Việc tồn', 'Add to Carried over'), run: (cur) => sectionBullet('carry', cur) },
    { k: 'note', label: '/note', hint: L2('Thêm vào mục Ghi chú', 'Add to Other notes'), run: (cur) => sectionBullet('note', cur) },
    { k: 'h', label: '/h', hint: L2('Tiêu đề mục', 'Heading'), run: (cur) => { cur.innerHTML = ''; setType(cur, 'h2'); place(cur); } },
    { k: 'present', label: '/present', hint: L2('Có mặt / Vắng', 'Present / Absent'), run: (cur) => { const els = replaceWith(cur, [{ id: uid(), type: 'p', content: { t: L2('**Có mặt:** ', '**Present:** ') } }, { id: uid(), type: 'p', content: { t: L2('**Vắng:** ', '**Absent:** ') } }]); place(els[0]); } },
    { k: 'date', label: '/date', hint: L2('Ngày hôm nay', 'Today\'s date'), run: (cur) => { cur.textContent = dmy(Date.now()); place(cur); } },
  ];
  function slashCheck(el) {
    const txt = el.textContent;
    if (!/^\/[a-z]*$/i.test(txt)) return closeMenu();
    const q = txt.slice(1).toLowerCase(), list = CMDS().filter((c) => c.k.startsWith(q));
    openMenu(list, caretRect(el), (c) => { el.innerHTML = ''; c.run(el); change(); });
  }

  /* --- sự kiện bàn phím / nhập --- */
  function enter(el, e) {
    e.preventDefault(); const type = el.dataset.type;
    if (type === 'li' && !el.textContent.trim()) { setType(el, 'p'); change(); return; }
    const r = caret(); const nb = makeBlock({ id: uid(), type: type === 'li' ? 'li' : 'p', content: {} });
    if (r) { const tail = document.createRange(); tail.setStart(r.endContainer, r.endOffset); tail.setEnd(el, el.childNodes.length); nb.append(tail.extractContents()); }
    if (!el.textContent) el.innerHTML = ''; if (!nb.textContent) nb.innerHTML = '';
    el.after(nb); place(nb, false); change();
  }
  function backspace(el, e) {
    if (!caret() || !atEdge(el, false)) return; const type = el.dataset.type, prev = el.previousElementSibling;
    if (type === 'li' || (isHead(type) && el.textContent)) { e.preventDefault(); setType(el, 'p'); change(); return; }
    if (!el.textContent && doc.children.length > 1) { e.preventDefault(); el.remove(); if (prev) place(prev); change(); return; }
    if (prev && isText(prev)) { e.preventDefault(); const n = prev.childNodes.length; prev.append(...el.childNodes); el.remove(); const r = document.createRange(); r.setStart(prev, n); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); change(); }
  }
  doc.addEventListener('keydown', (e) => {
    const el = e.target.closest('.blk'); if (!el || e.isComposing || composing) return;
    if (!menu.hidden && items.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Escape') closeMenu(); else if (e.key === 'ArrowDown') moveMenu(1); else if (e.key === 'ArrowUp') moveMenu(-1);
      else { const it = items[idx], p = pick; closeMenu(); p?.(it); }
      return;
    }
    if (el.dataset.type === 'task' || !isText(el)) return;
    if (e.key === 'Enter' && !e.shiftKey) enter(el, e);
    else if (e.key === 'Backspace') backspace(el, e);
    else if (e.key === 'ArrowUp' && atEdge(el, false) && el.previousElementSibling) { e.preventDefault(); place(el.previousElementSibling); }
    else if (e.key === 'ArrowDown' && atEdge(el, true) && el.nextElementSibling) { e.preventDefault(); place(el.nextElementSibling, false); }
  });
  doc.addEventListener('compositionstart', () => { composing = true; });
  doc.addEventListener('compositionend', (e) => { composing = false; const el = e.target.closest?.('.blk'); if (el && isText(el)) slashCheck(el); change(); });
  doc.addEventListener('input', (e) => {
    const el = e.target.closest('.blk'); if (!el || !isText(el)) return;
    if (!el.textContent) el.innerHTML = '';                         // để :empty hiện gợi ý
    if (!composing && !e.isComposing) slashCheck(el);
    change();
  });
  doc.addEventListener('focusin', (e) => { const el = e.target.closest('.blk'); if (el) last = el; if (el && !el.matches('.blk-task') && menu.hidden === false && !isText(el)) closeMenu(); });
  doc.addEventListener('focusout', (e) => { if (!doc.contains(e.relatedTarget)) setTimeout(() => { if (!doc.contains(document.activeElement)) closeMenu(); }, 100); });
  doc.addEventListener('paste', (e) => {
    const el = e.target.closest('.blk'); if (!el || !isText(el)) return;
    e.preventDefault(); const lines = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '').split('\n'), t = el.dataset.type === 'li' ? 'li' : 'p';
    document.execCommand('insertText', false, lines[0]); let ref = el;
    lines.slice(1).filter((l) => l.trim()).forEach((l) => { const nb = makeBlock({ id: uid(), type: t, content: { t: l.trim() } }); ref.after(nb); ref = nb; });
    change();
  });
  doc.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  doc.addEventListener('drop', async (e) => {
    const f = e.dataTransfer.files[0]; if (!f) return; e.preventDefault();
    if (!/\.(md|txt)$/i.test(f.name)) return toast('Chỉ nhận file .md hoặc .txt');
    setBlocks(mdToBlocks(await f.text())); opts.onFile?.(f);
  });

  /* --- thanh công cụ --- */
  const cur = () => (last && doc.contains(last) ? last : doc.lastElementChild);
  const tb = (label, title, fn, cls = '') => h('button', { type: 'button', class: 'btn ' + cls, title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
  const toggle = (type) => { const el = cur(); if (!isText(el)) return; setType(el, el.dataset.type === type ? 'p' : type); place(el); change(); };
  const bar = h('div', { class: 'ed-bar', role: 'toolbar', 'aria-label': 'Định dạng' },
    tb('B', L2('In đậm (Ctrl+B)', 'Bold (Ctrl+B)'), () => document.execCommand('bold'), 'b'), tb('I', L2('In nghiêng (Ctrl+I)', 'Italic (Ctrl+I)'), () => document.execCommand('italic'), 'i'),
    tb('H', L2('Tiêu đề mục', 'Heading'), () => toggle('h2')), tb('•', L2('Gạch đầu dòng', 'Bullet'), () => toggle('li')),
    tb(L2('+ Giao việc', '+ Assign task'), L2('Chèn thẻ giao việc (hoặc gõ /task)', 'Insert a task card (or type /task)'), () => {
      const el = cur(); const emptyText = isText(el) && !el.textContent.trim();
      const [t] = emptyText ? replaceWith(el, [{ id: uid(), type: 'task', content: {} }]) : insertAfter(el, [{ id: uid(), type: 'task', content: {} }]);
      if (!t.nextElementSibling) t.after(makeBlock({ id: uid(), type: 'p', content: {} })); place(t); change();
    }, 'hot'));
  // khoá mềm: khối người khác đang sửa chỉ đọc, kèm nhãn tên
  function setLock(id, lock) {
    const el = doc.querySelector(`[data-id="${id}"]`); if (!el) return;
    el.classList.toggle('locked', !!lock); el.inert = !!lock;
    if (lock) el.dataset.locktext = `${lock.name} ${L2('đang sửa', 'is editing')}`; else delete el.dataset.locktext;
  }
  // áp thay đổi từ người khác (realtime) vào đúng khối; khối mình đang gõ thì không bị ghi đè
  const remote = {
    upsert(row, force) {
      const el = doc.querySelector(`[data-id="${row.id}"]`);
      if (!el) { const nb = makeBlock(row), before = blocks().filter((c) => +c.dataset.pos < row.pos).pop(); before ? before.after(nb) : doc.prepend(nb); opts.onChange?.(); return; }
      el.dataset.pos = row.pos;
      const same = JSON.stringify(readBlock(el).content) === JSON.stringify(row.content) && (el.dataset.taskId || null) === (row.task_id || null) && el.dataset.type === row.type;
      if (same || (!force && el.contains(document.activeElement))) return;
      if (row.type === 'task' || el.dataset.type === 'task') el.replaceWith(makeBlock(row)); else { setType(el, row.type); el.innerHTML = inlineToHtml(row.content?.t); }
      opts.onChange?.();
    },
    remove(id) { doc.querySelector(`[data-id="${id}"]`)?.remove(); ensureOne(); opts.onChange?.(); },
  };
  const pruneBlankTasks = () => { blocks().filter((el) => el.dataset.type === 'task' && !el.dataset.taskId && !readTask(el).who && !readTask(el).whoText && !readTask(el).title).forEach((el) => el.remove()); ensureOne(); };
  const root = h('div', { class: 'ed' }, bar, doc, menu);
  ensureOne();
  return {
    root, doc, read, setBlocks, setLock, remote, pruneBlankTasks, on: (f) => ls.push(f), focus: () => place(doc.firstElementChild, false),
    mark: (id, msg) => { const el = doc.querySelector(`[data-id="${id}"]`); if (!el) return; el.classList.toggle('bad', !!msg); const e = el.querySelector('.tk-err'); if (e) e.textContent = msg || ''; },
  };
}


/* ---------- đồng bộ nhiều người cùng soạn (theo khối) ---------- */
const TOKEN = uid();   // mỗi tab một mã: hai tab cùng tài khoản cũng thấy khoá của nhau
function syncEditor(ed, meetingId, rows, onPresence) {
  const known = new Map(rows.map((r) => [r.id, { type: r.type, c: JSON.stringify(r.content), pos: r.pos, u: r.updated_at }])), locks = new Map();
  let timer = null, flushing = null, dirty = false, lockedEl = null, stopped = false;
  const pres = () => onPresence?.([...new Set([...locks.values()].filter((l) => l.until > Date.now()).map((l) => l.name))]);
  const rpc = (fn, a) => sb.rpc(fn, a);

  async function flush() {
    clearTimeout(timer);
    if (flushing) { dirty = true; return flushing; }
    flushing = (async () => {
      do {
        dirty = false;
        const els = [...ed.doc.children], cur = ed.read(), ins = [], upd = [];
        for (let i = 0; i < els.length; i++) if (!els[i].dataset.pos) {            // khối mới: vị trí nằm giữa hai khối kề
          const a = i ? +els[i - 1].dataset.pos : 0; let j = i + 1; while (j < els.length && !els[j].dataset.pos) j++;
          els[i].dataset.pos = (a + (j < els.length ? +els[j].dataset.pos : a + 2)) / 2;
        }
        const ids = new Set(cur.map((b) => b.id));
        cur.forEach((b, i) => {
          const c = JSON.stringify(b.content), k = known.get(b.id), pos = +els[i].dataset.pos;
          if (!k) ins.push({ id: b.id, meeting_id: meetingId, pos, type: b.type, content: b.content, task_id: b.task_id, updated_by: S.me.id, _c: c });
          else if (k.type !== b.type || k.c !== c) upd.push({ b, c, pos });
        });
        const del = [...known.keys()].filter((id) => !ids.has(id));
        if (ins.length) {
          const { data, error } = await sb.from('meeting_blocks').insert(ins.map(({ _c, ...r }) => r)).select('id,updated_at'); if (error) throw error;
          const up = Object.fromEntries((data || []).map((d) => [d.id, d.updated_at]));
          ins.forEach((r) => known.set(r.id, { type: r.type, c: r._c, pos: r.pos, u: up[r.id] }));
          const ae = document.activeElement?.closest?.('.blk');                      // đang đứng trong khối vừa lưu: giữ khoá cho nó
          if (ae && ins.some((r) => r.id === ae.dataset.id)) { lockedEl = ae; await rpc('lock_block', { p_id: ae.dataset.id, p_token: TOKEN }); }
        }
        for (const u of upd) {
          // chỉ ghi nếu bản trên DB vẫn là bản mình biết; nếu người khác đã sửa khối này thì lấy bản của họ, không ghi đè im lặng
          const k = known.get(u.b.id);
          const { data, error } = await sb.from('meeting_blocks').update({ type: u.b.type, content: u.b.content, updated_by: S.me.id, updated_at: new Date().toISOString() }).eq('id', u.b.id).eq('updated_at', k.u).select('updated_at');
          if (error) throw error;
          if (data?.length) { known.set(u.b.id, { type: u.b.type, c: u.c, pos: u.pos, u: data[0].updated_at }); continue; }
          const { data: row } = await sb.from('meeting_blocks').select('*').eq('id', u.b.id).maybeSingle();
          if (row) { ed.remote.upsert(row, true); known.set(row.id, { type: row.type, c: JSON.stringify(row.content), pos: row.pos, u: row.updated_at }); } else { ed.remote.remove(u.b.id); known.delete(u.b.id); }
          toast(L2('Một khối vừa được người khác sửa, đã lấy bản mới của họ.', 'A block was just changed by someone else; their version was loaded.'));
        }
        if (del.length) { const { error } = await sb.from('meeting_blocks').delete().in('id', del); if (error) throw error; del.forEach((id) => known.delete(id)); }
      } while (dirty);
    })().catch((e) => toast('Lỗi lưu: ' + e.message)).finally(() => { flushing = null; });
    return flushing;
  }
  const schedule = () => { if (stopped) return; clearTimeout(timer); timer = setTimeout(flush, 500); };
  ed.on(schedule);

  // nhận thay đổi của người khác
  const ch = sb.channel('mb-' + meetingId + '-' + TOKEN.slice(0, 8)).on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_blocks', filter: `meeting_id=eq.${meetingId}` }, (p) => {
    if (stopped) return;
    if (p.eventType === 'DELETE') { const id = p.old.id; known.delete(id); locks.delete(id); ed.remote.remove(id); pres(); return; }
    const r = p.new, mine = r.lock_token === TOKEN, live = r.lock_token && !mine && new Date(r.lock_until) > new Date();
    if (live) locks.set(r.id, { name: pmap()[r.lock_by]?.name || '?', until: +new Date(r.lock_until) }); else locks.delete(r.id);
    ed.remote.upsert(r); known.set(r.id, { type: r.type, c: JSON.stringify(r.content), pos: r.pos, u: r.updated_at });
    ed.setLock(r.id, live ? locks.get(r.id) : null); pres();
  }).subscribe();

  // khoá mềm: lấy khoá khi vào khối, gia hạn 15 giây/lần, nhả khi rời khối
  async function release() { if (!lockedEl) return; const id = lockedEl.dataset.id; lockedEl = null; if (known.has(id)) await rpc('unlock_block', { p_id: id, p_token: TOKEN }); }
  ed.doc.addEventListener('focusin', async (e) => {
    const el = e.target.closest('.blk'); if (!el || el === lockedEl || stopped) return;
    await release(); if (!known.has(el.dataset.id)) { lockedEl = el; return; }       // khối mới chưa lưu: của mình
    const { data, error } = await rpc('lock_block', { p_id: el.dataset.id, p_token: TOKEN });
    if (!error && data === true) lockedEl = el;
    else if (!error) { ed.setLock(el.dataset.id, locks.get(el.dataset.id) || { name: '?' }); toast(L2('Khối này đang được người khác sửa.', 'Someone else is editing this block.')); }
  });
  ed.doc.addEventListener('focusout', (e) => { if (!ed.doc.contains(e.relatedTarget)) setTimeout(() => { if (!ed.doc.contains(document.activeElement)) release(); }, 400); });
  const hb = setInterval(async () => { if (lockedEl && known.has(lockedEl.dataset.id)) { const r = await rpc('lock_block', { p_id: lockedEl.dataset.id, p_token: TOKEN }); if (r.data === false) lockedEl = null; } }, 15000);
  const sweep = setInterval(() => { locks.forEach((l, id) => { if (l.until <= Date.now()) { locks.delete(id); ed.setLock(id, null); } }); pres(); }, 4000);

  return {
    flush,
    async stop() { stopped = true; clearInterval(hb); clearInterval(sweep); await flush(); await release(); sb.removeChannel(ch); },
  };
}
