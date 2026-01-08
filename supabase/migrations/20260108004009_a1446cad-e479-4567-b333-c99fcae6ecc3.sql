-- Fix 1: Remove conflicting storage policy that undermines signed URL security
DROP POLICY IF EXISTS "Allow photo viewing with token" ON storage.objects;

-- Fix 2: Replace ALL policy with granular policies for wedding_events
DROP POLICY IF EXISTS "Couples can manage their own events" ON wedding_events;

CREATE POLICY "Couples can view own events" 
  ON wedding_events FOR SELECT 
  USING (auth.uid() = couple_user_id);

CREATE POLICY "Couples can create events" 
  ON wedding_events FOR INSERT 
  WITH CHECK (auth.uid() = couple_user_id);

CREATE POLICY "Couples can update own events" 
  ON wedding_events FOR UPDATE 
  USING (auth.uid() = couple_user_id)
  WITH CHECK (auth.uid() = couple_user_id);

CREATE POLICY "Couples can delete own events" 
  ON wedding_events FOR DELETE 
  USING (auth.uid() = couple_user_id);

-- Fix 3: Add comment explaining why SECURITY DEFINER functions exist
COMMENT ON FUNCTION public.get_guest_by_token IS 'Helper function for session validation. Reserved for future RLS policy use when implementing anonymous auth. Currently unused but kept for architectural planning.';
COMMENT ON FUNCTION public.guest_belongs_to_event IS 'Helper function to validate guest-event relationship. Reserved for future RLS policy use. Currently unused but kept for architectural planning.';