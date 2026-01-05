import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGuestSession } from "@/hooks/useGuestSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Heart, Camera } from "lucide-react";

const JoinWedding = () => {
  const [eventCode, setEventCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const { saveGuestSession } = useGuestSession();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Find the wedding event
    const { data: event, error: eventError } = await supabase
      .from("wedding_events")
      .select("*")
      .eq("event_code", eventCode.toUpperCase().trim())
      .maybeSingle();

    if (eventError || !event) {
      toast({
        title: "Event not found",
        description: "Please check your event code and try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();

    // Create guest record
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .insert({
        wedding_event_id: event.id,
        guest_name: guestName.trim() || null,
        session_token: sessionToken,
      })
      .select()
      .single();

    if (guestError) {
      toast({
        title: "Error joining",
        description: guestError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Save session locally
    saveGuestSession({
      guestId: guest.id,
      weddingEventId: event.id,
      sessionToken: sessionToken,
      guestName: guestName.trim() || undefined,
    });

    toast({
      title: `Welcome to ${event.couple_name} & ${event.partner_name}'s wedding!`,
      description: "You have 10 photos to share.",
    });

    navigate("/guest");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Decorative elements */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Leaf className="w-16 h-16 text-primary animate-float" />
            <Heart className="w-8 h-8 text-secondary absolute -bottom-1 -right-2" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-foreground mb-2">Join the Celebration</h1>
          <p className="text-muted-foreground">Enter the event code to share your moments</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-sage-light mx-auto mb-4 flex items-center justify-center">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">Guest Access</CardTitle>
            <CardDescription>You'll have 10 photos to share</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eventCode">Event Code</Label>
                <Input
                  id="eventCode"
                  placeholder="SARJAM-A1B2"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  required
                  className="bg-background text-center text-lg font-mono tracking-widest uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestName">Your Name (optional)</Label>
                <Input
                  id="guestName"
                  placeholder="Guest"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  This will appear with your photos
                </p>
              </div>
              <Button
                type="submit"
                className="w-full gradient-sage text-primary-foreground h-12 text-lg mt-6"
                disabled={loading}
              >
                {loading ? "Joining..." : "Join Wedding"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JoinWedding;
