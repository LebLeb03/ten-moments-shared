import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Image as ImageIcon, Trash2, Edit2, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Photo {
  id: string;
  image_url: string;
  guest_name: string | null;
  guest_id: string;
  captured_at: string;
  caption: string | null;
}

interface PhotoWithSignedUrl extends Photo {
  signedUrl?: string;
  loaded?: boolean;
}

interface PhotoSwipeFeedProps {
  eventId: string;
  currentGuestId?: string;
  onPhotoDeleted?: () => void;
}

const PhotoSwipeFeed = ({ eventId, currentGuestId, onPhotoDeleted }: PhotoSwipeFeedProps) => {
  const [photos, setPhotos] = useState<PhotoWithSignedUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const MAX_CAPTION_LENGTH = 150;

  const getSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    if (path.startsWith('http')) return path;
    
    const { data, error } = await supabase.storage
      .from("wedding-photos")
      .createSignedUrl(path, 3600);
    
    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  }, []);

  const fetchPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("wedding_event_id", eventId)
      .order("captured_at", { ascending: false });

    if (!error && data) {
      const photosWithUrls = await Promise.all(
        data.map(async (photo) => ({
          ...photo,
          signedUrl: await getSignedUrl(photo.image_url),
          loaded: false,
        }))
      );
      setPhotos(photosWithUrls);
    }
    setLoading(false);
  }, [eventId, getSignedUrl]);

  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel("photos-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: `wedding_event_id=eq.${eventId}` },
        async (payload) => {
          const newPhoto = payload.new as Photo;
          const signedUrl = await getSignedUrl(newPhoto.image_url);
          setPhotos((prev) => [{ ...newPhoto, signedUrl, loaded: false }, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "photos", filter: `wedding_event_id=eq.${eventId}` },
        (payload) => {
          const deletedPhoto = payload.old as Photo;
          setPhotos((prev) => prev.filter((p) => p.id !== deletedPhoto.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "photos", filter: `wedding_event_id=eq.${eventId}` },
        (payload) => {
          const updatedPhoto = payload.new as Photo;
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === updatedPhoto.id ? { ...p, caption: updatedPhoto.caption } : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchPhotos, getSignedUrl]);

  const handleEditCaption = (photo: PhotoWithSignedUrl) => {
    setEditingPhotoId(photo.id);
    setEditCaption(photo.caption || "");
  };

  const handleSaveCaption = async () => {
    if (!editingPhotoId) return;
    setSaving(true);
    const trimmedCaption = editCaption.trim();
    
    const { error } = await supabase
      .from("photos")
      .update({ caption: trimmedCaption.length > 0 ? trimmedCaption : null })
      .eq("id", editingPhotoId);

    if (error) {
      toast({ title: "Failed to update caption", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Caption updated" });
    }
    
    setSaving(false);
    setEditingPhotoId(null);
    setEditCaption("");
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoId || !currentGuestId) return;
    setDeleting(true);
    const photoToDelete = photos.find((p) => p.id === deletePhotoId);
    
    if (!photoToDelete) {
      setDeleting(false);
      setDeletePhotoId(null);
      return;
    }

    try {
      await supabase.storage.from("wedding-photos").remove([photoToDelete.image_url]);
      const { error: dbError } = await supabase.from("photos").delete().eq("id", deletePhotoId);
      if (dbError) throw dbError;

      const { data: guestData, error: guestFetchError } = await supabase
        .from("guests")
        .select("photos_remaining")
        .eq("id", currentGuestId)
        .single();

      if (!guestFetchError && guestData) {
        const newRemaining = Math.min(guestData.photos_remaining + 1, 20);
        await supabase.from("guests").update({ photos_remaining: newRemaining }).eq("id", currentGuestId);
      }

      toast({ title: "Photo deleted", description: "Your photo credit has been restored." });
      onPhotoDeleted?.();
    } catch (error: any) {
      toast({ title: "Failed to delete photo", description: error.message, variant: "destructive" });
    }
    
    setDeleting(false);
    setDeletePhotoId(null);
  };

  const handleImageLoad = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, loaded: true } : p))
    );
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
    <>
      <div
        ref={containerRef}
        className="flex-1 swipe-container hide-scrollbar bg-background"
      >
        {photos.map((photo, index) => {
          const isOwner = currentGuestId && photo.guest_id === currentGuestId;
          const isEditing = editingPhotoId === photo.id;

          return (
            <div
              key={photo.id}
              className="swipe-item h-screen w-full flex flex-col items-center justify-center px-4 py-6"
            >
              {/* Framed photo card */}
              <div className="relative w-full max-w-md rounded-2xl overflow-hidden bg-card border border-border shadow-none">
                {/* Image container */}
                <div className="relative aspect-[3/4] w-full bg-muted/30">
                  {photo.signedUrl ? (
                    photo.image_url.match(/\.(mp4|mov|webm|avi|mkv)$/i) ? (
                      <video
                        src={photo.signedUrl}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        loop
                      />
                    ) : (
                      <>
                        {!photo.loaded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                          </div>
                        )}
                        <img
                          src={photo.signedUrl}
                          alt={photo.guest_name ? `Photo by ${photo.guest_name}` : "Wedding photo"}
                          className={`w-full h-full object-cover transition-opacity duration-300 ${photo.loaded ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={() => handleImageLoad(photo.id)}
                        />
                      </>
                    )
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Photo counter pill */}
                  <div className="absolute top-3 right-3 bg-foreground/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <span className="text-background text-xs font-medium">
                      {index + 1} / {photos.length}
                    </span>
                  </div>

                  {/* Owner actions */}
                  {isOwner && !isEditing && (
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditCaption(photo)}
                        className="bg-foreground/40 hover:bg-foreground/60 text-background h-9 w-9 rounded-full"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletePhotoId(photo.id)}
                        className="bg-foreground/40 hover:bg-destructive/80 text-background h-9 w-9 rounded-full"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Info section below image */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {photo.guest_name && (
                      <p className="font-semibold text-sm text-foreground">
                        {photo.guest_name}
                      </p>
                    )}
                    <span className="text-muted-foreground text-xs">
                      · {formatDistanceToNow(new Date(photo.captured_at), { addSuffix: true })}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <Textarea
                        value={editCaption}
                        onChange={(e) => {
                          if (e.target.value.length <= MAX_CAPTION_LENGTH) {
                            setEditCaption(e.target.value);
                          }
                        }}
                        placeholder="Add a caption..."
                        className="resize-none text-sm"
                        rows={2}
                        disabled={saving}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          {editCaption.length}/{MAX_CAPTION_LENGTH}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingPhotoId(null); setEditCaption(""); }}
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveCaption}
                            disabled={saving}
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    photo.caption && (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {photo.caption}
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletePhotoId} onOpenChange={() => setDeletePhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the photo from the wedding feed. Your photo credit will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhoto}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PhotoSwipeFeed;
