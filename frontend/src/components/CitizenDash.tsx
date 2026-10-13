import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useReports } from "../hooks/useReports";
import type { Report } from "../hooks/useReports";
import { EvidenceAuditModal } from "./EvidenceAuditModal";
import { AuditTrailModal } from "./AuditTrailModal";
import { WhistleblowerTrackModal } from "./WhistleblowerTrackModal";
import { LiveCameraModal } from "./LiveCameraModal";
import { 
  MapPin, Heart, LogOut, 
  AlertTriangle, Radio, Plus, Send, EyeOff, Eye, Image as ImageIcon, Loader2, Upload,
  ShieldCheck, Link2, KeyRound, Shield, Copy, Check, Camera
} from "lucide-react";

export const CitizenDash: React.FC = () => {
  const { user, logout } = useAuth();
  const { fetchReports, createReport, upvoteReport, uploadMediaWithHash } = useReports();
  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Crypto & FIR Modals
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTargetReportId, setAuditTargetReportId] = useState<string | undefined>(undefined);
  const [auditTargetHash, setAuditTargetHash] = useState<string | undefined>(undefined);

  const [showAuditTrailModal, setShowAuditTrailModal] = useState(false);
  const [auditTrailReportId, setAuditTrailReportId] = useState("");

  const [showWhistleblowerModal, setShowWhistleblowerModal] = useState(false);
  const [whistleblowerSuccessToken, setWhistleblowerSuccessToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Form states
  const [category, setCategory] = useState("Robbery");
  const [description, setDescription] = useState("");
  const [emergencyFlag, setEmergencyFlag] = useState(false);
  const [anonymityFlag, setAnonymityFlag] = useState(false);
  const [whistleblowerMode, setWhistleblowerMode] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [evidenceLedger, setEvidenceLedger] = useState<any[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    loadFeed();
  }, []);

  const triggerGps = () => {
    setGpsLoading(true);
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        setGpsError("Failed to fetch coordinates. Please allow location permissions.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.startsWith("data:video/") ||
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".webm") ||
      lower.endsWith(".mkv") ||
      lower.includes("/video/upload/")
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { url, evidence_record } = await uploadMediaWithHash(file);
        setMediaUrls((prev) => [...prev, url]);
        if (evidence_record) {
          setEvidenceLedger((prev) => [...prev, evidence_record]);
        }
      }
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddMedia = () => {
    if (mediaUrl.trim()) {
      setMediaUrls((prev) => [...prev, mediaUrl.trim()]);
      setMediaUrl("");
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    if (lat === null || lng === null) {
      setSubmitError("GPS coordinates are required to submit an incident report.");
      setIsSubmitting(false);
      return;
    }

    try {
      const created = await createReport({
        category,
        description,
        emergencyFlag,
        anonymityFlag,
        whistleblowerMode,
        mediaUrls,
        evidenceLedger,
        location: {
          lat,
          lng
        }
      });

      // Clear Form & Close Modal
      setCategory("Robbery");
      setDescription("");
      setEmergencyFlag(false);
      setAnonymityFlag(false);
      setWhistleblowerMode(false);
      setMediaUrls([]);
      setEvidenceLedger([]);
      setLat(null);
      setLng(null);
      setShowReportModal(false);

      if (created.whistleblowerToken) {
        setWhistleblowerSuccessToken(created.whistleblowerToken);
      }
      
      // Reload Feed
      loadFeed();
    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (reportId: string, createdBy: string) => {
    if (createdBy === user?.firebase_uid) {
      alert("Self-voting block: Citizens cannot vote on their own reports.");
      return;
    }

    try {
      const updated = await upvoteReport(reportId);
      setLocalReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, voteCount: updated.voteCount } : r))
      );
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-primary-bg text-slate-100 p-6 md:p-12 relative select-none">
      
      {/* Background Subtle Gradient Emitters */}
      <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-white/2 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">CITIZEN PORTAL</span>
            <h1 className="font-display italic text-4xl text-white font-normal tracking-wide">
              Security Dashboard
            </h1>
            <p className="text-xs text-zinc-500 font-body">Logged in as: <span className="text-white font-semibold">{user?.name}</span> ({user?.firebase_uid})</p>
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
              onClick={() => setShowWhistleblowerModal(true)}
              className="px-4 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-body text-xs font-bold tracking-wider hover:bg-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4" /> TRACK WHISTLEBLOWER
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-5 py-2.5 rounded-full bg-white text-black font-body text-xs font-bold tracking-wider hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.15)] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> REPORT CRIME
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

        {/* FEED SECTIONS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500 animate-pulse" /> LIVE INCIDENT PIPELINE
            </h3>
            <button onClick={loadFeed} className="text-xs text-zinc-400 hover:text-white transition-colors uppercase font-bold tracking-widest cursor-pointer">
              Refresh Feed
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : localReports.length === 0 ? (
            <div className="liquid-glass p-12 text-center rounded-2xl">
              <p className="text-sm text-zinc-500">No active incidents logged. The community is safe.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {localReports.map((report) => {
                const isEmergency = report.emergencyFlag;
                const statusColor = 
                  report.status === "Pending" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                  report.status === "FIR Filed" ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" :
                  report.status === "Investigating" ? "text-blue-400 bg-blue-500/10 border-blue-500/30" :
                  report.status === "Charge-sheet Submitted" ? "text-purple-400 bg-purple-500/10 border-purple-500/30" :
                  "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                
                return (
                  <div 
                    key={report._id} 
                    className={`liquid-glass p-6 rounded-3xl space-y-5 border transition-all duration-300 ${
                      isEmergency ? "liquid-glass-glow-amber border-amber-500/20" : "border-white/5"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">{report.category}</span>
                          {report.firNumber && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[9px] font-bold">
                              {report.firNumber}
                            </span>
                          )}
                          {report.assignedDepartment && (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[8px] font-bold uppercase">
                              {report.assignedDepartment}
                            </span>
                          )}
                        </div>

                        <h4 className="font-body text-sm font-bold text-white tracking-wide">
                          {report.whistleblowerMode ? (
                            <span className="inline-flex items-center gap-1 text-amber-400/90 font-semibold italic text-xs">
                              <Shield className="w-3.5 h-3.5" /> Whistleblower [Protected]
                            </span>
                          ) : report.anonymityFlag ? (
                            <span className="inline-flex items-center gap-1 text-zinc-500 font-semibold italic text-xs">
                              <EyeOff className="w-3.5 h-3.5" /> Anonymous Filer
                            </span>
                          ) : (
                            <span className="text-white font-semibold text-xs">
                              {report.createdBy === user?.firebase_uid ? "You (Public Report)" : "Public Incident Filer"}
                            </span>
                          )}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isEmergency && (
                          <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/20 text-red-500 text-[8px] font-extrabold tracking-widest uppercase animate-pulse">
                            CRITICAL
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wider border uppercase ${statusColor}`}>
                          {report.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed font-body">
                      {report.description}
                    </p>

                    {/* Deterministic Lifecycle Stepper */}
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-[9px]">
                      <div className="flex justify-between items-center text-zinc-500 font-bold uppercase text-[8px]">
                        <span>Deterministic FIR Pipeline</span>
                        <span className="text-cyan-400">STAGE: {report.status}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className={`p-1 rounded ${
                          ["Pending", "Reported", "FIR Filed", "Investigating", "Charge-sheet Submitted", "Resolved"].includes(report.status)
                            ? "bg-emerald-500/20 text-emerald-300 font-bold"
                            : "bg-white/5 text-zinc-600"
                        }`}>
                          1. Logged
                        </div>
                        <div className={`p-1 rounded ${
                          ["FIR Filed", "Investigating", "Charge-sheet Submitted", "Resolved"].includes(report.status)
                            ? "bg-cyan-500/20 text-cyan-300 font-bold"
                            : "bg-white/5 text-zinc-600"
                        }`}>
                          2. FIR Filed
                        </div>
                        <div className={`p-1 rounded ${
                          ["Investigating", "Charge-sheet Submitted", "Resolved"].includes(report.status)
                            ? "bg-blue-500/20 text-blue-300 font-bold"
                            : "bg-white/5 text-zinc-600"
                        }`}>
                          3. Investigating
                        </div>
                        <div className={`p-1 rounded ${
                          ["Charge-sheet Submitted", "Resolved"].includes(report.status)
                            ? "bg-purple-500/20 text-purple-300 font-bold"
                            : "bg-white/5 text-zinc-600"
                        }`}>
                          4. Chargesheet
                        </div>
                      </div>
                    </div>

                    {/* Media Attachments */}
                    {report.mediaUrls && report.mediaUrls.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Evidence Assets ({report.mediaUrls.length})
                        </span>
                        <div className="flex gap-2 flex-wrap">
                          {report.mediaUrls.map((url, idx) => (
                            <div key={idx} className="w-20 h-20 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center relative group">
                              {isVideoUrl(url) ? (
                                <video src={url} controls className="w-full h-full object-cover" />
                              ) : url.startsWith("http") || url.startsWith("data:image/") || url.startsWith("blob:") ? (
                                <a href={url} target="_blank" rel="noreferrer" className="w-full h-full">
                                  <img src={url} alt="Incident media" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                </a>
                              ) : (
                                <ImageIcon className="w-5 h-5 text-zinc-600" />
                              )}
                              {/* Quick verify button on media overlay */}
                              <button
                                onClick={() => {
                                  const matchingHash = report.evidenceLedger?.[idx]?.sha256_hash;
                                  setAuditTargetReportId(report._id);
                                  setAuditTargetHash(matchingHash);
                                  setShowAuditModal(true);
                                }}
                                title="Check SHA-256 Fingerprint Integrity"
                                className="absolute bottom-1 right-1 p-1 rounded bg-black/80 text-emerald-400 hover:text-white text-[9px] opacity-90 transition-opacity cursor-pointer"
                              >
                                <ShieldCheck className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-xs truncate max-w-[180px]" title={report.location.address}>
                          {report.location.address || `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setAuditTrailReportId(report._id);
                            setShowAuditTrailModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-xs font-bold text-cyan-300 tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Audit Trail</span>
                        </button>

                        <button
                          onClick={() => handleVote(report._id, report.createdBy)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-white tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500/20" />
                          <span>{report.voteCount}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* CREATE INCIDENT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="liquid-glass w-full max-w-xl p-8 rounded-3xl space-y-6 border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">NEW INCIDENT LOG</span>
                <h2 className="font-display italic text-2xl text-white font-normal">File Incident with Cryptographic Seal</h2>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-zinc-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-5">
              {submitError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Incident Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/5 outline-none text-xs text-white focus:border-white/15 cursor-pointer"
                >
                  <option value="Robbery" className="bg-zinc-900">Robbery / Theft</option>
                  <option value="Cyber Crime" className="bg-zinc-900">Cyber Crime / Financial Fraud</option>
                  <option value="Corruption" className="bg-zinc-900">Corruption / Bribery</option>
                  <option value="Assault" className="bg-zinc-900">Physical Assault</option>
                  <option value="Vandalism" className="bg-zinc-900">Vandalism / Property Damage</option>
                  <option value="Harassment" className="bg-zinc-900">Harassment / Stalking</option>
                  <option value="Suspicious Activity" className="bg-zinc-900">Suspicious Activity</option>
                  <option value="Other" className="bg-zinc-900">Other Emergency</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Incident Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise details of the occurrence..."
                  className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/5 outline-none text-xs text-white focus:border-white/15 resize-none"
                />
              </div>

              {/* Geolocation Capture */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Location Coordinates</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={triggerGps}
                    disabled={gpsLoading}
                    className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-white tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {gpsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> FETCHING...
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 text-zinc-400" /> FETCH GPS
                      </>
                    )}
                  </button>
                  <div className="flex-grow flex items-center px-4 bg-black/45 rounded-xl border border-white/5 text-xs text-zinc-500">
                    {lat !== null && lng !== null ? (
                      <span className="text-white font-semibold">
                        Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
                      </span>
                    ) : (
                      <span>Coordinates capture required</span>
                    )}
                  </div>
                </div>
                {gpsError && <p className="text-[10px] text-red-500 mt-1">{gpsError}</p>}
              </div>

              {/* Media Attachments Input with SHA-256 Fingerprinting */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                  <span>Photo, Video & CCTV Evidence</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Auto SHA-256 Fingerprinted
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold text-white tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {uploadingMedia ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        INGESTING...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-emerald-400" />
                        SELECT FILE
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    LIVE CAMERA CAPTURE
                  </button>

                  <div className="flex-grow flex gap-2">
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Or paste media URL"
                      className="flex-grow px-4 py-3 bg-black/45 rounded-xl border border-white/5 outline-none text-xs text-white focus:border-white/15"
                    />
                    <button
                      type="button"
                      onClick={handleAddMedia}
                      className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer"
                    >
                      ADD
                    </button>
                  </div>
                </div>

                {/* Evidence preview count */}
                {evidenceLedger.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono flex items-center justify-between">
                    <span>{evidenceLedger.length} evidence file(s) fingerprinted with SHA-256</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Protocol Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Emergency Toggle */}
                <button
                  type="button"
                  onClick={() => setEmergencyFlag(!emergencyFlag)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                    emergencyFlag
                      ? "bg-red-500/10 border-red-500/40 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-black/35 border-white/5 text-zinc-500 hover:border-white/10"
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest">PRIORITY</span>
                    <h5 className="text-xs font-bold text-white">Emergency</h5>
                  </div>
                  <AlertTriangle className={`w-4 h-4 ${emergencyFlag ? "text-red-500" : "text-zinc-600"}`} />
                </button>

                {/* Public Anonymity Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setAnonymityFlag(!anonymityFlag);
                    if (whistleblowerMode) setWhistleblowerMode(false);
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                    anonymityFlag && !whistleblowerMode
                      ? "bg-white/5 border-white/20 text-white"
                      : "bg-black/35 border-white/5 text-zinc-500 hover:border-white/10"
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest">IDENTITY</span>
                    <h5 className="text-xs font-bold text-white">Anonymous</h5>
                  </div>
                  {anonymityFlag ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-zinc-600" />}
                </button>

                {/* Whistleblower Burner Key Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setWhistleblowerMode(!whistleblowerMode);
                    if (!whistleblowerMode) setAnonymityFlag(true);
                  }}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                    whistleblowerMode
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "bg-black/35 border-white/5 text-zinc-500 hover:border-white/10"
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest">PROTOCOL</span>
                    <h5 className="text-xs font-bold text-white">Whistleblower</h5>
                  </div>
                  <Shield className={`w-4 h-4 ${whistleblowerMode ? "text-amber-400" : "text-zinc-600"}`} />
                </button>
              </div>

              {whistleblowerMode && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-300 font-mono space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <KeyRound className="w-3.5 h-3.5" /> WHISTLEBLOWER BURNER PROTOCOL ACTIVE:
                  </div>
                  <p className="font-body text-zinc-300">
                    Your Firebase identity and IP will be completely disconnected from the report. You will receive a unique cryptographic Claim Secret upon dispatch.
                  </p>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold tracking-widest text-zinc-400 hover:text-white uppercase transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(255,255,255,0.15)] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> SUBMITTING...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> DISPATCH & SEAL
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* WHISTLEBLOWER RECEIPT SUCCESS MODAL */}
      {whistleblowerSuccessToken && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none font-body">
          <div className="liquid-glass w-full max-w-md p-8 rounded-3xl border border-amber-500/30 text-center space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.25)]">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">
                BURNER CLAIM RECEIPT GENERATED
              </span>
              <h3 className="font-display italic text-2xl text-white font-normal">
                Anonymous Whistleblower Key
              </h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Your incident report has been anchored anonymously with zero link to your real identity. 
              Copy and save this burner secret key. You can use it anytime to track police FIR filing, departmental progression, and forensic verification without logging in:
            </p>

            <div className="p-4 rounded-2xl bg-black/70 border border-amber-500/40 flex items-center justify-between font-mono text-sm text-amber-400 font-bold">
              <span>{whistleblowerSuccessToken}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(whistleblowerSuccessToken);
                  setTokenCopied(true);
                  setTimeout(() => setTokenCopied(false), 2500);
                }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                title="Copy Key"
              >
                {tokenCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => setWhistleblowerSuccessToken(null)}
              className="w-full py-3.5 bg-amber-500 text-black hover:bg-amber-400 rounded-xl text-xs font-bold tracking-widest uppercase cursor-pointer"
            >
              I Have Saved My Secret Key
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
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

      <WhistleblowerTrackModal
        isOpen={showWhistleblowerModal}
        onClose={() => setShowWhistleblowerModal(false)}
      />

      <LiveCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCaptured={(_file, url, _hash, record) => {
          setMediaUrls((prev) => [...prev, url]);
          if (record) {
            setEvidenceLedger((prev) => [...prev, record]);
          }
        }}
        lat={lat}
        lng={lng}
      />

    </div>
  );
};
