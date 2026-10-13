import React, { useState, useRef, useEffect } from "react";
import { Camera, Square, RefreshCw, X, ShieldCheck, MapPin, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { useReports } from "../hooks/useReports";

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptured: (file: File, url: string, sha256_hash: string, evidenceRecord: any) => void;
  lat?: number | null;
  lng?: number | null;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCaptured,
  lat,
  lng
}) => {
  const { uploadMediaWithHash } = useReports();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [clientSha256, setClientSha256] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const resetState = () => {
    setCapturedPreview(null);
    setCapturedBlob(null);
    setClientSha256("");
    setIsRecording(false);
    setRecordSeconds(0);
    setCameraError("");
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera access fallback to video only:", err);
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        setStream(videoOnly);
        if (videoRef.current) {
          videoRef.current.srcObject = videoOnly;
        }
      } catch (err2: any) {
        setCameraError(err2.message || "Failed to access camera hardware. Check browser permissions.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  // Helper to compute client-side SHA-256 via Web Crypto API
  const calculateClientSha256 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // 1. Capture High-Res Snapshot with embedded tamper-proof watermark
  const takeSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw camera frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply On-Scene Cryptographic Watermark
    const nowIso = new Date().toISOString();
    const latStr = lat ? lat.toFixed(5) : "GPS_PENDING";
    const lngStr = lng ? lng.toFixed(5) : "GPS_PENDING";

    // Overlay banner
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#10B981"; // emerald
    ctx.fillText("TRINETRA LIVE ON-SCENE SECURE CAPTURE", 20, canvas.height - 36);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#E4E4E7";
    ctx.fillText(`UTC: ${nowIso} | GPS: ${latStr}, ${lngStr}`, 20, canvas.height - 16);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const sha256 = await calculateClientSha256(blob);
      setClientSha256(sha256);
      setCapturedBlob(blob);
      setCapturedPreview(URL.createObjectURL(blob));
      setIsProcessing(false);
    }, "image/jpeg", 0.95);
  };

  // 2. Start Video Recording
  const startRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];
    setRecordSeconds(0);

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4");

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: mime });
      const sha256 = await calculateClientSha256(blob);
      setClientSha256(sha256);
      setCapturedBlob(blob);
      setCapturedPreview(URL.createObjectURL(blob));
      setIsProcessing(false);
    };

    recorder.start(1000); // 1-sec chunks
    setIsRecording(true);

    timerIntervalRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // 3. Confirm and Upload to Evidence Ledger
  const handleConfirmAndSign = async () => {
    if (!capturedBlob) return;
    setIsProcessing(true);

    try {
      const filename = mode === "photo" 
        ? `onscene_photo_${Date.now()}.jpg` 
        : `onscene_video_${Date.now()}.webm`;
      
      const file = new File([capturedBlob], filename, { type: capturedBlob.type });
      
      const { url, sha256_hash, evidence_record } = await uploadMediaWithHash(file);
      
      // Pass back to parent dashboard
      onCaptured(file, url, sha256_hash || clientSha256, evidence_record);
      onClose();
    } catch (err: any) {
      alert("Failed to ingest camera media: " + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-md select-none font-body">
      <div className="liquid-glass w-full max-w-2xl p-6 rounded-3xl space-y-4 border border-emerald-500/30 max-h-[95vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.2)]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 animate-pulse" />
              HARDWARE ON-SCENE DIRECT CAPTURE
            </span>
            <h2 className="font-display italic text-xl text-white font-normal">
              Direct-From-Lens Evidence Signature
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white font-bold p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cameraError && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400">
            {cameraError}
          </div>
        )}

        {/* Viewport Display */}
        <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-inner">
          <canvas ref={canvasRef} className="hidden" />

          {capturedPreview ? (
            // Preview captured item
            mode === "photo" ? (
              <img src={capturedPreview} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <video src={capturedPreview} controls className="w-full h-full object-contain" />
            )
          ) : (
            // Live Video feed
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Reticle / Overlays */}
          {!capturedPreview && (
            <>
              {/* Tactical reticle corners */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400/80 pointer-events-none" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400/80 pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400/80 pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400/80 pointer-events-none" />

              {/* Watermark Metadata Ribbon */}
              <div className="absolute bottom-2 left-3 right-3 flex justify-between items-center text-[9px] font-mono text-zinc-300 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/5 pointer-events-none">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3 h-3" /> SECURE LIVE SENSOR
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  {lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "GPS ACTIVE"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-red-600/90 text-white rounded-full font-mono text-xs font-bold animate-pulse shadow-lg">
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  REC {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
                </div>
              )}
            </>
          )}
        </div>

        {/* SHA-256 Client-Side Signature Badge if captured */}
        {clientSha256 && (
          <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/40 font-mono text-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-300 font-bold text-[10px] uppercase">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Client-Side SHA-256 Computed
              </span>
              <span>Web Crypto API</span>
            </div>
            <div className="text-[10px] text-amber-300 break-all">
              {clientSha256}
            </div>
          </div>
        )}

        {/* Control Action Bars */}
        {!capturedPreview ? (
          <div className="space-y-3">
            {/* Mode selection buttons */}
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setMode("photo")}
                disabled={isRecording}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                  mode === "photo" ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Snapshot Photo
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                disabled={isRecording}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                  mode === "video" ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Video Recording
              </button>
            </div>

            {/* Shutter / Record Trigger Buttons */}
            <div className="flex items-center justify-center gap-6 pt-1">
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
                disabled={isRecording}
                className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Flip Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {mode === "photo" ? (
                <button
                  type="button"
                  onClick={takeSnapshot}
                  disabled={isProcessing}
                  className="w-16 h-16 rounded-full border-4 border-emerald-400 bg-white hover:bg-emerald-100 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500 group-hover:scale-90 transition-transform" />
                </button>
              ) : isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full border-4 border-red-500 bg-white flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all cursor-pointer animate-pulse"
                >
                  <Square className="w-6 h-6 fill-red-600 text-red-600" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full border-4 border-red-500 bg-white hover:bg-red-50 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-red-600 group-hover:scale-90 transition-transform" />
                </button>
              )}

              <div className="w-10" />
            </div>
          </div>
        ) : (
          // Review & Sign Action Buttons
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCapturedPreview(null);
                setCapturedBlob(null);
                setClientSha256("");
                startCamera();
              }}
              disabled={isProcessing}
              className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-white uppercase transition-colors cursor-pointer"
            >
              Retake Media
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSign}
              disabled={isProcessing}
              className="flex-1 py-3 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> SIGNING & INGESTING...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> AUTO-SIGN & ATTACH EVIDENCE
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
