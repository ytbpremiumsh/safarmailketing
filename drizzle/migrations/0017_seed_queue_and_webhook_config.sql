-- Worker config row: authentication prefers the managed QUEUE_WORKER_KEY secret,
-- the empty hash simply means the DB-stored hash path is unused.
insert into public.queue_worker_config (id, secret_hash, active, batch_size, max_attempts)
values (true, '', true, 20, 3)
on conflict (id) do update set active = true, updated_at = now();

-- Webhook config row: authentication prefers the managed MAILKETING_WEBHOOK_KEY secret.
insert into public.mailketing_webhook_config (id, secret_hash, active)
values (true, '', true)
on conflict (id) do update set active = true, updated_at = now();
