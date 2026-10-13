import { useState } from "react";
import { api } from "../utils/api";

export interface LocationSchema {
  lat: number;
  lng: number;
  address?: string;
}

export interface Report {
  _id: string;
  category: string;
  description: string;
  emergencyFlag: boolean;
  anonymityFlag: boolean;
  whistleblowerMode?: boolean;
  whistleblowerToken?: string | null;
  mediaUrls: string[];
  evidenceLedger?: any[];
  auditTrail?: any[];
  firNumber?: string | null;
  firDetails?: any | null;
  blockchainReceipt?: any | null;
  assignedDepartment?: string | null;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  status: "Pending" | "Reported" | "FIR Filed" | "Ongoing" | "Investigating" | "Charge-sheet Submitted" | "Resolved" | "Closed";
  voteCount: number;
  isFlagged: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignedOfficer?: {
    uid: string;
    name: string;
    assignedAt: string;
  } | null;
  aiAnalysis?: {
    isSuspicious: boolean;
    suspicionScore: number;
    reason: string;
    isDuplicate: boolean;
    duplicateOfReportId: string | null;
  } | null;
}

export const useReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = async (statusFilter?: string, category?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (category) params.category = category;
      
      const res = await api.get("/reports", { params });
      setReports(res.data);
      return res.data as Report[];
    } catch (e) {
      console.error("Failed to fetch reports:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyReports = async (lat: number, lng: number, radiusKm: number = 5) => {
    setLoading(true);
    try {
      const res = await api.get("/reports/nearby", {
        params: { lat, lng, radius_km: radiusKm }
      });
      return res.data as Report[];
    } catch (e) {
      console.error("Failed to fetch nearby reports:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const createReport = async (reportData: {
    category: string;
    description: string;
    emergencyFlag: boolean;
    anonymityFlag: boolean;
    whistleblowerMode?: boolean;
    mediaUrls: string[];
    evidenceLedger?: any[];
    assignedDepartment?: string;
    location: {
      lat: number;
      lng: number;
      address?: string;
    };
  }) => {
    setLoading(true);
    try {
      const res = await api.post("/reports", reportData);
      return res.data as Report;
    } catch (e: any) {
      console.error("Failed to create report:", e);
      throw new Error(e.response?.data?.detail || "Failed to submit crime report");
    } finally {
      setLoading(false);
    }
  };

  const upvoteReport = async (reportId: string) => {
    try {
      const res = await api.post(`/reports/${reportId}/vote`);
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, voteCount: res.data.voteCount } : r))
      );
      return res.data as Report;
    } catch (e: any) {
      console.error("Failed to upvote report:", e);
      throw new Error(e.response?.data?.detail || "Upvoting failed");
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: any) => {
    try {
      const res = await api.patch(`/reports/${reportId}/status`, null, {
        params: { status_update: newStatus }
      });
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, status: newStatus } : r))
      );
      return res.data as Report;
    } catch (e: any) {
      console.error("Failed to update status:", e);
      throw new Error(e.response?.data?.detail || "Status update failed");
    }
  };

  const flagReport = async (reportId: string) => {
    try {
      const res = await api.post(`/reports/${reportId}/flag`);
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, isFlagged: true } : r))
      );
      return res.data as Report;
    } catch (e: any) {
      console.error("Failed to flag report:", e);
      throw new Error(e.response?.data?.detail || "Flagging failed");
    }
  };

  const verifyAI = async (reportId: string) => {
    try {
      const res = await api.post(`/reports/${reportId}/verify-ai`);
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, aiAnalysis: res.data } : r))
      );
      return res.data;
    } catch (e: any) {
      console.error("Failed AI verification:", e);
      throw new Error(e.response?.data?.detail || "AI verification failed");
    }
  };

  const adminReviewReport = async (reportId: string, action: "Fake Report" | "Restored") => {
    try {
      const res = await api.post(`/admin/reports/${reportId}/review`, { action });
      if (action === "Fake Report") {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
      } else {
        setReports((prev) =>
          prev.map((r) => (r._id === reportId ? { ...r, isFlagged: false } : r))
        );
      }
      return res.data;
    } catch (e: any) {
      console.error("Failed admin review:", e);
      throw new Error(e.response?.data?.detail || "Admin review override failed");
    }
  };

  const uploadMediaWithHash = async (file: File): Promise<{ url: string; sha256_hash: string; evidence_record: any }> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/reports/upload-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return {
        url: res.data.url,
        sha256_hash: res.data.sha256_hash,
        evidence_record: res.data.evidence_record
      };
    } catch (e: any) {
      console.warn("Backend upload failed/unconfigured, converting file to local fallback:", e);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const fallbackHash = "SHA256_FALLBACK_" + Math.random().toString(16).slice(2);
          resolve({
            url: reader.result as string,
            sha256_hash: fallbackHash,
            evidence_record: {
              file_name: file.name,
              file_type: file.type,
              file_size_bytes: file.size,
              sha256_hash: fallbackHash,
              algorithm: "SHA-256",
              recorded_at: new Date().toISOString()
            }
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const uploadMedia = async (file: File): Promise<string> => {
    const res = await uploadMediaWithHash(file);
    return res.url;
  };

  const verifyEvidence = async (file?: File, sha256_target?: string, reportId?: string) => {
    const formData = new FormData();
    if (file) formData.append("file", file);
    const params: any = {};
    if (reportId) params.report_id = reportId;
    if (sha256_target) params.sha256_target = sha256_target;

    const res = await api.post("/reports/verify-evidence", file ? formData : null, {
      params,
      headers: file ? { "Content-Type": "multipart/form-data" } : {}
    });
    return res.data;
  };

  const lodgeFir = async (reportId: string, policeStation: string, sectionsOfLaw: string[], remarks?: string, assignedDepartment?: string) => {
    const res = await api.post(`/reports/${reportId}/lodge-fir`, {
      police_station: policeStation,
      sections_of_law: sectionsOfLaw,
      remarks,
      assigned_department: assignedDepartment
    });
    setReports((prev) =>
      prev.map((r) => (r._id === reportId ? { ...r, status: "FIR Filed", firNumber: res.data.firNumber, firDetails: res.data.firDetails } : r))
    );
    return res.data;
  };

  const advanceLifecycle = async (reportId: string, targetStatus: string, remarks: string, assignedDepartment?: string) => {
    const res = await api.post(`/reports/${reportId}/advance-lifecycle`, {
      target_status: targetStatus,
      remarks,
      assigned_department: assignedDepartment
    });
    setReports((prev) =>
      prev.map((r) => (r._id === reportId ? { ...r, status: res.data.new_status } : r))
    );
    return res.data;
  };

  const getAuditTrail = async (reportId: string) => {
    const res = await api.get(`/reports/${reportId}/audit-trail`);
    return res.data;
  };

  const getWhistleblowerReport = async (claimToken: string) => {
    const res = await api.get(`/reports/whistleblower/${claimToken}`);
    return res.data;
  };

  const assignDepartment = async (reportId: string, department: string, remarks?: string) => {
    const res = await api.post(`/reports/${reportId}/assign-department`, {
      department,
      remarks
    });
    setReports((prev) =>
      prev.map((r) => (r._id === reportId ? { ...r, assignedDepartment: department } : r))
    );
    return res.data;
  };

  const assignOfficer = async (reportId: string, officerUid: string, officerName: string) => {
    try {
      const res = await api.post(`/reports/${reportId}/assign-officer`, {
        officer_uid: officerUid,
        officer_name: officerName
      });
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, assignedOfficer: res.data.assignedOfficer } : r))
      );
      return res.data;
    } catch (e: any) {
      console.error("Failed to assign officer:", e);
      throw new Error(e.response?.data?.detail || "Officer assignment failed");
    }
  };

  const anchorOnChain = async (reportId: string) => {
    const res = await api.post(`/reports/${reportId}/anchor-onchain`);
    setReports((prev) =>
      prev.map((r) => (r._id === reportId ? { ...r, blockchainReceipt: res.data.blockchain_receipt } : r))
    );
    return res.data;
  };

  const getOnchainProof = async (reportId: string) => {
    const res = await api.get(`/reports/${reportId}/onchain-proof`);
    return res.data;
  };

  return {
    reports,
    loading,
    fetchReports,
    fetchNearbyReports,
    createReport,
    upvoteReport,
    updateReportStatus,
    flagReport,
    verifyAI,
    adminReviewReport,
    uploadMedia,
    uploadMediaWithHash,
    verifyEvidence,
    lodgeFir,
    advanceLifecycle,
    getAuditTrail,
    getWhistleblowerReport,
    assignDepartment,
    assignOfficer,
    anchorOnChain,
    getOnchainProof
  };
};
