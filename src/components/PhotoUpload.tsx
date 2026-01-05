import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { X, Camera, Upload, Check, Loader2 } from "lucide-react";

interface PhotoUploadProps {
  guestId: string;
  eventId: string;
  photosRemaining: number;
  guestName: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PhotoUpload = ({
  guestId,
  eventId,
  photosRemaining,
  guestName,
  onClose,
  onSuccess,
}: PhotoUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setShowConfirm(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      // Upload to storage
      const fileName = `${eventId}/${guestId}/${Date.now()}-${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("wedding-photos")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("wedding-photos")
        .getPublicUrl(fileName);

      // Save photo record
      const { error: photoError } = await supabase.from("photos").insert({
        wedding_event_id: eventId,
        guest_id: guestId,
        image_url: urlData.publicUrl,
        guest_name: guestName,
      });

      if (photoError) throw photoError;

      // Update guest's photo count and unlock feed
      const { error: updateError } = await supabase
        .from("guests")
        .update({
          photos_remaining: photosRemaining - 1,
          has_unlocked_feed: true,
        })
        .eq("id", guestId);

      if (updateError) throw updateError;

      toast({
        title: "Moment captured!",
        description: `${photosRemaining - 1} photos remaining.`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  if (showConfirm && preview) {
    return (
      <div className="min-h-screen bg-background flex flex-col animate-fade-in">
        <header className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onClose} disabled={uploading}>
            <X className="w-6 h-6" />
          </Button>
          <h1 className="font-display text-lg">Confirm Photo</h1>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-xl mb-6">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-center text-muted-foreground mb-8 max-w-xs">
            This moment is permanent and cannot be changed. Are you ready to share it?
          </p>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setSelectedFile(null);
                setPreview(null);
              }}
              disabled={uploading}
              className="h-12 px-6"
            >
              Choose Another
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="gradient-sage text-primary-foreground h-12 px-8"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Share Moment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      <header className="p-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>
        <h1 className="font-display text-lg">Capture a Moment</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="photo-counter mb-8">
          <Camera className="w-4 h-4" />
          <span>{photosRemaining} photos remaining</span>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-20 gradient-sage text-primary-foreground text-lg rounded-2xl"
          >
            <Camera className="mr-3 h-6 w-6" />
            Take Photo
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.click();
                fileInputRef.current.setAttribute("capture", "environment");
              }
            }}
            className="w-full h-16 text-lg rounded-2xl"
          >
            <Upload className="mr-3 h-5 w-5" />
            Choose from Gallery
          </Button>
        </div>

        <p className="text-center text-muted-foreground mt-8 max-w-xs text-sm">
          Once shared, photos cannot be edited or deleted. Make it count.
        </p>
      </div>
    </div>
  );
};

export default PhotoUpload;
