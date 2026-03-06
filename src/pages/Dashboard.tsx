import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, QrCode, Image, Users, Download, LogOut, Calendar, Heart, Leaf, Play, Loader2, Pencil, Check, X, Trash2 } from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import PhotoGrid from "@/components/PhotoGrid";
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

interface WeddingEvent {
  id: string;
  couple_name: string;
  partner_name: string;
  wedding_date: string;
  event_code: string;
  cover_image_url: string | null;
}

interface GuestStats {
  total_guests: number;
  total_photos: number;
}

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [weddingEvent, setWeddingEvent] = useState<WeddingEvent | null>(null);
  const [guestStats, setGuestStats] = useState<GuestStats>({ total_guests: 0, total_photos: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [coupleName, setCoupleName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  // Edit date state
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchWeddingEvent();
    }
  }, [user]);

  const fetchWeddingEvent = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("wedding_events")
      .select("*")
      .eq("couple_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching wedding event:", error);
    } else if (data) {
      setWeddingEvent(data);
      fetchGuestStats(data.id);
    }
    setLoading(false);
  };

  const fetchGuestStats = async (eventId: string) => {
    const [guestsResult, photosResult] = await Promise.all([
      supabase.from("guests").select("id", { count: "exact" }).eq("wedding_event_id", eventId),
      supabase.from("photos").select("id", { count: "exact" }).eq("wedding_event_id", eventId),
    ]);

    setGuestStats({
      total_guests: guestsResult.count || 0,
      total_photos: photosResult.count || 0,
    });
  };

  const generateEventCode = () => {
    const names = `${coupleName.substring(0, 3)}${partnerName.substring(0, 3)}`.toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${names}-${random}`;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const eventCode = generateEventCode();

    const { data, error } = await supabase
      .from("wedding_events")
      .insert({
        couple_user_id: user.id,
        couple_name: coupleName,
        partner_name: partnerName,
        wedding_date: weddingDate,
        event_code: eventCode,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setWeddingEvent(data);
      setShowCreateForm(false);
      toast({
        title: "Wedding created!",
        description: "Your wedding photo experience is ready.",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleViewFeed = () => {
    navigate(`/feed/${weddingEvent?.event_code}`);
  };

  const handleEditDate = () => {
    if (weddingEvent) {
      setNewDate(weddingEvent.wedding_date);
      setEditingDate(true);
    }
  };

  const handleSaveDate = async () => {
    if (!weddingEvent || !newDate) return;
    const { error } = await supabase
      .from("wedding_events")
      .update({ wedding_date: newDate })
      .eq("id", weddingEvent.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setWeddingEvent({ ...weddingEvent, wedding_date: newDate });
      toast({ title: "Date updated!" });
    }
    setEditingDate(false);
  };

  const handleDeleteEvent = async () => {
    if (!weddingEvent) return;
    setDeletingEvent(true);

    try {
      // Delete all photos from storage
      const { data: photos } = await supabase
        .from("photos")
        .select("image_url")
        .eq("wedding_event_id", weddingEvent.id);

      if (photos && photos.length > 0) {
        await supabase.storage
          .from("wedding-photos")
          .remove(photos.map((p) => p.image_url));
      }

      // Delete photos records
      await supabase.from("photos").delete().eq("wedding_event_id", weddingEvent.id);

      // Delete guests
      await supabase.from("guests").delete().eq("wedding_event_id", weddingEvent.id);

      // Delete event
      const { error } = await supabase
        .from("wedding_events")
        .delete()
        .eq("id", weddingEvent.id);

      if (error) throw error;

      setWeddingEvent(null);
      setGuestStats({ total_guests: 0, total_photos: 0 });
      toast({ title: "Event deleted", description: "Your wedding event has been removed." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingEvent(false);
      setShowDeleteEvent(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);

    try {
      // Delete event data first if exists
      if (weddingEvent) {
        await handleDeleteEvent();
      }

      // Sign out (account deletion requires admin API, so we sign out and inform user)
      await signOut();
      toast({
        title: "Signed out",
        description: "Your event data has been deleted. Contact support to fully remove your account.",
      });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccount(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!weddingEvent) return;
    
    setDownloading(true);
    try {
      const { data: photos, error } = await supabase
        .from("photos")
        .select("image_url, guest_name, captured_at")
        .eq("wedding_event_id", weddingEvent.id);

      if (error) throw error;
      if (!photos || photos.length === 0) {
        toast({
          title: "No photos",
          description: "There are no photos to download yet.",
        });
        setDownloading(false);
        return;
      }

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const path = photo.image_url;
        
        const { data: signedData, error: signedError } = await supabase.storage
          .from("wedding-photos")
          .createSignedUrl(path, 60);

        if (signedError || !signedData) {
          console.error("Error getting signed URL:", signedError);
          continue;
        }

        const response = await fetch(signedData.signedUrl);
        const blob = await response.blob();
        
        const extension = path.split('.').pop() || 'jpg';
        const guestName = photo.guest_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'guest';
        const timestamp = new Date(photo.captured_at).getTime();
        const filename = `${guestName}_${timestamp}.${extension}`;
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        if (i < photos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast({
        title: "Download complete",
        description: `Downloaded ${photos.length} photos.`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "There was an error downloading photos.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Leaf className="w-12 h-12 text-primary animate-pulse-soft" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!weddingEvent && !showCreateForm) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto pt-12 animate-fade-in">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Leaf className="w-16 h-16 text-primary" />
                <Heart className="w-8 h-8 text-secondary absolute -bottom-1 -right-2" />
              </div>
            </div>
            <h1 className="font-display text-4xl text-foreground mb-2">Create Your Wedding</h1>
            <p className="text-muted-foreground">Set up your photo sharing experience</p>
          </div>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <Button
                onClick={() => setShowCreateForm(true)}
                className="w-full gradient-sage text-primary-foreground h-14 text-lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Wedding Event
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="text-sm text-destructive/70 hover:text-destructive transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>

        <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all your event data and sign you out. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto pt-8 animate-slide-up">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Wedding Details</CardTitle>
              <CardDescription>Tell us about your special day</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="coupleName">Your Name</Label>
                  <Input
                    id="coupleName"
                    placeholder="Sarah"
                    value={coupleName}
                    onChange={(e) => setCoupleName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerName">Partner's Name</Label>
                  <Input
                    id="partnerName"
                    placeholder="James"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weddingDate">Wedding Date</Label>
                  <Input
                    id="weddingDate"
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 gradient-sage text-primary-foreground">
                    Create Wedding
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showQRCode && weddingEvent) {
    return (
      <QRCodeDisplay
        eventCode={weddingEvent.event_code}
        coupleName={weddingEvent.couple_name}
        partnerName={weddingEvent.partner_name}
        onClose={() => setShowQRCode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Leaf className="w-8 h-8 text-primary" />
            <div>
              <h1 className="font-display text-xl">
                {weddingEvent.couple_name} & {weddingEvent.partner_name}
              </h1>
              {editingDate ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-8 text-sm w-40 bg-background"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSaveDate}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingDate(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={handleEditDate}>
                  <Calendar className="w-3 h-3" />
                  {(() => {
                    const [year, month, day] = weddingEvent.wedding_date.split('-').map(Number);
                    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });
                  })()}
                  <Pencil className="w-3 h-3 text-primary" />
                </button>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-3xl font-display">{guestStats.total_guests}</p>
              <p className="text-sm text-muted-foreground">Guests</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <Image className="w-8 h-8 text-secondary mx-auto mb-2" />
              <p className="text-3xl font-display">{guestStats.total_photos}</p>
              <p className="text-sm text-muted-foreground">Photos</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Button
            onClick={() => setShowQRCode(true)}
            className="h-16 gradient-sage text-primary-foreground flex-col gap-1"
          >
            <QrCode className="h-5 w-5" />
            <span className="text-xs">Share QR</span>
          </Button>
          <Button
            onClick={handleViewFeed}
            variant="outline"
            className="h-16 border-primary text-primary hover:bg-primary/10 flex-col gap-1"
          >
            <Play className="h-5 w-5" />
            <span className="text-xs">View Feed</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 border-secondary text-secondary hover:bg-secondary/10 flex-col gap-1"
            onClick={handleDownloadAll}
            disabled={downloading || guestStats.total_photos === 0}
          >
            {downloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            <span className="text-xs">{downloading ? "Downloading..." : "Download"}</span>
          </Button>
        </div>

        {/* Event Code */}
        <Card className="glass-card animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Event Code</p>
                <p className="text-2xl font-mono font-semibold tracking-wider text-primary">
                  {weddingEvent.event_code}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(weddingEvent.event_code);
                  toast({
                    title: "Copied!",
                    description: "Event code copied to clipboard.",
                  });
                }}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <h2 className="font-display text-2xl mb-4">Shared Memories</h2>
          <PhotoGrid eventId={weddingEvent.id} />
        </div>

        {/* Danger Zone */}
        <div className="pt-4 pb-8 space-y-3 animate-slide-up" style={{ animationDelay: "0.4s" }}>
          <h2 className="font-display text-lg text-muted-foreground">Settings</h2>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-start border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteEvent(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Wedding Event
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteAccount(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </div>
      </main>

      {/* Delete Event Dialog */}
      <AlertDialog open={showDeleteEvent} onOpenChange={setShowDeleteEvent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this wedding event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your event, all guest data, and all {guestStats.total_photos} photos. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingEvent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deletingEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your event data, photos, and sign you out. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
