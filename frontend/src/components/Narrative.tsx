import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ShieldAlert, Video, Heart, CheckCircle2, AlertTriangle, Radio } from "lucide-react";

interface NarrativeProps {
  onOpenAuth: () => void;
}

export const Narrative: React.FC<NarrativeProps> = ({ onOpenAuth }) => {
  const [mockVotes, setMockVotes] = useState(14);
  const [hasVoted, setHasVoted] = useState(false);

  const handleUpvote = () => {
    if (!hasVoted) {
      setMockVotes((prev) => prev + 1);
      setHasVoted(true);
    } else {
      setMockVotes((prev) => prev - 1);
      setHasVoted(false);
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: false, amount: 0.3 },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }
  };

  return (
    <div className="relative z-10 w-full min-h-screen text-slate-100 font-body select-none">
      
      {/* SECTION 1: HERO HUB */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-black/25 via-transparent to-black/30">
        <motion.div 
          {...fadeInUp}
          className="space-y-4 max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">LIVE CIVIC PIPELINE</span>
          </div>
          <h1 className="font-display italic text-8xl md:text-9xl text-white font-normal tracking-wide drop-shadow-2xl">
            Trinetra
          </h1>
          <p className="font-body text-xs md:text-sm font-semibold tracking-[0.4em] text-zinc-400 uppercase">
            Report &bull; Response &bull; Protect
          </p>
          <div className="pt-8">
            <button 
              onClick={onOpenAuth}
              className="liquid-glass liquid-glass-hover px-8 py-3.5 rounded-full font-body text-xs font-bold tracking-widest text-white uppercase"
            >
              ACCESS CORE PORTAL
            </button>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2: PROBLEM & FEATURES */}
      <section className="min-h-screen flex items-center justify-center px-6 py-24">
        <motion.div 
          {...fadeInUp}
          className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
        >
          <div className="space-y-6">
            <h2 className="font-display italic text-5xl md:text-6xl text-white font-normal leading-tight">
              Bridging the gap between report and response.
            </h2>
            <p className="font-body text-sm text-zinc-400 leading-relaxed">
              Traditional emergency reporting is delayed by call queues and manual address routing. 
              Trinetra resolves incidents in real-time, connecting citizens with authorities instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Feature 1 */}
            <div className="liquid-glass p-6 rounded-2xl flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <ShieldAlert className="w-5 h-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-sm font-semibold text-white tracking-wide">Secured Anonymity</h3>
                <p className="text-xs text-zinc-400 leading-normal">File reports publicly or mask your credentials completely. Your real identity remains locked from public API feeds.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="liquid-glass p-6 rounded-2xl flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Video className="w-5 h-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-sm font-semibold text-white tracking-wide">Multi-Media Logs</h3>
                <p className="text-xs text-zinc-400 leading-normal">Attach photographs or videos directly. Static media assets are hosted securely via Cloudinary.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="liquid-glass p-6 rounded-2xl flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <MapPin className="w-5 h-5 text-white/80" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-sm font-semibold text-white tracking-wide">GPS Address Resolution</h3>
                <p className="text-xs text-zinc-400 leading-normal">Coordinates map to physical street addresses via geocoding lookups. No map interfaces required.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 3: VOTING MOCKUP */}
      <section className="min-h-screen flex items-center justify-center px-6 py-24">
        <motion.div 
          {...fadeInUp}
          className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
        >
          <div className="space-y-6">
            <h2 className="font-display italic text-5xl md:text-6xl text-white font-normal leading-tight">
              Community validated safety feeds.
            </h2>
            <p className="font-body text-sm text-zinc-400 leading-relaxed">
              Citizens upvote active nearby reports to validate and prioritize incidents. 
              High-priority events elevate in visibility on dispatch grids, ensuring fast response.
            </p>
          </div>

          <div className="flex justify-center">
            {/* Interactive Liquid Glass Card Mockup */}
            <div className={`liquid-glass w-full max-w-sm p-6 rounded-3xl space-y-6 border transition-all duration-300 ${hasVoted ? 'liquid-glass-glow-emerald border-emerald-500/20' : 'border-white/5'}`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">INCIDENT MOCKUP</span>
                  <h4 className="font-body text-sm font-bold text-white tracking-wide">Commercial Burglary</h4>
                </div>
                <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 font-body text-[9px] font-extrabold tracking-wider uppercase">
                  ACTIVE
                </div>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                "Suspicious behavior observed near warehouse entry. Suspect fled on a dark mountain bicycle heading north."
              </p>

              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-500">0.4 km away</span>
                </div>
                
                {/* Neomorphic Interactive Heart/Upvote Toggle Button */}
                <button
                  onClick={handleUpvote}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                    hasVoted
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 transition-transform duration-300 ${hasVoted ? 'fill-emerald-400 scale-120' : ''}`} />
                  <span>{mockVotes} VOTES</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 4: CASE WORKFLOW TIMELINE */}
      <section className="min-h-screen flex items-center justify-center px-6 py-24">
        <motion.div 
          {...fadeInUp}
          className="max-w-4xl w-full space-y-16 text-center"
        >
          <div className="space-y-4">
            <h2 className="font-display italic text-5xl md:text-6xl text-white font-normal">
              Continuous incident lifecycle.
            </h2>
            <p className="font-body text-xs md:text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              TRACK COMPLAINTS LIVE AS STATUS SHIFTS FORWARD
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="liquid-glass p-6 rounded-2xl text-center space-y-4 border border-white/5 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-xs font-bold text-white tracking-widest uppercase">1. Pending</h3>
                <p className="text-[11px] text-zinc-500 leading-normal">Reports logged in coordinates database. Dispatched immediately to local authority feeds.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="liquid-glass p-6 rounded-2xl text-center space-y-4 border border-white/5 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
                <Radio className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-xs font-bold text-white tracking-widest uppercase">2. Ongoing</h3>
                <p className="text-[11px] text-zinc-500 leading-normal">Officers assigned. Status changes broadcast real-time to citizen dashboard timelines.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`liquid-glass p-6 rounded-2xl text-center space-y-4 relative z-10 border transition-all duration-300 liquid-glass-glow-emerald border-emerald-500/20`}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-body text-xs font-bold text-white tracking-widest uppercase">3. Resolved</h3>
                <p className="text-[11px] text-zinc-500 leading-normal">Incident closed. System statistics update. AI models parse coordinates for duplicate matching.</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <button 
              onClick={onOpenAuth}
              className="liquid-glass liquid-glass-hover px-10 py-4 rounded-full font-body text-xs font-bold tracking-widest text-white uppercase border border-white/10"
            >
              GET STARTED
            </button>
          </div>
        </motion.div>
      </section>

    </div>
  );
};
