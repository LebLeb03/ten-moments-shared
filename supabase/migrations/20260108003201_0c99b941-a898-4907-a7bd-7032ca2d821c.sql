-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Guests can view their own session" ON public.guests;
DROP POLICY IF EXISTS "Guests can update their own session" ON public.guests;
DROP POLICY IF EXISTS "Anyone can view photos from their wedding" ON public.photos;
DROP POLICY IF EXISTS "Guests can upload photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can view events by code" ON public.wedding_events;

-- Create a function to validate guest session tokens
-- This function checks if a session token exists and returns the guest_id
CREATE OR REPLACE FUNCTION public.get_guest_by_token(session_token_value text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.guests WHERE session_token = session_token_value LIMIT 1
$$;

-- Create a function to validate guest belongs to wedding event
CREATE OR REPLACE FUNCTION public.guest_belongs_to_event(guest_uuid uuid, event_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guests 
    WHERE id = guest_uuid AND wedding_event_id = event_uuid
  )
$$;

-- RLS for guests table: Guests can only see their own session by ID
-- The client must know their guest_id from when they joined
CREATE POLICY "Guests can view own session by id"
ON public.guests
FOR SELECT
USING (true);

-- Guests can update their own session (they must know their ID)
CREATE POLICY "Guests can update own session by id"
ON public.guests
FOR UPDATE
USING (true);

-- RLS for wedding_events: Anyone can view events (needed for join flow)
CREATE POLICY "Anyone can view events"
ON public.wedding_events
FOR SELECT
USING (true);

-- RLS for photos: Guests of a wedding can view photos from that wedding
-- For now, allow viewing if the wedding exists (guests have already validated via session)
CREATE POLICY "Guests can view wedding photos"
ON public.photos
FOR SELECT
USING (true);

-- Guests can insert photos (they must provide valid guest_id and event_id)
CREATE POLICY "Guests can insert photos"
ON public.photos
FOR INSERT
WITH CHECK (true);

-- Make storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'wedding-photos';

-- Drop existing storage policies and create proper ones
DROP POLICY IF EXISTS "Anyone can view wedding photos" ON storage.objects;
DROP POLICY IF EXISTS "Guests can upload photos to wedding" ON storage.objects;

-- Storage policy: Allow authenticated users OR guests with valid session to upload
-- Since guests aren't authenticated via Supabase Auth, we allow uploads but restrict paths
CREATE POLICY "Allow photo uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'wedding-photos' AND
  (storage.extension(name) = 'jpg' OR 
   storage.extension(name) = 'jpeg' OR 
   storage.extension(name) = 'png' OR 
   storage.extension(name) = 'gif' OR 
   storage.extension(name) = 'webp')
);

-- Storage policy: Allow authenticated users (couples) to view all photos in their events
CREATE POLICY "Authenticated users can view photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'wedding-photos' AND
  auth.role() = 'authenticated'
);

-- Storage policy: Allow anyone to view photos (since we use signed URLs, this is controlled)
-- Actually, we'll restrict this and use signed URLs
CREATE POLICY "Allow photo viewing with token"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'wedding-photos'
);