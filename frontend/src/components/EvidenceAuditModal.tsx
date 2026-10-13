import React, { useState, useRef } from "react";
import { ShieldCheck, ShieldAlert, Upload, Loader2, X, FileCheck, Hash } from "lucide-react";
import { useReports } from "../hooks/useReports";

interface EvidenceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportId?: string;
  initialHash?: string;
}

export const EvidenceAuditModal: React.FC<EvidenceAuditModalProps> = ({
  isOpen,
  onClose,
  initialReportId,
  initialHash = ""
}) => {
  const { verifyEvidence } = useReports();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualHash, setManualHash] = useState(initialHash);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setError("");
    }
  };

  const handleRunVerification = async () => {
    if (!selectedFile && !manualHash.trim()) {
      setError("Please select a digital evidence file or provide a SHA-256 hash.");
      return;
    }

    setVerifying(true);
    setError("");
    setResult(null);

    try {
      const data = await verifyEvidence(
        selectedFile || undefined,
        manualHash.trim() || undefined,
        initialReportId || undefined
      );
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to verify evidence");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-body">
      <div className="liquid-glass w-full max-w-xl p-8 rounded-3xl space-y-6 border border-emerald-500/20 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.15)]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
              TAMPER-PROOF CHAIN OF CUSTODY
            </span>
            <h2 className="font-display italic text-2xl text-white font-normal">
              Evidence Audit & Integrity Check
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
          Upload any evidence photo, video, or audio clip to compute its cryptographic SHA-256 digest in real-time. 
          The audit engine verifies the file against the immutable evidence ledger. Any 1-bit byte-level modification fails the audit.
        </p>

        {/* Input area */}
        <div className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="p-6 border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl bg-black/40 text-center cursor-pointer transition-colors group"
          >
            <Upload className="w-8 h-8 text-zinc-500 group-hover:text-emerald-400 mx-auto mb-2 transition-colors" />
            <p className="text-xs text-white font-semibold">
              {selectedFile ? selectedFile.name : "Click to select local evidence file (Image / Video / Audio)"}
            </p>
            <span className="text-[10px] text-zinc-500">
              {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Supports JPG, PNG, MP4, MOV, WAV, PDF"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <div className="h-px bg-white/10 flex-grow" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Or Manual Hash Verification</span>
            <div className="h-px bg-white/10 flex-grow" />
          </div>

          <div className="flex items-center gap-2 bg-black/45 px-3 py-2.5 rounded-xl border border-white/10">
            <Hash className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={manualHash}
              onChange={(e) => setManualHash(e.target.value)}
              placeholder="Paste SHA-256 cryptographic hex digest (64 characters)"
              className="bg-transparent outline-none text-xs text-white font-mono w-full"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleRunVerification}
          disabled={verifying}
          className="w-full py-3.5 rounded-xl bg-emerald-500 text-black font-bold text-xs tracking-wider uppercase hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> RUNNING CRYPTOGRAPHIC AUDIT...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" /> VERIFY EVIDENCE INTEGRITY
            </>
          )}
        </button>

        {/* Results Card */}
        {result && (
          <div className={`p-5 rounded-2xl border space-y-3 font-mono text-xs ${
            result.verified 
              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/20 border-red-500/40 text-red-300"
          }`}>
            <div className="flex items-center gap-2 font-bold tracking-wider">
              {result.verified ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 text-sm">EVIDENCE VERIFIED AUTHENTIC</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">TAMPER DETECTED / AUDIT FAILED</span>
                </>
              )}
            </div>

            <p className="text-[11px] text-zinc-300 font-body">
              {result.message}
            </p>

            <div className="space-y-1.5 pt-2 border-t border-white/10 text-[10px]">
              <div>
                <span className="text-zinc-500">Algorithm: </span>
                <span className="text-white font-bold">{result.algorithm || "SHA-256"}</span>
              </div>
              <div className="break-all">
                <span className="text-zinc-500">Computed Hash: </span>
                <span className="text-amber-400 font-mono">{result.computed_hash}</span>
              </div>
              {result.recorded_hash && (
                <div className="break-all">
                  <span className="text-zinc-500">Recorded Hash: </span>
                  <span className="text-emerald-400 font-mono">{result.recorded_hash}</span>
                </div>
              )}
              {result.fir_number && (
                <div>
                  <span className="text-zinc-500">Associated FIR: </span>
                  <span className="text-white font-bold">{result.fir_number}</span>
                </div>
              )}
            </div>

            {/* Chain of Custody */}
            {result.chain_of_custody && result.chain_of_custody.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-body">
                  Chain of Custody Events
                </span>
                {result.chain_of_custody.map((entry: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-black/40 border border-white/5 text-[9px] text-zinc-400 space-y-0.5">
                    <div className="flex justify-between text-white font-bold">
                      <span>Step {entry.step}: {entry.action}</span>
                      <span className="text-emerald-400">{entry.status}</span>
                    </div>
                    <div>Actor: {entry.actor_name} ({entry.actor_id})</div>
                    <div>Timestamp: {entry.timestamp}</div>
                    <div className="text-zinc-500 italic">"{entry.notes}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
