-- 自分の勉強部屋：データベースの準備
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押してください（1回だけ）。

-- 書庫の中身（論文・基礎知識・まとめ資料・勉強会資料）
create table if not exists public.docs (
  collection text not null check (collection in ('papers','basics','summaries','materials')),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (collection, id)
);

-- 使ってよい人の名簿
--   viewer = 見る・検索・小テスト・チャット
--   editor = viewer ＋ 追加・編集
--   admin  = editor ＋ 名簿の管理
create table if not exists public.members (
  email      text primary key,
  role       text not null check (role in ('viewer','editor','admin')),
  name       text,
  created_at timestamptz not null default now()
);

-- ログイン中の人の役割を返す（名簿にいなければ null）
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
grant execute on function public.my_role() to authenticated;

-- メールは小文字でそろえる
create or replace function public.members_lower_email()
returns trigger language plpgsql as $$
begin new.email := lower(trim(new.email)); return new; end $$;
drop trigger if exists members_lower_email on public.members;
create trigger members_lower_email before insert or update on public.members
for each row execute function public.members_lower_email();

-- 更新日時と更新者
create or replace function public.docs_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
for each row execute function public.docs_touch();

-- 行ごとのアクセス制御
alter table public.docs    enable row level security;
alter table public.members enable row level security;

drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read   on public.docs for select to authenticated using (public.my_role() is not null);
create policy docs_insert on public.docs for insert to authenticated with check (public.my_role() in ('editor','admin'));
create policy docs_update on public.docs for update to authenticated using (public.my_role() in ('editor','admin')) with check (public.my_role() in ('editor','admin'));
create policy docs_delete on public.docs for delete to authenticated using (public.my_role() in ('editor','admin'));

drop policy if exists members_read  on public.members;
drop policy if exists members_write on public.members;
create policy members_read  on public.members for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email','')) or public.my_role() = 'admin');
create policy members_write on public.members for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 変更をほかの端末へすぐ届ける
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
