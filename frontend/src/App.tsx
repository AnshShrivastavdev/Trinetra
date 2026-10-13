import React, { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { usePreloader } from "./hooks/usePreloader";
import { ScrollCanvas } from "./components/ScrollCanvas";
import { ProgressRing } from "./components/ProgressRing";
import { Narrative } from "./components/Narrative";
import { AuthModal } from "./components/AuthModal";
import { CitizenDash } from "./components/CitizenDash";
import { AuthorityDash } from "./components/AuthorityDash";
import { AdminDash } from "./components/AdminDash";
import { AIChatbotWidget } from "./components/AIChatbotWidget";

const AppContent: React.FC = () => {
  const { user, loading: authLoading, switchRole } = useAuth();
  const { isLoading: preloaderLoading, progress, images } = usePreloader(300);
  const [authOpen, setAuthOpen] = useState(false);

  // 1. Show preloader circular progress while image frames are cached
  if (preloaderLoading) {
    return <ProgressRing progress={progress} />;
  }

  // 2. Wait for authentication session check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="animate-pulse text-xs tracking-widest text-zinc-500 font-body uppercase font-bold">
          ESTABLISHING SECURE PROTOCOL...
        </div>
      </div>
    );
  }

  // 3. If User is Authenticated, load their respective dashboard
  if (user) {
    const isSuperuser = user.email?.toLowerCase() === "anshshrivastav9480@gmail.com";

    const renderDashboard = () => {
      switch (user.role) {
        case "citizen":
          return <CitizenDash />;
        case "authority":
          return <AuthorityDash />;
        case "admin":
          return <AdminDash />;
        default:
          return (
            <div className="min-h-screen bg-primary-bg flex items-center justify-center p-6 text-center select-none font-body">
              <div className="liquid-glass max-w-sm p-8 rounded-3xl space-y-4">
                <h2 className="text-xl font-bold text-white font-display">Unrecognized User Role</h2>
                <p className="text-xs text-zinc-400">Please establish a new login session.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-6 py-2.5 bg-white text-black text-xs font-bold rounded-full uppercase"
                >
                  Reset App
                </button>
              </div>
            </div>
          );
      }
    };

    return (
      <div className="relative min-h-screen">
        {/* Floating Superuser Role Switcher for Live Testing */}
        {isSuperuser && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 bg-black/90 border border-amber-500/40 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.25)] text-xs font-mono">
            <span className="text-amber-400 font-bold tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
              SUPERUSER TESTER ({user.email})
            </span>
            <div className="h-4 w-px bg-white/20 mx-1" />
            <span className="text-zinc-400">Switch View:</span>
            <button
              onClick={() => switchRole("citizen")}
              className={`px-3 py-1 rounded-full font-bold uppercase transition-all cursor-pointer ${
                user.role === "citizen" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Citizen
            </button>
            <button
              onClick={() => switchRole("authority")}
              className={`px-3 py-1 rounded-full font-bold uppercase transition-all cursor-pointer ${
                user.role === "authority" ? "bg-amber-500 text-black shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Authority
            </button>
            <button
              onClick={() => switchRole("admin")}
              className={`px-3 py-1 rounded-full font-bold uppercase transition-all cursor-pointer ${
                user.role === "admin" ? "bg-red-500 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Admin
            </button>
          </div>
        )}

        {renderDashboard()}
      </div>
    );
  }

  // 4. Default: User not logged in. Render interactive landing hub scrub canvas & Gemini AI Chatbot
  return (
    <>
      <ScrollCanvas images={images} />
      <Narrative onOpenAuth={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <AIChatbotWidget />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
