-- Wedding events table (created by couples)
CREATE TABLE public.wedding_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_user_id UUID NOT NULL,
  couple_name TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  wedding_date DATE NOT NULL,
  event_code TEXT NOT NULL UNIQUE,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Guests table (people who join via code)
CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_event_id UUID NOT NULL REFERENCES public.wedding_events(id) ON DELETE CASCADE,
  guest_name TEXT,
  session_token TEXT NOT NULL UNIQUE,
  photos_remaining INTEGER NOT NULL DEFAULT 10,
  has_unlocked_feed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wedding_event_id UUID NOT NULL REFERENCES public.wedding_events(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  guest_name TEXT,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.wedding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Wedding events policies (couple can manage their own events, guests can view their event)
CREATE POLICY "Couples can manage their own events"
  ON public.wedding_events
  FOR ALL
  USING (auth.uid() = couple_user_id);

CREATE POLICY "Anyone can view events by code"
  ON public.wedding_events
  FOR SELECT
  USING (true);

-- Guests policies
CREATE POLICY "Anyone can create a guest session"
  ON public.guests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Guests can view their own session"
  ON public.guests
  FOR SELECT
  USING (true);

CREATE POLICY "Guests can update their own session"
  ON public.guests
  FOR UPDATE
  USING (true);

-- Photos policies
CREATE POLICY "Guests can upload photos"
  ON public.photos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view photos from their wedding"
  ON public.photos
  FOR SELECT
  USING (true);

-- Create storage bucket for wedding photos
INSERT INTO storage.buckets (id, name, public) VALUES ('wedding-photos', 'wedding-photos', true);

-- Storage policies for wedding photos
CREATE POLICY "Anyone can view wedding photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'wedding-photos');

CREATE POLICY "Anyone can upload wedding photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'wedding-photos');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_wedding_events_updated_at
  BEFORE UPDATE ON public.wedding_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for photos
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;