import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Photo {
  id: string;
  image_url: string;
  guest_name: string | null;
  captured_at: string;
}

interface PhotoSwipeFeedProps {
  eventId: string;
}

const PhotoSwipeFeed = ({ eventId }: PhotoSwipeFeedProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPhotos();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("photos-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `wedding_event_id=eq.${eventId}`,
        },
        (payload) => {
          setPhotos((prev) => [payload.new as Photo, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("wedding_event_id", eventId)
      .order("captured_at", { ascending: false });

    if (!error && data) {
      setPhotos(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="font-display text-2xl text-muted-foreground mb-2">
            Be the first to share
          </p>
          <p className="text-muted-foreground">
            Your photo will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 swipe-container hide-scrollbar pt-16 pb-4"
    >
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="swipe-item h-screen flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden shadow-xl animate-scale-in">
            <img
              src={photo.image_url}
              alt={photo.guest_name ? `Photo by ${photo.guest_name}` : "Wedding photo"}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient overlay for text */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            
            {/* Photo info */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {photo.guest_name && (
                <p className="text-white font-medium text-lg mb-1">
                  {photo.guest_name}
                </p>
              )}
              <p className="text-white/70 text-sm">
                {formatDistanceToNow(new Date(photo.captured_at), { addSuffix: true })}
              </p>
            </div>

            {/* Photo number indicator */}
            <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-white text-sm">
                {index + 1} / {photos.length}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PhotoSwipeFeed;
