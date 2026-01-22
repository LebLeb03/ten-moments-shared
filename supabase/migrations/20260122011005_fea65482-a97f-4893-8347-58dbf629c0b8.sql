-- Add caption column to photos table
ALTER TABLE public.photos ADD COLUMN caption TEXT;

-- Add constraint for caption length (1-150 characters when not null)
ALTER TABLE public.photos ADD CONSTRAINT photos_caption_length 
  CHECK (caption IS NULL OR (char_length(caption) >= 1 AND char_length(caption) <= 150));

-- Add RLS policy for guests to delete their own photos
CREATE POLICY "Guests can delete own photos" 
ON public.photos 
FOR DELETE 
USING (auth.uid() = guest_id);

-- Add RLS policy for guests to update their own photos (for caption editing)
CREATE POLICY "Guests can update own photos" 
ON public.photos 
FOR UPDATE 
USING (auth.uid() = guest_id)
WITH CHECK (auth.uid() = guest_id);