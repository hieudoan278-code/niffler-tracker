-- Niffler Tracker: chạy toàn bộ file này trong Supabase > SQL Editor (một lần).
-- Trước khi chạy: tạo bucket PRIVATE tên `files` (Storage > New bucket).
-- Sau khi chạy: thêm admin đầu tiên ở cuối file (đổi email).

create extension if not exists pgcrypto;

-- ---------- bảng ----------
create table profiles (
  id uuid primary key default gen_random_uuid(),   -- id nội bộ, khớp auth.users sau lần đăng nhập đầu
  auth_id uuid unique,                              -- auth.users.id, tự điền khi đăng nhập
  email text unique not null,
  name text not null default '',
  role text not null default 'member' check (role in ('admin','member'))
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text not null default '',
  assignee uuid not null references profiles(id) on delete cascade,
  deadline timestamptz not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  brief_path text,
  proof_path text,
  reminded boolean not null default false,
  overdue_notified boolean not null default false,
  created_at timestamptz not null default now(),
  -- chặn ở DB: không thể done nếu thiếu minh chứng
  constraint done_needs_proof check (status <> 'done' or proof_path is not null)
);
create index on tasks(assignee);
create index on tasks(deadline);

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author uuid not null references profiles(id),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  actor uuid references profiles(id),
  kind text not null,          -- created | status | deadline | assignee | proof | comment
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on task_events(task_id, created_at);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  held_on date not null,
  title text not null,
  body_md text not null default '',
  file_path text,
  author uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  title text not null
);

-- ---------- hàm tiện ích ----------
create or replace function me() returns uuid language sql stable security definer set search_path = public as
$$ select id from profiles where auth_id = auth.uid() $$;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where auth_id = auth.uid() and role = 'admin') $$;

-- Lần đăng nhập đầu: gắn auth.uid() vào dòng profiles có cùng email (chỉ khi email đã được admin thêm).
create or replace function claim_profile() returns profiles language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  update profiles set auth_id = auth.uid()
   where lower(email) = lower(auth.jwt() ->> 'email') and (auth_id is null or auth_id = auth.uid())
   returning * into p;
  return p;   -- null nếu email không nằm trong danh sách CLB
end $$;

-- ---------- lịch sử tự động + ràng buộc cột ----------
create or replace function tasks_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := me();
begin
  if tg_op = 'INSERT' then
    insert into task_events(task_id, actor, kind, detail)
      values (new.id, actor, 'created', jsonb_build_object('title', new.title, 'deadline', new.deadline));
    return new;
  end if;
  -- member chỉ được đổi status + proof_path của task mình; mọi cột khác phải giữ nguyên
  -- auth.uid() null = service key (Apps Script nhắc hạn) hoặc SQL Editor: được phép đổi cờ reminded/overdue_notified
  if auth.uid() is not null and not is_admin() then
    if old.assignee <> actor then raise exception 'Không phải việc của bạn'; end if;
    if (new.title, new.description, new.assignee, new.deadline, new.brief_path, new.reminded, new.overdue_notified, new.created_at)
       is distinct from
       (old.title, old.description, old.assignee, old.deadline, old.brief_path, old.reminded, old.overdue_notified, old.created_at) then
      raise exception 'Bạn chỉ được đổi trạng thái và minh chứng';
    end if;
  end if;
  if new.status is distinct from old.status then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.deadline is distinct from old.deadline then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'deadline', jsonb_build_object('from', old.deadline, 'to', new.deadline));
    new.reminded := false; new.overdue_notified := false;   -- dời hạn thì nhắc lại
  end if;
  if new.assignee is distinct from old.assignee then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'assignee', jsonb_build_object('from', old.assignee, 'to', new.assignee));
  end if;
  if new.proof_path is distinct from old.proof_path then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'proof', jsonb_build_object('path', new.proof_path));
  end if;
  return new;
end $$;
create trigger tasks_guard_ins after insert on tasks for each row execute function tasks_guard();
create trigger tasks_guard_upd before update on tasks for each row execute function tasks_guard();

create or replace function comment_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into task_events(task_id, actor, kind, detail) values (new.task_id, new.author, 'comment', jsonb_build_object('body', left(new.body, 140)));
  return new;
end $$;
create trigger comment_event_ins after insert on comments for each row execute function comment_event();

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table task_events enable row level security;
alter table meetings enable row level security;
alter table events enable row level security;

-- đọc: chỉ người đã được gắn profile
create policy read_profiles on profiles for select using (me() is not null);
create policy read_tasks on tasks for select using (me() is not null);
create policy read_comments on comments for select using (me() is not null);
create policy read_events_log on task_events for select using (me() is not null);
create policy read_meetings on meetings for select using (me() is not null);
create policy read_events on events for select using (me() is not null);

-- admin ghi
create policy admin_profiles on profiles for all using (is_admin()) with check (is_admin());
create policy admin_tasks_ins on tasks for insert with check (is_admin());
create policy admin_tasks_del on tasks for delete using (is_admin());
create policy admin_meetings on meetings for all using (is_admin()) with check (is_admin());
create policy admin_events on events for all using (is_admin()) with check (is_admin());

-- sửa task: admin hoặc chủ task (cột nào được đổi do trigger tasks_guard kiểm)
create policy upd_tasks on tasks for update using (is_admin() or assignee = me()) with check (is_admin() or assignee = me());

