-- Reading Nexus: private reading diary
create table if not exists public.book_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  page_number integer check (page_number is null or page_number > 0),
  created_at timestamptz not null default now()
);

create index if not exists book_entries_book_id_idx on public.book_entries(book_id);
create index if not exists book_entries_user_id_idx on public.book_entries(user_id);

alter table public.book_entries enable row level security;

drop policy if exists "users can view own diary entries" on public.book_entries;
create policy "users can view own diary entries"
on public.book_entries for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own diary entries" on public.book_entries;
create policy "users can insert own diary entries"
on public.book_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own diary entries" on public.book_entries;
create policy "users can update own diary entries"
on public.book_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own diary entries" on public.book_entries;
create policy "users can delete own diary entries"
on public.book_entries for delete
using (auth.uid() = user_id);
