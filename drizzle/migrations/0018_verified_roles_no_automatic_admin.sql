CREATE TABLE public.user_roles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator')),
 granted_by uuid,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.user_id=_user_id AND r.role=_role AND p.active AND (_role<>'admin' OR r.verified_at IS NOT NULL)) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.handle_safar_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.profiles(id,email,full_name,role,active) VALUES(new.id,lower(trim(new.email)),nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')),''),'operator',false) ON CONFLICT(id) DO NOTHING; INSERT INTO public.user_roles(user_id,role) VALUES(new.id,'operator') ON CONFLICT(user_id) DO NOTHING; RETURN new; END $$;
REVOKE ALL ON FUNCTION public.handle_safar_signup() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_safar_signup();
CREATE OR REPLACE FUNCTION private.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.profiles(id,email,full_name,role,active) VALUES(new.id,lower(trim(new.email)),nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')),''),'operator',false) ON CONFLICT(id) DO NOTHING; INSERT INTO public.user_roles(user_id,role) VALUES(new.id,'operator') ON CONFLICT(user_id) DO NOTHING; RETURN new; END $$;
INSERT INTO public.user_roles(user_id,role) SELECT id,'operator' FROM public.profiles ON CONFLICT(user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.has_role((SELECT auth.uid()),'admin') $$;
CREATE OR REPLACE FUNCTION private.is_active_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'operator') $$;
CREATE OR REPLACE FUNCTION private.is_active_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT private.is_active_staff() $$;
COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED: display compatibility only; authorization uses public.user_roles and verified_at.';
CREATE OR REPLACE FUNCTION public.set_safar_staff_role(p_user_id uuid,p_role text,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.has_role(p_actor,'admin') THEN RAISE EXCEPTION 'Verified administrator required' USING ERRCODE='42501'; END IF; IF p_role NOT IN ('admin','operator') THEN RAISE EXCEPTION 'Invalid role'; END IF; INSERT INTO public.user_roles(user_id,role,granted_by,verified_at) VALUES(p_user_id,p_role,p_actor,now()) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,granted_by=excluded.granted_by,verified_at=excluded.verified_at; END $$;
REVOKE ALL ON FUNCTION public.set_safar_staff_role(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_safar_staff_role(uuid,text,uuid) TO service_role;