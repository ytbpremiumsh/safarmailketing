create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active
  )
$$;

grant execute on function private.is_active_user() to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'media',
  'media',
  true,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  public_url text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.media_assets enable row level security;

grant select, insert, delete on public.media_assets to authenticated;

drop policy if exists "media_assets_select_active" on public.media_assets;
create policy "media_assets_select_active"
on public.media_assets for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "media_assets_insert_own" on public.media_assets;
create policy "media_assets_insert_own"
on public.media_assets for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_active_user())
);

drop policy if exists "media_assets_delete_own_or_admin" on public.media_assets;
create policy "media_assets_delete_own_or_admin"
on public.media_assets for delete
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "media_upload_active" on storage.objects;
create policy "media_upload_active"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.is_active_user())
);

drop policy if exists "media_delete_own_or_admin" on storage.objects;
create policy "media_delete_own_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

create index if not exists media_assets_created_at_idx
  on public.media_assets (created_at desc);