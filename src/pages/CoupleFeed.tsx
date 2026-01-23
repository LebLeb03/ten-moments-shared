import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Leaf, Image as ImageIcon, ChevronUp } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  guest_name: string | null;
  captured_at: string;
}

interface PhotoWithSignedUrl extends Photo {
  signedUrl?: string;
}

interface WeddingEvent {
  id: string;
  couple_name: string;
  partner_name: string;
  couple_user_id: string;
}

const CoupleFeed = () => {
  const { eventCode } = useParams<{ eventCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const [weddingEvent, setWeddingEvent] = useState<WeddingEvent | null>(null);
  const [photos, setPhotos] = useState<PhotoWithSignedUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  // Generate signed URL for a photo path
  const getSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    if (path.startsWith('http')) {
      return path;
    }
    
    const { data, error } = await supabase.storage
      .from("wedding-photos")
      .createSignedUrl(path, 3600);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  }, []);

  useEffect(() => {
    const fetchEventAndPhotos = async () => {
      if (!eventCode) {
        navigate("/dashboard");
        return;
      }

      // Fetch the wedding event
      const { data: event, error: eventError } = await supabase
        .from("wedding_events")
        .select("*")
        .eq("event_code", eventCode)
        .maybeSingle();

      if (eventError || !event) {
        navigate("/dashboard");
        return;
      }

      // Verify the logged-in user owns this event
      if (!authLoading && user && event.couple_user_id !== user.id) {
        navigate("/dashboard");
        return;
      }

      setWeddingEvent(event);

      // Fetch photos for this event
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("wedding_event_id", event.id)
        .order("captured_at", { ascending: false });

      if (!photosError && photosData) {
        const photosWithUrls = await Promise.all(
          photosData.map(async (photo) => ({
            ...photo,
            signedUrl: await getSignedUrl(photo.image_url),
          }))
        );
        setPhotos(photosWithUrls);
      }
      
      setLoading(false);
    };

    if (!authLoading) {
      if (!user) {
        navigate("/auth");
      } else {
        fetchEventAndPhotos();
      }
    }
  }, [eventCode, user, authLoading, navigate, getSignedUrl]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!weddingEvent) return;

    const channel = supabase
      .channel("couple-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `wedding_event_id=eq.${weddingEvent.id}`,
        },
        async (payload) => {
          const newPhoto = payload.new as Photo;
          const signedUrl = await getSignedUrl(newPhoto.image_url);
          setPhotos((prev) => [{ ...newPhoto, signedUrl }, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "photos",
          filter: `wedding_event_id=eq.${weddingEvent.id}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weddingEvent, getSignedUrl]);

  const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv)$/i.test(url);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Leaf className="w-12 h-12 text-primary animate-pulse-soft" />
          <p className="text-muted-foreground">Loading feed...</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-background via-background/80 to-transparent p-4 pb-8">
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary" />
              <span className="font-display text-sm">
                {weddingEvent?.couple_name} & {weddingEvent?.partner_name}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center font-display text-xl">
            No photos yet
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Guests will start sharing moments soon
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-background via-background/80 to-transparent p-4 pb-8">
        <div className="flex items-center gap-4 max-w-md mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-display text-sm">
              {weddingEvent?.couple_name} & {weddingEvent?.partner_name}
            </span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {photos.length} moments
          </div>
        </div>
      </header>

      {/* Swipe Feed */}
      <div className="snap-y snap-mandatory h-screen overflow-y-scroll scrollbar-hide pt-16">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="snap-start h-screen w-full flex items-center justify-center relative bg-black/5"
          >
            {photo.signedUrl ? (
              isVideo(photo.image_url) ? (
                <video
                  src={photo.signedUrl}
                  className="max-h-full max-w-full object-contain"
                  controls
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={photo.signedUrl}
                  alt={photo.caption || "Wedding moment"}
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              </div>
            )}

            {/* Caption & Credit Overlay */}
            <div className="absolute bottom-24 left-0 right-0 p-6 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
              {photo.caption && (
                <p className="text-white text-lg mb-2">{photo.caption}</p>
              )}
              {photo.guest_name && (
                <p className="text-white/70 text-sm">by {photo.guest_name}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Swipe hint */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none animate-float">
        <div className="flex flex-col items-center text-muted-foreground/50">
          <ChevronUp className="w-5 h-5" />
          <span className="text-xs">Swipe up</span>
        </div>
      </div>
    </div>
  );
};

export default CoupleFeed;
