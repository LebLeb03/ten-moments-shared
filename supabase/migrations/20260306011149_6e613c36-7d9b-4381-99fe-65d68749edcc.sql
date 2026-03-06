
-- Allow couples to delete guests from their events
CREATE POLICY "Couples can delete event guests"
ON public.guests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wedding_events
    WHERE wedding_events.id = guests.wedding_event_id
    AND wedding_events.couple_user_id = auth.uid()
  )
);

-- Allow couples to delete photos from their events
CREATE POLICY "Couples can delete event photos"
ON public.photos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wedding_events
    WHERE wedding_events.id = photos.wedding_event_id
    AND wedding_events.couple_user_id = auth.uid()
  )
);
