import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GuestSession {
  guestId: string;
  weddingEventId: string;
  guestName?: string;
}

export const useGuestSession = () => {
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing anonymous session on mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.is_anonymous) {
        // Verify the guest still exists in database
        const { data: guest } = await supabase
          .from("guests")
          .select("id, wedding_event_id, guest_name")
          .eq("id", session.user.id)
          .single();
        
        if (guest) {
          setGuestSession({
            guestId: guest.id,
            weddingEventId: guest.wedding_event_id,
            guestName: guest.guest_name || undefined,
          });
        }
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setGuestSession(null);
        } else if (session?.user?.is_anonymous) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(async () => {
            const { data: guest } = await supabase
              .from("guests")
              .select("id, wedding_event_id, guest_name")
              .eq("id", session.user.id)
              .single();
            
            if (guest) {
              setGuestSession({
                guestId: guest.id,
                weddingEventId: guest.wedding_event_id,
                guestName: guest.guest_name || undefined,
              });
            }
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const createGuestSession = async (
    weddingEventId: string, 
    guestName: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Sign in anonymously - this creates a real auth.uid()
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError || !authData.user) {
        return { success: false, error: authError?.message || "Failed to create session" };
      }

      // Create guest record with id matching auth.uid()
      const { error: guestError } = await supabase
        .from("guests")
        .insert({
          id: authData.user.id, // Match anonymous user ID
          wedding_event_id: weddingEventId,
          guest_name: guestName,
          session_token: crypto.randomUUID(), // Keep for backwards compat
        });

      if (guestError) {
        // Clean up auth session on failure
        await supabase.auth.signOut();
        return { success: false, error: guestError.message };
      }

      setGuestSession({
        guestId: authData.user.id,
        weddingEventId,
        guestName: guestName || undefined,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const clearGuestSession = async () => {
    await supabase.auth.signOut();
    setGuestSession(null);
  };

  return { guestSession, loading, createGuestSession, clearGuestSession };
};
