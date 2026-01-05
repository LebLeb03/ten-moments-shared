import { useState, useEffect } from "react";

const GUEST_SESSION_KEY = "wedding_guest_session";

interface GuestSession {
  guestId: string;
  weddingEventId: string;
  sessionToken: string;
  guestName?: string;
}

export const useGuestSession = () => {
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(GUEST_SESSION_KEY);
    if (stored) {
      try {
        setGuestSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(GUEST_SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const saveGuestSession = (session: GuestSession) => {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    setGuestSession(session);
  };

  const clearGuestSession = () => {
    localStorage.removeItem(GUEST_SESSION_KEY);
    setGuestSession(null);
  };

  return { guestSession, loading, saveGuestSession, clearGuestSession };
};