-- bình luận: ai cũng viết được dưới tên mình; không sửa/xoá (trừ admin xoá)
create policy ins_comments on comments for insert with check (author = me());
create policy del_comments on comments for delete using (is_admin());
-- task_events: không có policy ghi => chỉ trigger (security definer) ghi được.

-- ---------- Storage (bucket `files`, private) ----------
-- brief/<task_id>/<tên file>   : admin ghi
-- proof/<task_id>/<tên file>   : admin hoặc chủ task ghi
-- meeting/<tên file>           : admin ghi
create policy files_read on storage.objects for select using (bucket_id = 'files' and me() is not null);
create policy files_admin_write on storage.objects for insert with check (bucket_id = 'files' and is_admin());
create policy files_proof_write on storage.objects for insert with check (
  bucket_id = 'files' and (storage.foldername(name))[1] = 'proof'
  and exists (select 1 from tasks t where t.id::text = (storage.foldername(name))[2] and t.assignee = me())
);

-- ---------- realtime ----------
alter publication supabase_realtime add table tasks, comments, task_events, meetings, events, profiles;

-- ---------- đặt / đổi tên hiển thị (thành viên chỉ đổi được tên của chính mình) ----------
create or replace function set_my_name(n text) returns void language sql security definer set search_path = public as $$
  update profiles set name = left(trim(n), 60) where auth_id = auth.uid() and length(trim(n)) > 0
$$;
revoke all on function set_my_name(text) from public;
grant execute on function set_my_name(text) to authenticated;

-- ---------- admin đầu tiên (ĐỔI EMAIL RỒI CHẠY) ----------
-- insert into profiles(email, name, role) values ('niffler.hugo@gmail.com', 'Niffler Admin', 'admin');

-- =====================================================================
-- PHẦN 2: vai trò chỉ Niffler đổi + Sự kiện (projects).
-- Nếu đã cài phần 1 rồi: chỉ cần chạy từ dòng này trở xuống trong SQL Editor.
-- =====================================================================

-- ---------- chỉ niffler.hugo@gmail.com được đổi vai trò / thêm admin / xoá chính nó ----------
create or replace function profiles_role_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare super boolean := lower(coalesce(auth.jwt() ->> 'email', '')) = 'niffler.hugo@gmail.com';
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- SQL Editor / service key
  if tg_op = 'DELETE' then
    if lower(old.email) = 'niffler.hugo@gmail.com' then raise exception 'Không xoá được tài khoản Niffler'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and lower(old.email) = 'niffler.hugo@gmail.com' and (new.role <> 'admin' or lower(new.email) <> 'niffler.hugo@gmail.com') then
    raise exception 'Không đổi được vai trò hay email của tài khoản Niffler';
  end if;
  if not super and ((tg_op = 'INSERT' and new.role <> 'member') or (tg_op = 'UPDATE' and new.role is distinct from old.role)) then
    raise exception 'Chỉ tài khoản Niffler được đổi vai trò';
  end if;
  return new;
end $$;
create trigger profiles_role_guard_trg before insert or update or delete on profiles for each row execute function profiles_role_guard();

-- ---------- sự kiện ----------
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 100),
  closed_at timestamptz,          -- đặt khi admin bấm "Hoàn thành sự kiện"
  drive_url text,                 -- Apps Script điền sau khi tạo log trong Drive
  created_at timestamptz not null default now()
);
alter table tasks add column project_id uuid references projects(id) on delete set null;
create index on tasks(project_id);
alter table projects enable row level security;
create policy read_projects on projects for select using (me() is not null);
create policy admin_projects on projects for all using (is_admin()) with check (is_admin());
alter publication supabase_realtime add table projects;

-- member không được đổi project_id của việc mình (thêm vào danh sách cột bị khoá)
create or replace function tasks_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := me();
begin
  if tg_op = 'INSERT' then
    insert into task_events(task_id, actor, kind, detail)
      values (new.id, actor, 'created', jsonb_build_object('title', new.title, 'deadline', new.deadline));
    return new;
  end if;
  if auth.uid() is not null and not is_admin() then
    if old.assignee <> actor then raise exception 'Không phải việc của bạn'; end if;
    if (new.title, new.description, new.assignee, new.deadline, new.brief_path, new.reminded, new.overdue_notified, new.created_at, new.project_id)
       is distinct from
       (old.title, old.description, old.assignee, old.deadline, old.brief_path, old.reminded, old.overdue_notified, old.created_at, old.project_id) then
      raise exception 'Bạn chỉ được đổi trạng thái và minh chứng';
    end if;
  end if;
  if new.status is distinct from old.status then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.deadline is distinct from old.deadline then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'deadline', jsonb_build_object('from', old.deadline, 'to', new.deadline));
    new.reminded := false; new.overdue_notified := false;
  end if;
  if new.assignee is distinct from old.assignee then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'assignee', jsonb_build_object('from', old.assignee, 'to', new.assignee));
  end if;
  if new.proof_path is distinct from old.proof_path then
    insert into task_events(task_id, actor, kind, detail) values (new.id, actor, 'proof', jsonb_build_object('path', new.proof_path));
  end if;
  return new;
end $$;
