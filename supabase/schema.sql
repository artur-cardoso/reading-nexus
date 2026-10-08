create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  cover_url text,
  summary text,
  wikipedia_url text,
  wikipedia_title text,
  total_pages integer,
  current_page integer not null default 0,
  status text not null default 'future' check (status in ('reading','future','completed')),
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  notes text,
  started_at date,
  completed_at date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_status_idx on public.books(user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
before update on public.books
for each row execute procedure public.set_updated_at();

alter table public.books enable row level security;

drop policy if exists "users can view own books" on public.books;
create policy "users can view own books"
on public.books for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own books" on public.books;
create policy "users can insert own books"
on public.books for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own books" on public.books;
create policy "users can update own books"
on public.books for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own books" on public.books;
create policy "users can delete own books"
on public.books for delete
using (auth.uid() = user_id);
