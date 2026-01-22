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
      .channel("photos-feed")
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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "photos",
          filter: `wedding_event_id=eq.${eventId}`,
        },
        (payload) => {
          const deletedPhoto = payload.old as Photo;
          setPhotos((prev) => prev.filter((p) => p.id !== deletedPhoto.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "photos",
          filter: `wedding_event_id=eq.${eventId}`,
        },
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
      toast({
        title: "Failed to update caption",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Caption updated",
      });
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
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("wedding-photos")
        .remove([photoToDelete.image_url]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue anyway - the photo record will still be deleted
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", deletePhotoId);

      if (dbError) throw dbError;

      // Restore photo credit to guest
      const { data: guestData, error: guestFetchError } = await supabase
        .from("guests")
        .select("photos_remaining")
        .eq("id", currentGuestId)
        .single();

      if (!guestFetchError && guestData) {
        const newRemaining = Math.min(guestData.photos_remaining + 1, 10);
        await supabase
          .from("guests")
          .update({ photos_remaining: newRemaining })
          .eq("id", currentGuestId);
      }

      toast({
        title: "Photo deleted",
        description: "Your photo credit has been restored.",
      });

      onPhotoDeleted?.();
    } catch (error: any) {
      toast({
        title: "Failed to delete photo",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setDeleting(false);
    setDeletePhotoId(null);
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
        className="flex-1 swipe-container hide-scrollbar"
      >
        {photos.map((photo, index) => {
          const isOwner = currentGuestId && photo.guest_id === currentGuestId;
          const isEditing = editingPhotoId === photo.id;

          return (
            <div
              key={photo.id}
              className="swipe-item min-h-screen flex items-center justify-center px-0 py-2"
            >
              <div className="relative w-full h-[calc(100vh-120px)] max-w-lg mx-auto">
                {photo.signedUrl ? (
                  <img
                    src={photo.signedUrl}
                    alt={photo.guest_name ? `Photo by ${photo.guest_name}` : "Wedding photo"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                
                {/* Gradient overlay for text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                
                {/* Photo info and caption */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-6">
                  {/* Guest name and time */}
                  <div className="flex items-center gap-2 mb-2">
                    {photo.guest_name && (
                      <p className="text-white font-semibold">
                        {photo.guest_name}
                      </p>
                    )}
                    <span className="text-white/60 text-sm">
                      · {formatDistanceToNow(new Date(photo.captured_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {/* Caption or edit mode */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editCaption}
                        onChange={(e) => {
                          if (e.target.value.length <= MAX_CAPTION_LENGTH) {
                            setEditCaption(e.target.value);
                          }
                        }}
                        placeholder="Add a caption..."
                        className="bg-black/50 border-white/20 text-white placeholder:text-white/50 resize-none"
                        rows={2}
                        disabled={saving}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">
                          {editCaption.length}/{MAX_CAPTION_LENGTH}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingPhotoId(null);
                              setEditCaption("");
                            }}
                            disabled={saving}
                            className="text-white hover:bg-white/20"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveCaption}
                            disabled={saving}
                            className="bg-primary text-primary-foreground"
                          >
                            {saving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    photo.caption && (
                      <p className="text-white/90 text-sm leading-relaxed">
                        {photo.caption}
                      </p>
                    )
                  )}
                </div>

                {/* Owner actions */}
                {isOwner && !isEditing && (
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditCaption(photo)}
                      className="bg-black/30 hover:bg-black/50 text-white h-9 w-9"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletePhotoId(photo.id)}
                      className="bg-black/30 hover:bg-destructive/80 text-white h-9 w-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Photo number indicator */}
                <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-white text-sm">
                    {index + 1} / {photos.length}
                  </span>
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