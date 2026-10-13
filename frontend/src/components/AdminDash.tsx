import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useReports } from "../hooks/useReports";
import type { Report } from "../hooks/useReports";
import { api } from "../utils/api";
import { 
  Users, AlertTriangle, ShieldCheck, Download, Trash2, 
  Ban, RefreshCw, Loader2, LogOut, CheckCircle2 
} from "lucide-react";

interface AdminStats {
  users: {
    citizens: number;
    authorities: {
      total: number;
      pending: number;
      approved: number;
    } | number;
  };
  reports: {
    total: number;
    flagged: number;
    byStatus?: {
      pending: number;
      ongoing: number;
      resolved: number;
    };
  };
}

interface PendingAuthority {
  firebase_uid: string;
  name: string;
  email: string;
  createdAt: string;
  is_approved: boolean;
}

export const AdminDash: React.FC = () => {
  const { user, logout } = useAuth();
  const { fetchReports, adminReviewReport } = useReports();
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingAuthorities, setPendingAuthorities] = useState<PendingAuthority[]>([]);
  const [flaggedReports, setFlaggedReports] = useState<Report[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [loadingFlagged, setLoadingFlagged] = useState(false);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch (e) {
      console.error("Failed to load admin stats", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const res = await api.get("/auth/authority/pending");
      setPendingAuthorities(res.data);
    } catch (e) {
      console.error("Failed to load approvals", e);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const loadFlaggedReports = async () => {
    setLoadingFlagged(true);
    try {
      const allReports = await fetchReports();
      setFlaggedReports(allReports.filter((r: Report) => r.isFlagged));
    } catch (e) {
      console.error("Failed to load flagged reports", e);
    } finally {
      setLoadingFlagged(false);
    }
  };

  const loadUsersList = async () => {
    try {
      const res = await api.get("/admin/users");
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setUsersList(res.data);
      } else {
        setUsersList([
          { firebase_uid: "citizen001", name: "Alice Smith", email: "alice@example.com", role: "citizen", is_active: true, is_approved: true },
          { firebase_uid: "citizen002", name: "Bob Jones", email: "bob@example.com", role: "citizen", is_active: true, is_approved: true },
          { firebase_uid: "authority123", name: "Officer Miller", email: "miller@example.com", role: "authority", is_active: true, is_approved: true }
        ]);
      }
    } catch (e) {
      console.error("Failed to load user list:", e);
    }
  };

  const handleAssignRole = async (firebaseUid: string, newRole: "citizen" | "authority" | "admin") => {
    try {
      await api.post(`/admin/users/${firebaseUid}/assign-role`, { role: newRole });
      alert(`User role updated to ${newRole} & approved!`);
      setUsersList((prev) =>
        prev.map((u) => (u.firebase_uid === firebaseUid ? { ...u, role: newRole, is_approved: true } : u))
      );
      loadApprovals();
      loadStats();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Role assignment failed");
    }
  };

  const syncAll = () => {
    loadStats();
    loadApprovals();
    loadFlaggedReports();
    loadUsersList();
  };

  useEffect(() => {
    syncAll();
  }, []);

  const handleApproveAuthority = async (firebaseUid: string) => {
    try {
      await api.post(`/auth/authority/${firebaseUid}/approve`);
      alert("Authority profile approved successfully.");
      loadApprovals();
      loadStats();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Approval failed");
    }
  };

  const handleReviewFlagged = async (reportId: string, action: "Fake Report" | "Restored") => {
    try {
      await adminReviewReport(reportId, action);
      alert(`Report marked as: ${action}`);
      loadFlaggedReports();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleUserActive = async (firebaseUid: string) => {
    try {
      const res = await api.post(`/admin/users/${firebaseUid}/toggle-active`);
      alert(res.data.message);
      // Update local state toggle
      setUsersList((prev) =>
        prev.map((u) => (u.firebase_uid === firebaseUid ? { ...u, is_active: res.data.is_active } : u))
      );
    } catch (e: any) {
      alert(e.response?.data?.detail || "Toggle active status failed");
    }
  };

  const handleDeleteUser = async (firebaseUid: string) => {
    if (!confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/users/${firebaseUid}`);
      alert("User profile and associated votes deleted.");
      setUsersList((prev) => prev.filter((u) => u.firebase_uid !== firebaseUid));
      loadStats();
    } catch (e: any) {
      alert(e.response?.data?.detail || "User deletion failed");
    }
  };

  // CSV Exporter helper
  const handleExportCsv = (type: "citizens" | "authorities" | "resolved_reports") => {
    // We fetch it via axios blob and save it locally
    api.get(`/admin/export/csv`, {
      params: { type },
      responseType: "blob"
    })
    .then((res) => {
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.setAttribute("download", `${type}.csv`);
      tempLink.click();
    })
    .catch((e) => {
      console.error(e);
      alert("Failed to export CSV. Please check admin permissions.");
    });
  };

  return (
    <div className="min-h-screen bg-primary-bg text-slate-100 p-6 md:p-12 relative select-none">
      
      {/* Background Subtle Gradient Emitters */}
      <div className="absolute top-[5%] left-[5%] w-[400px] h-[400px] bg-white/2 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10 font-body">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-white/5 pb-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">SYSTEM ADMINISTRATOR</span>
            <h1 className="font-display italic text-4xl text-white font-normal tracking-wide">
              Control Center
            </h1>
            <p className="text-xs text-zinc-500 font-body">Console UID: <span className="text-white font-semibold">{user?.firebase_uid}</span></p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={syncAll}
              className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Sync Dashboard"
            >
              <RefreshCw className="w-4 h-4" />
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

        {/* 1. STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Total Citizens */}
          <div className="liquid-glass p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">CITIZENS</span>
              <h4 className="text-2xl font-bold text-white font-body">
                {loadingStats ? "..." : stats?.users.citizens || 0}
              </h4>
            </div>
            <Users className="w-8 h-8 text-zinc-600" />
          </div>

          {/* Total Authorities */}
          <div className="liquid-glass p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">OFFICERS</span>
              <h4 className="text-2xl font-bold text-white font-body">
                {loadingStats ? "..." : typeof stats?.users.authorities === "object" ? stats.users.authorities.total : (stats?.users.authorities || 0)}
              </h4>
            </div>
            <ShieldCheck className="w-8 h-8 text-zinc-600" />
          </div>

          {/* Total Flagged Reports */}
          <div className={`liquid-glass p-5 rounded-2xl flex items-center justify-between border ${stats?.reports.flagged ? 'border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-white/5'}`}>
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">FLAGGED CASE</span>
              <h4 className="text-2xl font-bold text-white font-body">
                {loadingStats ? "..." : stats?.reports.flagged || 0}
              </h4>
            </div>
            <AlertTriangle className={`w-8 h-8 ${stats?.reports.flagged ? "text-amber-500" : "text-zinc-600"}`} />
          </div>

          {/* Total Incidents */}
          <div className="liquid-glass p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">INCIDENTS</span>
              <h4 className="text-2xl font-bold text-white font-body">
                {loadingStats ? "..." : stats?.reports.total || 0}
              </h4>
            </div>
            <CheckCircle2 className="w-8 h-8 text-zinc-600" />
          </div>
        </div>

        {/* 2. LOWER SUB-GRIDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Approval Queue */}
          <div className="liquid-glass p-6 rounded-3xl space-y-6">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">PENDING OFFICER APPROVALS</h3>
            {loadingApprovals ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
            ) : pendingAuthorities.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No pending officer approvals.</p>
            ) : (
              <div className="space-y-4">
                {pendingAuthorities.map((auth) => (
                  <div key={auth.firebase_uid} className="flex justify-between items-center p-4 bg-black/35 rounded-xl border border-white/5">
                    <div>
                      <h4 className="text-xs font-bold text-white">{auth.name}</h4>
                      <p className="text-[10px] text-zinc-500">{auth.email}</p>
                    </div>
                    <button
                      onClick={() => handleApproveAuthority(auth.firebase_uid)}
                      className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flagged Review Queue */}
          <div className="liquid-glass p-6 rounded-3xl space-y-6">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">FLAGGED REPORTS REVIEWS</h3>
            {loadingFlagged ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
            ) : flaggedReports.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No reports flagged as suspicious.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                {flaggedReports.map((report) => (
                  <div key={report._id} className="p-4 bg-black/35 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase">{report.category}</span>
                      <span className="text-[9px] text-zinc-500">Votes: {report.voteCount}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 italic">"{report.description}"</p>
                    {report.aiAnalysis && (
                      <p className="text-[9px] text-amber-500 font-semibold leading-normal">
                        Gemini Reason: "{report.aiAnalysis.reason}"
                      </p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleReviewFlagged(report._id, "Restored")}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-bold tracking-wider text-white uppercase cursor-pointer"
                      >
                        Restore Clean
                      </button>
                      <button
                        onClick={() => handleReviewFlagged(report._id, "Fake Report")}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg text-[9px] font-bold tracking-wider text-red-500 uppercase cursor-pointer"
                      >
                        Delete Fake
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 3. CSV EXPORTS & USER SUSPENSIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* CSV Download Trigger Box */}
          <div className="liquid-glass p-6 rounded-3xl space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">CSV EXPORT UTILITIES</h3>
              <p className="text-[11px] text-zinc-500 leading-normal">Stream incident logs and citizen/officer profiles directly into CSV downloads.</p>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => handleExportCsv("citizens")}
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest text-white uppercase flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Citizens List</span>
                <Download className="w-3.5 h-3.5 text-zinc-500" />
              </button>
              <button
                onClick={() => handleExportCsv("authorities")}
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest text-white uppercase flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Officers List</span>
                <Download className="w-3.5 h-3.5 text-zinc-500" />
              </button>
              <button
                onClick={() => handleExportCsv("resolved_reports")}
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest text-white uppercase flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Resolved Reports</span>
                <Download className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          </div>

          {/* User Management Suspension (Direct Endpoint Verification) */}
          <div className="lg:col-span-2 liquid-glass p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">USER ACCOUNTS SECURITY</h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto no-scrollbar">
              {usersList.map((u) => (
                <div key={u.firebase_uid} className="flex justify-between items-center p-3.5 bg-black/35 rounded-xl border border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{u.name}</h4>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 font-extrabold uppercase">
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role Selector / Promoter */}
                    <select
                      value={u.role || "citizen"}
                      onChange={(e) => handleAssignRole(u.firebase_uid, e.target.value as any)}
                      className="px-2 py-1 bg-black/60 border border-white/10 rounded text-[10px] text-amber-400 font-bold uppercase cursor-pointer outline-none"
                    >
                      <option value="citizen" className="bg-zinc-900 text-white">Citizen</option>
                      <option value="authority" className="bg-zinc-900 text-white">Officer (Authority)</option>
                      <option value="admin" className="bg-zinc-900 text-white">Admin</option>
                    </select>
                    {/* Toggle Active status */}
                    <button
                      onClick={() => handleToggleUserActive(u.firebase_uid)}
                      className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                        u.is_active 
                          ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      }`}
                      title={u.is_active ? "Suspend User" : "Re-activate User"}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete Citizen */}
                    <button
                      onClick={() => handleDeleteUser(u.firebase_uid)}
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/15 transition-colors cursor-pointer"
                      title="Permanently Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
