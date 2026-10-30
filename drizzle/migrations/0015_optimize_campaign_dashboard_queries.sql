-- Hot-path indexes for the campaign dashboard and progress views.
create index if not exists campaign_recipients_campaign_id_idx
  on public.campaign_recipients (campaign_id);

create index if not exists campaign_recipients_status_idx
  on public.campaign_recipients (status);

create index if not exists contacts_workspace_sender_idx
  on public.contacts (workspace_sender);

create index if not exists contacts_category_idx
  on public.contacts (category);
