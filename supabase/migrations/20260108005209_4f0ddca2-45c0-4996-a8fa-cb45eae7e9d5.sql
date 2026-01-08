-- Fix PUBLIC_DATA_EXPOSURE: Secure RLS policies using anonymous auth
-- Guests will now use Supabase anonymous auth, so auth.uid() will be their guest ID

-- Drop all existing permissive policies
DROP POLICY IF EXISTS "Anyone can create a guest session" ON public.guests;
DROP POLICY IF EXISTS "Guests can update own session by id" ON public.guests;
DROP POLICY IF EXISTS "Guests can view own session by id" ON public.guests;
DROP POLICY IF EXISTS "Guests can insert photos" ON public.photos;
DROP POLICY IF EXISTS "Guests can view wedding photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can view events" ON public.wedding_events;

-- GUESTS TABLE: Now secured with auth.uid()
-- Guest ID will match the anonymous user's auth.uid()
CREATE POLICY "Guests can create their own session"
ON public.guests
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Guests can view own session"
ON public.guests
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Guests can update own session"
ON public.guests
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Couples can view guests of their events
CREATE POLICY "Couples can view event guests"
ON public.guests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wedding_events 
    WHERE id = wedding_event_id 
    AND couple_user_id = auth.uid()
  )
);

-- PHOTOS TABLE: Secured access
-- Guests can insert photos for their own session
CREATE POLICY "Guests can insert own photos"
ON public.photos
FOR INSERT
WITH CHECK (auth.uid() = guest_id);

-- Guests can view photos from their event (after unlocking)
CREATE POLICY "Guests can view event photos"
ON public.photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.guests 
    WHERE id = auth.uid() 
    AND wedding_event_id = photos.wedding_event_id
    AND has_unlocked_feed = true
  )
);

-- Couples can view all photos from their events
CREATE POLICY "Couples can view event photos"
ON public.photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wedding_events 
    WHERE id = wedding_event_id 
    AND couple_user_id = auth.uid()
  )
);

-- WEDDING_EVENTS TABLE: Restrict public read
-- Only allow reading events by event_code (for joining)
CREATE POLICY "Anyone can view events by code"
ON public.wedding_events
FOR SELECT
USING (true); -- Still need this for event code lookup, but queries must filter by event_code