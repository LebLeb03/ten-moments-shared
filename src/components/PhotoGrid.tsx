import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  guest_name: string | null;
  captured_at: string;
}

interface PhotoGridProps {
  eventId: string;
}

const PhotoGrid = ({ eventId }: PhotoGridProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("photos-grid")
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
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-muted rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/50 rounded-2xl">
        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No photos yet</p>
        <p className="text-sm text-muted-foreground">
          Guests will start sharing soon
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="aspect-square rounded-lg overflow-hidden relative group"
        >
          <img
            src={photo.image_url}
            alt={photo.guest_name ? `Photo by ${photo.guest_name}` : "Wedding photo"}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          {photo.guest_name && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs truncate">{photo.guest_name}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PhotoGrid;
