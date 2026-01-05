import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGuestSession } from "@/hooks/useGuestSession";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, Image as ImageIcon, Lock, ChevronUp, Leaf, Heart } from "lucide-react";
import PhotoSwipeFeed from "@/components/PhotoSwipeFeed";
import PhotoUpload from "@/components/PhotoUpload";

interface GuestData {
  id: string;
  photos_remaining: number;
  has_unlocked_feed: boolean;
  guest_name: string | null;
}

interface WeddingEvent {
  id: string;
  couple_name: string;
  partner_name: string;
  wedding_date: string;
}

const Guest = () => {
  const { guestSession, loading: sessionLoading, clearGuestSession } = useGuestSession();
  const [guestData, setGuestData] = useState<GuestData | null>(null);
  const [weddingEvent, setWeddingEvent] = useState<WeddingEvent | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionLoading && !guestSession) {
      navigate("/join");
    }
  }, [sessionLoading, guestSession, navigate]);

  useEffect(() => {
    if (guestSession) {
      fetchData();
    }
  }, [guestSession]);

  const fetchData = async () => {
    if (!guestSession) return;

    const [guestResult, eventResult] = await Promise.all([
      supabase
        .from("guests")
        .select("*")
        .eq("id", guestSession.guestId)
        .single(),
      supabase
        .from("wedding_events")
        .select("*")
        .eq("id", guestSession.weddingEventId)
        .single(),
    ]);

    if (guestResult.error || eventResult.error) {
      toast({
        title: "Session expired",
        description: "Please rejoin the wedding.",
        variant: "destructive",
      });
      clearGuestSession();
      navigate("/join");
      return;
    }

    setGuestData(guestResult.data);
    setWeddingEvent(eventResult.data);
    setLoading(false);
  };

  const handlePhotoUploaded = () => {
    fetchData();
    setShowUpload(false);
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Leaf className="w-12 h-12 text-primary animate-pulse-soft" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!guestData || !weddingEvent) return null;

  if (showUpload) {
    return (
      <PhotoUpload
        guestId={guestSession!.guestId}
        eventId={guestSession!.weddingEventId}
        photosRemaining={guestData.photos_remaining}
        guestName={guestData.guest_name}
        onClose={() => setShowUpload(false)}
        onSuccess={handlePhotoUploaded}
      />
    );
  }

  // Locked state - user hasn't uploaded yet
  if (!guestData.has_unlocked_feed) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex items-center justify-center gap-2">
            <Leaf className="w-6 h-6 text-primary" />
            <h1 className="font-display text-lg">
              {weddingEvent.couple_name} & {weddingEvent.partner_name}
            </h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
          {/* Locked Feed Preview */}
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl bg-gradient-to-br from-muted to-cream-dark overflow-hidden mb-8">
            <div className="absolute inset-0 backdrop-blur-md bg-background/30 flex flex-col items-center justify-center">
              <Lock className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center px-8 font-display text-xl">
                Share a moment to see everyone's photos
              </p>
            </div>
            {/* Blurred preview images */}
            <div className="absolute inset-0 opacity-30 blur-xl">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-sage rounded-lg rotate-3" />
              <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-terracotta rounded-lg -rotate-6" />
              <div className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-gold rounded-lg rotate-12" />
            </div>
          </div>

          {/* Photo Counter */}
          <div className="photo-counter mb-6">
            <Camera className="w-4 h-4" />
            <span>{guestData.photos_remaining} photos remaining</span>
          </div>

          {/* Capture Button */}
          <Button
            onClick={() => setShowUpload(true)}
            className="gradient-sage text-primary-foreground h-16 px-12 text-lg rounded-full shadow-lg"
            disabled={guestData.photos_remaining === 0}
          >
            <Camera className="mr-3 h-6 w-6" />
            Capture a Moment
          </Button>

          {guestData.photos_remaining === 0 && (
            <p className="text-muted-foreground mt-4 text-center">
              You've used all your photos. <br />
              Each one is now part of the story.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Unlocked state - show swipe feed
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-background via-background/80 to-transparent p-4 pb-8">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-display text-sm">
              {weddingEvent.couple_name} & {weddingEvent.partner_name}
            </span>
          </div>
          <div className="photo-counter text-xs">
            <Camera className="w-3 h-3" />
            <span>{guestData.photos_remaining}</span>
          </div>
        </div>
      </header>

      {/* Swipe Feed */}
      <PhotoSwipeFeed eventId={guestSession!.weddingEventId} />

      {/* Floating Capture Button */}
      {guestData.photos_remaining > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20">
          <Button
            onClick={() => setShowUpload(true)}
            className="gradient-sage text-primary-foreground h-14 px-8 rounded-full shadow-xl"
          >
            <Camera className="mr-2 h-5 w-5" />
            Capture ({guestData.photos_remaining})
          </Button>
        </div>
      )}

      {/* Swipe hint */}
      <div className="fixed bottom-24 left-0 right-0 flex justify-center pointer-events-none animate-float">
        <div className="flex flex-col items-center text-muted-foreground/50">
          <ChevronUp className="w-5 h-5" />
          <span className="text-xs">Swipe up</span>
        </div>
      </div>
    </div>
  );
};

export default Guest;
