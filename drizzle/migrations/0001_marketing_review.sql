CREATE TABLE public.marketing_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 design_id uuid NOT NULL,
 version_id uuid NOT NULL UNIQUE,
 submitted_by uuid NOT NULL,
 sender_email text NOT NULL,
 title text NOT NULL,
 version_number integer NOT NULL,
 png_path text NOT NULL,
 psd_path text,
 checks jsonb NOT NULL DEFAULT '[]',
 needed_by text NOT NULL DEFAULT '',
 uses text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox','approved','needs_changes','archived')),
 change_categories text[] NOT NULL DEFAULT '{}',
 notes text NOT NULL DEFAULT '',
 approved_at timestamptz,
 delete_at timestamptz,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.marketing_submissions TO authenticated;
GRANT ALL ON public.marketing_submissions TO service_role;
ALTER TABLE public.marketing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in team reads submissions" ON public.marketing_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers submit own versions" ON public.marketing_submissions FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.design_versions v WHERE v.id = version_id AND v.user_id = auth.uid() AND v.design_id = marketing_submissions.design_id));
CREATE POLICY "Signed in team reviews submissions" ON public.marketing_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.marketing_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id uuid NOT NULL REFERENCES public.marketing_submissions(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 action text NOT NULL,
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT ON public.marketing_audit_events TO authenticated;
GRANT ALL ON public.marketing_audit_events TO service_role;
ALTER TABLE public.marketing_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads audit" ON public.marketing_audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team writes own audit" ON public.marketing_audit_events FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE FUNCTION public.marketing_review_retention() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   NEW.status := 'inbox'; NEW.approved_at := NULL; NEW.delete_at := NULL;
 ELSIF NEW.status = 'approved' AND OLD.approved_at IS NULL THEN
   NEW.approved_at := now(); NEW.delete_at := NEW.approved_at + interval '30 days';
 ELSE
   NEW.approved_at := OLD.approved_at; NEW.delete_at := OLD.delete_at;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_marketing_retention BEFORE INSERT OR UPDATE ON public.marketing_submissions FOR EACH ROW EXECUTE FUNCTION public.marketing_review_retention();
CREATE POLICY "Team reads review files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'flyers' AND name LIKE 'marketing/%');
CREATE POLICY "Team uploads review files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'flyers' AND name LIKE 'marketing/' || auth.uid()::text || '/%');
CREATE POLICY "Team removes review files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'flyers' AND name LIKE 'marketing/%');
INSERT INTO public.marketing_submissions (design_id,version_id,submitted_by,sender_email,title,version_number,png_path,checks,submitted_at)
SELECT d.id,v.id,d.user_id,'',d.title,v.version_number,v.image_path,v.checks,coalesce(d.sent_at,now()) FROM public.designs d JOIN LATERAL (SELECT * FROM public.design_versions WHERE design_id=d.id ORDER BY version_number DESC LIMIT 1) v ON true WHERE d.status='sent';