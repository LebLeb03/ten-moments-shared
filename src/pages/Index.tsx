import { useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestSession } from "@/hooks/useGuestSession";
import { Button } from "@/components/ui/button";
import { Camera, Heart, Leaf, Users } from "lucide-react";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { guestSession, loading: guestLoading } = useGuestSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is logged in, redirect to dashboard
    if (!authLoading && user) {
      navigate("/dashboard");
      return;
    }

    // If guest has a session, redirect to guest page
    if (!guestLoading && guestSession) {
      navigate("/guest");
      return;
    }

    // If there's a code in the URL, redirect to join page
    const code = searchParams.get("code");
    if (code) {
      navigate(`/join?code=${code}`);
    }
  }, [user, authLoading, guestSession, guestLoading, searchParams, navigate]);

  if (authLoading || guestLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Leaf className="w-12 h-12 text-primary animate-pulse-soft" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Logo/Icon */}
        <div className="relative mb-8 animate-fade-in">
          <Leaf className="w-24 h-24 text-primary" />
          <Heart className="w-10 h-10 text-secondary absolute -bottom-2 -right-2 animate-float" />
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4 animate-slide-up">
          Ten Moments
          <br />
          That Matter
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl max-w-md mb-12 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          A wedding photo experience designed for presence, not performance.
        </p>

        {/* CTAs */}
        <div className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <Link to="/join" className="block">
            <Button className="w-full h-14 text-lg gradient-sage text-primary-foreground rounded-xl">
              <Camera className="mr-2 h-5 w-5" />
              I'm a Guest
            </Button>
          </Link>

          <Link to="/auth" className="block">
            <Button variant="outline" className="w-full h-14 text-lg rounded-xl border-secondary text-secondary hover:bg-secondary/10">
              <Users className="mr-2 h-5 w-5" />
              I'm the Couple
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <p className="text-sm text-muted-foreground">
          One wedding. One shared story.
        </p>
      </footer>
    </div>
  );
};

export default Index;
