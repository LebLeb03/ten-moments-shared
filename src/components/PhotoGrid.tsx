import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  guest_name: string | null;
  captured_at: string;
}

interface PhotoWithSignedUrl extends Photo {
  signedUrl?: string;
}

interface PhotoGridProps {
  eventId: string;
}

const PhotoGrid = ({ eventId }: PhotoGridProps) => {
  const [photos, setPhotos] = useState<PhotoWithSignedUrl[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate signed URL for a photo path
  const getSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    // Check if it's already a full URL (legacy data)
    if (path.startsWith('http')) {
      return path;
    }
    
    const { data, error } = await supabase.storage
      .from("wedding-photos")
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  }, []);

  // Fetch photos and generate signed URLs
  const fetchPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("wedding_event_id", eventId)
      .order("captured_at", { ascending: false });

    if (!error && data) {
      // Generate signed URLs for all photos
      const photosWithUrls = await Promise.all(
        data.map(async (photo) => ({
          ...photo,
          signedUrl: await getSignedUrl(photo.image_url),
        }))
      );
      setPhotos(photosWithUrls);
    }
    setLoading(false);
  }, [eventId, getSignedUrl]);

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
        async (payload) => {
          const newPhoto = payload.new as Photo;
          const signedUrl = await getSignedUrl(newPhoto.image_url);
          setPhotos((prev) => [{ ...newPhoto, signedUrl }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchPhotos, getSignedUrl]);

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
          {photo.signedUrl ? (
            <img
              src={photo.signedUrl}
              alt={photo.guest_name ? `Photo by ${photo.guest_name}` : "Wedding photo"}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
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
