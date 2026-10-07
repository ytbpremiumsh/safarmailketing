-- Contact writes and imports use workspace_sender,email as their conflict key.
-- Keep existing contact IDs, campaign references, and authorization policies.
begin;

alter table public.contacts
  add column if not exists workspace_sender text not null default 'admin@safariman.id',
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists registration_code text,
  add column if not exists full_name text;

update public.contacts
set workspace_sender = coalesce(nullif(lower(trim(workspace_sender)), ''), 'admin@safariman.id'),
    email = lower(trim(email)),
    custom_fields = coalesce(custom_fields, '{}'::jsonb)
where workspace_sender is distinct from coalesce(nullif(lower(trim(workspace_sender)), ''), 'admin@safariman.id')
   or email is distinct from lower(trim(email))
   or custom_fields is null;

alter table public.contacts
  alter column workspace_sender set default 'admin@safariman.id',
  alter column workspace_sender set not null,
  alter column custom_fields set default '{}'::jsonb,
  alter column custom_fields set not null;

-- Fail without deleting or merging contacts when existing rows need review.
do $$
begin
  if exists (
    select 1 from public.contacts group by workspace_sender, email having count(*) > 1
  ) then
    raise exception 'Duplicate contacts in the same workspace: review them before applying contact_workspace_storage';
  end if;
end $$;

-- Allow the same email in separate sender workspaces. Replace only uniqueness
-- on the email column itself; preserve primary keys and all other constraints.
do $$
declare
  item record;
  email_attnum smallint;
begin
  select attnum into email_attnum from pg_attribute
  where attrelid = 'public.contacts'::regclass and attname = 'email';
  for item in
    select conname from pg_constraint
    where conrelid = 'public.contacts'::regclass and contype = 'u'
      and conkey = array[email_attnum]::smallint[]
  loop
    execute format('alter table public.contacts drop constraint %I', item.conname);
  end loop;
  for item in
    select i.indexrelid::regclass as index_name
    from pg_index i
    where i.indrelid = 'public.contacts'::regclass and i.indisunique
      and not i.indisprimary and i.indnkeyatts = 1
      and i.indkey[0] = email_attnum and i.indexprs is null
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
  loop
    execute format('drop index %s', item.index_name);
  end loop;
end $$;

create unique index if not exists contacts_workspace_sender_email_key
  on public.contacts(workspace_sender, email);

notify pgrst, 'reload schema';
commit;
