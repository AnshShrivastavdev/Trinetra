import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useReports } from "../hooks/useReports";
import type { Report } from "../hooks/useReports";
import { getSocket } from "../utils/socket";
import { LodgeFirModal } from "./LodgeFirModal";
import { EvidenceAuditModal } from "./EvidenceAuditModal";
import { AuditTrailModal } from "./AuditTrailModal";
import { 
  MapPin, ShieldAlert, LogOut, 
  Radio, Loader2, Sparkles, Flag,
  FileText, ShieldCheck, Link2, Building2, CheckCircle2
} from "lucide-react";

export const AuthorityDash: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const { fetchReports, flagReport, verifyAI, advanceLifecycle, assignDepartment } = useReports();
  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});

  // Modals state
  const [lodgeFirTarget, setLodgeFirTarget] = useState<Report | null>(null);

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTargetReportId, setAuditTargetReportId] = useState<string | undefined>(undefined);
  const [auditTargetHash, setAuditTargetHash] = useState<string | undefined>(undefined);

  const [showAuditTrailModal, setShowAuditTrailModal] = useState(false);
  const [auditTrailReportId, setAuditTrailReportId] = useState("");

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchReports();
      setLocalReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (user && !user.is_approved) {
      interval = setInterval(async () => {
        await refreshProfile();
      }, 15000);
    } else {
      loadFeed();
      
      const socket = getSocket();
      if (socket) {
        socket.on("report_created", () => {
          loadFeed();
        });
        socket.on("status_updated", () => {
          loadFeed();
        });
        socket.on("report_voted", (data) => {
          setLocalReports(prev => prev.map(r => r._id === data.reportId ? { ...r, voteCount: data.voteCount } : r));
        });
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      const socket = getSocket();
      if (socket) {
        socket.off("report_created");
        socket.off("status_updated");
        socket.off("report_voted");
      }
    };
  }, [user?.is_approved]);

  if (user && !user.is_approved) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-6 select-none font-body">
        <div className="liquid-glass max-w-md p-10 rounded-3xl border border-amber-500/20 text-center space-y-6 liquid-glass-glow-amber">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">ACCESS RESTRICTED</span>
            <h2 className="font-display italic text-4xl text-white font-normal">Verification Pending</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your officer account is currently pending administrator verification. 
            Please coordinate with your precinct's administrator to approve your Firebase credential profile.
          </p>
          <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mx-auto" />
          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={async () => {
                const refreshed = await refreshProfile();
                if (refreshed?.is_approved) {
                  alert("Access Approved! Loading dashboard...");
                } else {
                  alert("Still pending admin approval. Re-checking again in 15 seconds.");
                }
              }}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold tracking-widest text-white uppercase cursor-pointer"
            >
              Check Status Now
            </button>
            <button 
              onClick={logout} 
              className="w-full py-3 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-xs font-bold tracking-widest uppercase cursor-pointer"
            >
              Logout Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGeminiVerify = async (reportId: string) => {
    setVerifyingMap((prev) => ({ ...prev, [reportId]: true }));
    try {
      await verifyAI(reportId);
      loadFeed();
    } catch (e: any) {
      alert("AI Scanning Error: " + e.message);
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const handleAdvanceStage = async (reportId: string, nextStatus: any, remarks: string) => {
    try {
      await advanceLifecycle(reportId, nextStatus, remarks);
      loadFeed();
    } catch (e: any) {
      alert("Lifecycle Advance Error: " + e.message);
    }
  };

  const handleAssignDepartment = async (reportId: string, dept: string) => {
    try {
      await assignDepartment(reportId, dept);
      loadFeed();
    } catch (e: any) {
      alert("Department Route Error: " + e.message);
    }
  };

  const handleFlagReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to flag this incident report as suspicious?")) return;
    try {
      await flagReport(reportId);
      loadFeed();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg text-slate-100 p-6 md:p-12 relative select-none">
      
      {/* Background Subtle Gradient Emitters */}
      <div className="absolute top-[5%] right-[10%] w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">TACTICAL DISPATCH PORTAL</span>
            <h1 className="font-display italic text-4xl text-white font-normal tracking-wide">
              Law Enforcement & FIR Command
            </h1>
            <p className="text-xs text-zinc-500 font-body">Logged in as Officer: <span className="text-white font-semibold">{user?.name}</span> ({user?.firebase_uid})</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setAuditTargetReportId(undefined);
                setAuditTargetHash(undefined);
                setShowAuditModal(true);
              }}
              className="px-4 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-body text-xs font-bold tracking-wider hover:bg-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" /> AUDIT EVIDENCE
            </button>

            <button
              onClick={loadFeed}
              className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-white tracking-wider transition-colors cursor-pointer"
            >
              Sync Grid
            </button>

            <button
              onClick={logout}
              className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FEED GRID */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-500 animate-pulse" /> DISPATCH STREAM & INVESTIGATION QUEUE
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              {localReports.length} Incidents Active
            </span>
          </div>

          {loading && localReports.length === 0 ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : localReports.length === 0 ? (
            <div className="liquid-glass p-12 text-center rounded-2xl">
              <p className="text-sm text-zinc-500">No active incidents on the dispatch pipeline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {localReports.map((report) => {
                const isEmergency = report.emergencyFlag;
                const isVerifying = verifyingMap[report._id];
                
                return (
                  <div 
                    key={report._id} 
                    className={`liquid-glass p-6 rounded-3xl grid grid-cols-1 lg:grid-cols-12 gap-6 border transition-all duration-300 ${
                      isEmergency ? "liquid-glass-glow-amber border-amber-500/20" : "border-white/5"
                    }`}
                  >
                    
                    {/* Column 1: Info (Col 5) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-extrabold tracking-wider text-zinc-400 uppercase">
                          {report.category}
                        </span>
                        {report.firNumber ? (
                          <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-bold">
                            {report.firNumber}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-500 text-[8px] font-bold uppercase">
                            NO FIR LODGED
                          </span>
                        )}
                        {report.assignedDepartment && (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[8px] font-bold uppercase">
                            {report.assignedDepartment}
                          </span>
                        )}
                        {isEmergency && (
                          <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-500 text-[8px] font-extrabold tracking-widest uppercase animate-pulse">
                            CRITICAL EMERGENCY
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-zinc-300 leading-relaxed font-body">
                        {report.description}
                      </p>

                      {/* Evidence with SHA-256 Check */}
                      {report.mediaUrls && report.mediaUrls.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Tamper-Proof Evidence ({report.mediaUrls.length})
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {report.mediaUrls.map((url, idx) => {
                              const isVideo = url.toLowerCase().includes("/video/") || url.toLowerCase().endsWith(".mp4");
                              return (
                                <div key={idx} className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center relative group">
                                  {isVideo ? (
                                    <video src={url} controls className="w-full h-full object-cover" />
                                  ) : (
                                    <a href={url} target="_blank" rel="noreferrer" className="w-full h-full">
                                      <img src={url} alt="Media" className="w-full h-full object-cover" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      setAuditTargetReportId(report._id);
                                      setAuditTargetHash(report.evidenceLedger?.[idx]?.sha256_hash);
                                      setShowAuditModal(true);
                                    }}
                                    title="Verify SHA-256 Hash"
                                    className="absolute bottom-1 right-1 p-1 bg-black/80 rounded text-emerald-400 text-[9px] hover:text-white cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[280px]" title={report.location.address}>
                          {report.location.address || `${report.location.lat.toFixed(5)}, ${report.location.lng.toFixed(5)}`}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: AI Verification (Col 3) */}
                    <div className="lg:col-span-3 p-4 rounded-2xl bg-black/35 border border-white/5 flex flex-col justify-between space-y-4">
                      <div className="space-y-1">
                        <span className="text-[8px] font-extrabold tracking-wider text-zinc-500 uppercase flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" /> GEMINI AI CLASSIFIER
                        </span>
                        {report.aiAnalysis ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold ${report.aiAnalysis.isSuspicious ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {report.aiAnalysis.isSuspicious ? "SUSPICIOUS CASE" : "VERIFIED CREDIBLE"}
                              </span>
                              <span className="text-[10px] text-zinc-500">({report.aiAnalysis.suspicionScore}% risk)</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 italic leading-normal" title={report.aiAnalysis.reason}>
                              "{report.aiAnalysis.reason}"
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-500 italic">No AI scan executed on this report.</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleGeminiVerify(report._id)}
                        disabled={isVerifying}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold tracking-wider text-white uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-zinc-500" /> COMPUTING VECTORS...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-amber-500" /> RUN GEMINI DUPLICATE CHECK
                          </>
                        )}
                      </button>
                    </div>

                    {/* Column 3: FIR, Lifecycle & Routing Controls (Col 4) */}
                    <div className="lg:col-span-4 flex flex-col justify-between space-y-4 p-4 rounded-2xl bg-black/25 border border-white/5">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-extrabold tracking-wider text-zinc-500 uppercase">
                            PROCEDURAL ACTIONS
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">
                            {report.status}
                          </span>
                        </div>

                        {/* FIR Button */}
                        {!report.firNumber ? (
                          <button
                            onClick={() => setLodgeFirTarget(report)}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                          >
                            <FileText className="w-3.5 h-3.5" /> LODGE OFFICIAL FIR
                          </button>
                        ) : (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> FIR LODGED: {report.firNumber}
                            </span>
                          </div>
                        )}

                        {/* Lifecycle progression buttons */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">
                            Advance Deterministic Stage:
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              onClick={() => handleAdvanceStage(report._id, "Investigating", "Forensic field investigation dispatched.")}
                              className={`py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                                report.status === "Investigating"
                                  ? "bg-blue-500 text-black border-blue-400"
                                  : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                              }`}
                            >
                              Investigate
                            </button>
                            <button
                              onClick={() => handleAdvanceStage(report._id, "Charge-sheet Submitted", "Police investigation completed. Charge-sheet filed in Magistrate Court.")}
                              className={`py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                                report.status === "Charge-sheet Submitted"
                                  ? "bg-purple-500 text-black border-purple-400"
                                  : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                              }`}
                            >
                              Chargesheet
                            </button>
                            <button
                              onClick={() => handleAdvanceStage(report._id, "Resolved", "Case adjudicated and resolved.")}
                              className={`py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                                report.status === "Resolved"
                                  ? "bg-emerald-500 text-black border-emerald-400"
                                  : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                              }`}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>

                        {/* Department Routing */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-cyan-400" /> Multi-Agency Jurisdiction:
                          </span>
                          <select
                            value={report.assignedDepartment || "Local Police"}
                            onChange={(e) => handleAssignDepartment(report._id, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-black/60 rounded-lg border border-white/10 text-[10px] text-zinc-200 outline-none cursor-pointer focus:border-cyan-500/40"
                          >
                            <option value="Local Police" className="bg-zinc-900">Local Police</option>
                            <option value="Cyber Crime Cell" className="bg-zinc-900">Cyber Crime Cell</option>
                            <option value="Forensics Bureau" className="bg-zinc-900">Forensics Bureau</option>
                            <option value="Judiciary / Court" className="bg-zinc-900">Judiciary / Court</option>
                          </select>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => {
                            setAuditTrailReportId(report._id);
                            setShowAuditTrailModal(true);
                          }}
                          className="flex-1 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-[9px] font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" /> Audit Ledger
                        </button>

                        {!report.isFlagged && (
                          <button
                            onClick={() => handleFlagReport(report._id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Flag as Suspicious"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* MODALS */}
      {lodgeFirTarget && (
        <LodgeFirModal
          isOpen={!!lodgeFirTarget}
          onClose={() => setLodgeFirTarget(null)}
          reportId={lodgeFirTarget._id}
          category={lodgeFirTarget.category}
          onSuccess={loadFeed}
        />
      )}

      <EvidenceAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        initialReportId={auditTargetReportId}
        initialHash={auditTargetHash}
      />

      <AuditTrailModal
        isOpen={showAuditTrailModal}
        onClose={() => setShowAuditTrailModal(false)}
        reportId={auditTrailReportId}
      />

    </div>
  );
};
