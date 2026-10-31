ALTER TABLE public.media_assets ADD COLUMN delivery_token uuid;
CREATE UNIQUE INDEX media_assets_delivery_token_unique ON public.media_assets(delivery_token) WHERE delivery_token IS NOT NULL;
COMMENT ON COLUMN public.media_assets.delivery_token IS 'Explicit per-asset email sharing capability; NULL assets remain private. Tokens are not listed anonymously.';
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(full_name) ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE EXECUTE ON FUNCTION private.handle_new_user() FROM PUBLIC,anon,authenticated;