import React, { useState } from "react";
import { KeyRound, Shield, Search, Loader2, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { useReports } from "../hooks/useReports";

interface WhistleblowerTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken?: string;
}

export const WhistleblowerTrackModal: React.FC<WhistleblowerTrackModalProps> = ({
  isOpen,
  onClose,
  initialToken = ""
}) => {
  const { getWhistleblowerReport } = useReports();
  const [claimToken, setClaimToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimToken.trim()) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await getWhistleblowerReport(claimToken.trim());
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Whistleblower Claim Token not found or invalid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-body">
      <div className="liquid-glass w-full max-w-xl p-8 rounded-3xl space-y-6 border border-amber-500/20 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(245,158,11,0.15)]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              ANONYMOUS WHISTLEBLOWER PORTAL
            </span>
            <h2 className="font-display italic text-2xl text-white font-normal">
              Zero-Knowledge Claim Tracker
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white font-bold p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Whistleblower reports utilize client-side burner public keys. No accounts, cookies, IP addresses, or personal identifiers are stored. 
          Use your one-time burner Claim Secret to query FIR registration, police handling, and tamper-proof audit receipts.
        </p>

        {/* Input Search */}
        <form onSubmit={handleLookup} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={claimToken}
                onChange={(e) => setClaimToken(e.target.value)}
                placeholder="Enter Burner Claim Secret (e.g. WB-2026-A8F2...)"
                className="w-full pl-10 pr-4 py-3 bg-black/45 rounded-xl border border-white/10 outline-none text-xs text-white font-mono focus:border-amber-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-amber-500 text-black font-bold text-xs tracking-wider uppercase hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              TRACK
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Report Card */}
        {data && (
          <div className="liquid-glass p-6 rounded-2xl border border-amber-500/20 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                  {data.category}
                </span>
                <h3 className="text-sm font-bold text-white pt-0.5">
                  Incident Report Status
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold uppercase">
                {data.current_status}
              </span>
            </div>

            <p className="text-xs text-zinc-300 font-body">
              {data.description}
            </p>

            {/* FIR info */}
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-bold uppercase text-[9px]">Official FIR Number:</span>
                <span className="font-mono font-bold text-amber-400">
                  {data.fir_number || "Pending FIR Filing by Police"}
                </span>
              </div>
              {data.fir_details && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Police Station:</span>
                    <span className="text-white">{data.fir_details.police_station}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Sections of Law:</span>
                    <span className="text-white">{data.fir_details.sections_of_law?.join(", ")}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-500">Handling Officer:</span>
                    <span className="text-white">{data.fir_details.registering_officer}</span>
                  </div>
                </>
              )}
              {data.assigned_department && (
                <div className="flex justify-between text-[10px] pt-1 border-t border-white/5">
                  <span className="text-zinc-500">Assigned Department:</span>
                  <span className="text-cyan-400 font-bold">{data.assigned_department}</span>
                </div>
              )}
            </div>

            {/* Audit continuity */}
            {data.chain_integrity && (
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Blockchain Audit Sealed ({data.chain_integrity.total_blocks} blocks)
                </span>
                <span className="text-zinc-500">
                  Zero Identity Linked
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
