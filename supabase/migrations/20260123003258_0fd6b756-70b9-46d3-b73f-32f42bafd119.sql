-- Update the default value for photos_remaining from 10 to 20
ALTER TABLE public.guests ALTER COLUMN photos_remaining SET DEFAULT 20;

-- Update existing guests who still have their initial 10 photos to 20
UPDATE public.guests SET photos_remaining = 20 WHERE photos_remaining = 10;