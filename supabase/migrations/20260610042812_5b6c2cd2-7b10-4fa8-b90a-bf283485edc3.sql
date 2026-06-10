
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

GRANT SELECT ON public.conversations TO anon;

DROP POLICY IF EXISTS "public shared conversations readable" ON public.conversations;
CREATE POLICY "public shared conversations readable"
  ON public.conversations
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND share_id IS NOT NULL);
