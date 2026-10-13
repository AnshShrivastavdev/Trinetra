import React, { useState, useEffect } from "react";
import { Link2, ShieldCheck, ShieldAlert, Loader2, X, Clock, User, ExternalLink, Sparkles } from "lucide-react";
import { useReports } from "../hooks/useReports";

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  reportId
}) => {
  const { getAuditTrail, anchorOnChain, getOnchainProof } = useReports();
  const [data, setData] = useState<any>(null);
  const [blockchainReceipt, setBlockchainReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && reportId) {
      loadTrail();
    }
  }, [isOpen, reportId]);

  const loadTrail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAuditTrail(reportId);
      setData(res);

      try {
        const proofRes = await getOnchainProof(reportId);
        if (proofRes && proofRes.blockchain_receipt) {
          setBlockchainReceipt(proofRes.blockchain_receipt);
        }
      } catch (e) {
        // proof optional on initial load
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  };

  const handleAnchorNow = async () => {
    setAnchoring(true);
    try {
      const res = await anchorOnChain(reportId);
      setBlockchainReceipt(res.blockchain_receipt);
      await loadTrail();
    } catch (err: any) {
      alert("Blockchain Anchoring Failed: " + (err.message || err));
    } finally {
      setAnchoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-body">
      <div className="liquid-glass w-full max-w-2xl p-8 rounded-3xl space-y-6 border border-cyan-500/20 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-cyan-400" />
              IMMUTABLE INCIDENT AUDIT TRAIL
            </span>
            <h2 className="font-display italic text-2xl text-white font-normal">
              Cryptographic Hash-Chained Ledger
            </h2>
            {data?.fir_number && (
              <span className="text-xs font-mono font-bold text-amber-400 block pt-1">
                Official FIR Identifier: {data.fir_number}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white font-bold p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* EVM Blockchain Anchoring Banner */}
        {blockchainReceipt ? (
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/40 text-purple-300 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-400" />
                ANCHORED ON {blockchainReceipt.network.toUpperCase()}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-black/50 border border-purple-500/30 text-purple-300 font-bold">
                Block #{blockchainReceipt.block_number}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Contract: <strong className="text-zinc-300 font-mono">{blockchainReceipt.contract_address?.slice(0, 16)}...</strong></span>
                <span>Gas Used: {blockchainReceipt.gas_used}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-purple-500/20">
                <span className="truncate max-w-[280px]">Tx: {blockchainReceipt.transaction_hash}</span>
                <a
                  href={blockchainReceipt.explorer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold underline"
                >
                  Verify on Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
            <div>
              <span className="text-white font-bold block">EVM Blockchain Not Anchored Yet</span>
              <p className="text-[10px] text-zinc-400">Anchor this incident's state hashes onto Polygon Amoy Testnet.</p>
            </div>
            <button
              onClick={handleAnchorNow}
              disabled={anchoring}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {anchoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              ANCHOR TO BLOCKCHAIN
            </button>
          </div>
        )}

        {/* Chain Integrity Banner */}
        {data?.integrity && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-mono ${
            data.integrity.is_valid
              ? "bg-cyan-950/20 border-cyan-500/30 text-cyan-300"
              : "bg-red-950/20 border-red-500/40 text-red-300"
          }`}>
            <div className="flex items-center gap-2">
              {data.integrity.is_valid ? (
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-400" />
              )}
              <div>
                <span className="font-bold">
                  {data.integrity.is_valid ? "CRYPTOGRAPHIC CONTINUITY VERIFIED" : "CHAIN INTEGRITY COMPROMISED"}
                </span>
                <p className="text-[10px] text-zinc-400 font-body">
                  {data.integrity.is_valid 
                    ? `All ${data.integrity.total_blocks} ledger transitions validated against parent SHA-256 block digests.`
                    : `Broken at block index ${data.integrity.broken_at_block}: ${data.integrity.reason}`}
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded bg-black/40 border border-white/10 uppercase font-bold">
              {data.integrity.total_blocks} Blocks Sealed
            </span>
          </div>
        )}


        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold">
            {error}
          </div>
        ) : (!data?.audit_trail || data.audit_trail.length === 0) ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No audit blocks sealed yet for this report.
          </div>
        ) : (
          <div className="space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase block">
              Block Sequence Progression
            </span>

            <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {data.audit_trail.map((block: any, idx: number) => (
                <div key={idx} className="relative pl-10">
                  {/* Block indicator */}
                  <div className="absolute left-2 top-3 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </div>

                  <div className="liquid-glass p-4 rounded-2xl border border-white/10 space-y-2 hover:border-cyan-500/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 font-bold uppercase">
                          Block #{block.block_index}: {block.action}
                        </span>
                        <h4 className="text-xs font-bold text-white pt-1">
                          {block.from_status} ➔ <span className="text-amber-400">{block.to_status}</span>
                        </h4>
                      </div>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 font-body">
                      {block.remarks}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 pt-1 border-t border-white/5 font-mono">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-zinc-400" />
                        {block.actor_name} ({block.actor_role})
                      </span>
                    </div>

                    {/* Cryptographic Hashes */}
                    <div className="bg-black/60 p-2.5 rounded-xl border border-white/5 font-mono text-[9px] space-y-1">
                      <div className="flex items-center gap-1.5 break-all">
                        <span className="text-zinc-500 flex-shrink-0">PREV_HASH:</span>
                        <span className="text-zinc-400">{block.previous_block_hash.slice(0, 24)}...</span>
                      </div>
                      <div className="flex items-center gap-1.5 break-all">
                        <span className="text-cyan-400 flex-shrink-0 font-bold">BLOCK_HASH:</span>
                        <span className="text-cyan-300">{block.block_hash}</span>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
