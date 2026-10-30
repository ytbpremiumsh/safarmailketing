-- Contact writes and imports use workspace_sender,email as their conflict key.
alter table public.contacts
  add column if not exists workspace_sender text not null default 'admin@safariman.id';

update public.contacts
set workspace_sender = coalesce(nullif(lower(trim(workspace_sender)), ''), 'admin@safariman.id'),
    email = lower(trim(email))
where workspace_sender is distinct from coalesce(nullif(lower(trim(workspace_sender)), ''), 'admin@safariman.id')
   or email is distinct from lower(trim(email));

alter table public.contacts
  alter column workspace_sender set default 'admin@safariman.id',
  alter column workspace_sender set not null;

-- Ensure the replacement unique key can be created on existing data.
do $$
begin
  if exists (
    select 1 from public.contacts group by workspace_sender, email having count(*) > 1
  ) then
    raise exception 'Duplicate contacts in the same workspace: review them before applying contact_workspace_storage';
  end if;
end
$$;

-- Allow the same email in separate sender workspaces. Replace only uniqueness
-- constraints that involve email so suppression and category keys stay intact.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.contacts'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%email%'
  loop
    execute format('alter table public.contacts drop constraint %I', constraint_name);
  end loop;
end
$$;

drop index if exists contacts_email_key;

create unique index if not exists contacts_workspace_sender_email_key
  on public.contacts (workspace_sender, lower(email));

create index if not exists contacts_workspace_sender_idx
  on public.contacts (workspace_sender);
