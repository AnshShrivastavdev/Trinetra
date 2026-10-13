import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, X, Mail, Phone, Key, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    sendOtp, 
    verifyOtp,
    loginWithFirebaseGoogle
  } = useAuth();
  
  const [role, setRole] = useState<"citizen" | "authority" | "admin">("citizen");
  const [otpChannel, setOtpChannel] = useState<"mobile" | "email">("mobile");
  
  // OTP state machine: 1 = Enter Identifier, 2 = Enter 6-digit OTP
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [name, setName] = useState("");
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isTactical = role === "authority" || role === "admin";
  const btnAccentClass = isTactical
    ? "bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
    : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]";
  const iconColor = isTactical ? "text-amber-500" : "text-white/60";

  // Google Sign-In
  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      await loginWithFirebaseGoogle(role);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Google Sign-In failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setDevOtpNotice(null);

    const targetIdentifier = role === "admin" ? "anshshrivastav9480@gmail.com" : identifier.trim();
    const targetName = role === "admin" ? "System Admin (Ansh)" : name.trim();

    if (role !== "admin" && !targetName) {
      setErrorMsg(role === "authority" ? "Police Station Name is required." : "Full Name is required.");
      return;
    }

    if (!targetIdentifier) {
      setErrorMsg(otpChannel === "mobile" ? "Mobile number is required." : "Email address is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendOtp(targetIdentifier, role);
      setSuccessMsg(res.message || "Verification OTP code sent.");
      if (res.otp_code) {
        setOtpCode(res.otp_code);
        setDevOtpNotice(res.otp_code);
      }
      setOtpStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!otpCode.trim()) {
      setErrorMsg("Please enter the 6-digit OTP code.");
      return;
    }

    const targetIdentifier = role === "admin" ? "anshshrivastav9480@gmail.com" : identifier.trim();
    const targetName = role === "admin" ? "System Admin (Ansh)" : name.trim();

    setIsSubmitting(true);
    try {
      await verifyOtp(targetIdentifier, otpCode.trim(), targetName || undefined, role);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "OTP verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`liquid-glass w-full max-w-md p-8 rounded-3xl relative border transition-all duration-500 overflow-hidden ${
          isTactical ? "liquid-glass-glow-amber border-amber-500/20" : "border-white/10"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="space-y-1 mb-6">
          <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">ACCESS PROTOCOL</span>
          <h2 className="font-display italic text-3xl text-white font-normal tracking-wide">
            {role === "admin" ? "Control Unit Login" : role === "authority" ? "Authority Dispatch Portal" : "Citizen Security Hub"}
          </h2>
        </div>

        {/* 3-way Role Selector */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-black/40 border border-white/5 mb-6">
          <button
            type="button"
            onClick={() => setRole("citizen")}
            className={`py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
              role === "citizen" ? "text-black bg-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Citizen
          </button>
          <button
            type="button"
            onClick={() => setRole("authority")}
            className={`py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
              role === "authority" ? "text-black bg-amber-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Authority
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all ${
              role === "admin" ? "text-black bg-amber-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Admin
          </button>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-body text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-3 transition-colors cursor-pointer mb-5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
          </svg>
          <span>Sign in with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4 text-[10px] text-zinc-500 uppercase tracking-widest">
          <div className="flex-1 h-px bg-white/10" />
          <span>OR SIGN IN WITH OTP</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* OTP Channel Switcher (Mobile OTP vs Email OTP) */}
        <div className="flex gap-2 p-1 rounded-xl bg-black/60 border border-white/5 mb-5 text-[11px] font-bold tracking-wider uppercase">
          <button
            type="button"
            onClick={() => { setOtpChannel("mobile"); setOtpStep(1); setErrorMsg(""); setSuccessMsg(""); setIdentifier(""); }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              otpChannel === "mobile" ? "bg-white/20 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Mobile Number OTP</span>
          </button>
          <button
            type="button"
            onClick={() => { setOtpChannel("email"); setOtpStep(1); setErrorMsg(""); setSuccessMsg(""); setIdentifier(""); }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              otpChannel === "email" ? "bg-white/20 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email OTP</span>
          </button>
        </div>

        {/* Error and Success Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* STEP 1: Enter Mobile / Email */}
        {otpStep === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {/* Input 1: Identifier or Protected Admin ID */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {role === "admin" ? "Designated Admin ID (Protected)" : otpChannel === "mobile" ? "Mobile Phone Number" : "Email Address"}
              </label>
              <div className="relative flex items-center">
                {role === "admin" || otpChannel === "email" ? (
                  <Mail className={`absolute left-3 w-4 h-4 ${iconColor}`} />
                ) : (
                  <Phone className={`absolute left-3 w-4 h-4 ${iconColor}`} />
                )}
                <input
                  type={role === "admin" ? "password" : otpChannel === "email" ? "email" : "text"}
                  required
                  readOnly={role === "admin"}
                  value={role === "admin" ? "••••••••••••••••••••••••••••" : identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={otpChannel === "mobile" ? "+919876543210" : "user@domain.com"}
                  className={`w-full pl-10 pr-4 py-3 bg-black/40 rounded-xl border border-white/10 outline-none text-xs text-white placeholder-zinc-600 transition-colors ${
                    role === "admin" ? "border-amber-500/40 text-amber-300 font-mono tracking-widest" : "focus:border-amber-500/50"
                  }`}
                />
              </div>
            </div>

            {/* Input 2: Full Name or Police Station Name (Hidden for Admin) */}
            {role !== "admin" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {role === "authority" ? "Police Station Name" : "Full Name"}
                </label>
                <div className="relative flex items-center">
                  <User className={`absolute left-3 w-4 h-4 ${iconColor}`} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === "authority" ? "e.g., Central Police Station, Precinct 5" : "Enter full name"}
                    className="w-full pl-10 pr-4 py-3 bg-black/40 rounded-xl border border-white/10 focus:border-amber-500/50 outline-none text-xs text-white placeholder-zinc-600 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-xl font-body text-xs font-bold tracking-widest uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${btnAccentClass}`}
            >
              {isSubmitting ? "SENDING CODE..." : role === "admin" ? "SEND ADMIN OTP" : `SEND ${otpChannel === "mobile" ? "MOBILE" : "EMAIL"} OTP`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* STEP 2: Enter 6-digit OTP Code */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-zinc-300 space-y-1">
              <div>
                Enter the 6-digit verification code sent to <span className="font-bold text-white">{role === "admin" ? "Designated Admin Channel" : identifier}</span>:
              </div>
              {devOtpNotice && (
                <div className="text-[11px] font-mono text-emerald-400 pt-1 flex items-center gap-1.5 border-t border-white/5 mt-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dev Mode: Code <strong className="text-white bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">{devOtpNotice}</strong> auto-filled below.</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                6-Digit Verification Code
              </label>
              <div className="relative flex items-center">
                <Key className={`absolute left-3 w-4 h-4 ${iconColor}`} />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 rounded-xl border border-white/10 focus:border-amber-500/50 outline-none text-sm text-white placeholder-zinc-600 tracking-widest font-mono transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOtpStep(1)}
                className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-400 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-3.5 rounded-xl font-body text-xs font-bold tracking-widest uppercase transition-all cursor-pointer flex items-center justify-center gap-2 ${btnAccentClass}`}
              >
                {isSubmitting ? "VERIFYING..." : "VERIFY OTP & SIGN IN"}
                <ShieldCheck className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
