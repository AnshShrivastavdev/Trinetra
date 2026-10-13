import React, { useState } from "react";
import { FileText, Loader2, X, AlertTriangle, Building2, Scale } from "lucide-react";
import { useReports } from "../hooks/useReports";

interface LodgeFirModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  category: string;
  onSuccess: () => void;
}

export const LodgeFirModal: React.FC<LodgeFirModalProps> = ({
  isOpen,
  onClose,
  reportId,
  category,
  onSuccess
}) => {
  const { lodgeFir } = useReports();
  const [policeStation, setPoliceStation] = useState("Central Police Station, Bengaluru");
  const [department, setDepartment] = useState("Local Police");
  const [sections, setSections] = useState("BNS 303 (Theft), BNS 351 (Criminal Intimidation)");
  const [remarks, setRemarks] = useState("Prima facie cognizable offence established. Formal FIR recorded.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const sectionList = sections.split(",").map(s => s.trim()).filter(Boolean);
      await lodgeFir(reportId, policeStation, sectionList, remarks, department);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Failed to lodge FIR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-body">
      <div className="liquid-glass w-full max-w-lg p-8 rounded-3xl space-y-6 border border-amber-500/30 max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(245,158,11,0.2)]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              OFFICIAL POLICE PROCEDURE
            </span>
            <h2 className="font-display italic text-2xl text-white font-normal">
              Lodge Formal First Information Report (FIR)
            </h2>
            <span className="text-xs text-zinc-400">Category: <strong className="text-white">{category}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white font-bold p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Mint an immutable First Information Report (FIR) into the incident ledger. This records a deterministic FIR registration number, assigns departmental jurisdiction, and triggers an immutable transition in the public audit trail.
        </p>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Building2 className="w-3 h-3 text-amber-400" /> Police Station Jurisdiction
            </label>
            <input
              type="text"
              required
              value={policeStation}
              onChange={(e) => setPoliceStation(e.target.value)}
              className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/10 outline-none text-xs text-white focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Scale className="w-3 h-3 text-amber-400" /> Applicable Penal Sections (Comma-separated)
            </label>
            <input
              type="text"
              required
              value={sections}
              onChange={(e) => setSections(e.target.value)}
              placeholder="e.g. BNS Section 303, BNS Section 351, IT Act 66D"
              className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/10 outline-none text-xs text-white focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Assign Specialized Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/10 outline-none text-xs text-white focus:border-amber-500/50 cursor-pointer"
            >
              <option value="Local Police" className="bg-zinc-900">Local Police Precinct</option>
              <option value="Cyber Crime Cell" className="bg-zinc-900">Cyber Crime Cell</option>
              <option value="Forensics Bureau" className="bg-zinc-900">Forensics & Ballistics Bureau</option>
              <option value="Judiciary / Court" className="bg-zinc-900">Judiciary / Magistrate Review</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Officer Remarks & Justification
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-4 py-3 bg-black/45 rounded-xl border border-white/10 outline-none text-xs text-white focus:border-amber-500/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-black font-bold text-xs tracking-wider uppercase hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> SEALING FIR ON-CHAIN...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" /> LODGE OFFICIAL FIR & SEAL BLOCK
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
