import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";
import { connectSocket, disconnectSocket } from "../utils/socket";
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "../utils/firebase";

interface UserProfile {
  _id?: string;
  firebase_uid: string;
  email: string;
  name: string;
  role: "citizen" | "authority" | "admin" | "unregistered";
  is_approved: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithMock: (role: "citizen" | "authority" | "admin", uid: string, name: string) => Promise<UserProfile>;
  sendOtp: (identifier: string, role?: "citizen" | "authority" | "admin") => Promise<any>;
  verifyOtp: (identifier: string, otpCode: string, name?: string, role?: "citizen" | "authority" | "admin") => Promise<UserProfile>;
  loginWithFirebaseGoogle: (role?: "citizen" | "authority" | "admin") => Promise<UserProfile>;
  loginWithFirebaseEmail: (email: string, pass: string, role?: "citizen" | "authority" | "admin") => Promise<UserProfile>;
  registerWithFirebaseEmail: (email: string, pass: string, name: string, role?: "citizen" | "authority") => Promise<UserProfile>;
  logout: () => void;
  syncProfile: (role: "citizen" | "authority", name: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<UserProfile | null>;
  switchRole: (newRole: "citizen" | "authority" | "admin") => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("trinetra_auth_token"));
  const [loading, setLoading] = useState(true);

  // Initialize socket and fetch user on load if token exists
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          connectSocket(token);
          const res = await api.get("/auth/me");
          setUser(res.data);
        } catch (e) {
          console.error("Failed to restore session:", e);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const loginWithMock = async (role: "citizen" | "authority" | "admin", uid: string, name: string) => {
    setLoading(true);
    try {
      const email = `${uid}@example.com`;
      const mockToken = `mock_token_${role}_${uid}_${email}`;
      
      localStorage.setItem("trinetra_auth_token", mockToken);
      setToken(mockToken);
      connectSocket(mockToken);

      const res = await api.post("/auth/sync", { role, name }, {
        headers: { Authorization: `Bearer ${mockToken}` }
      });
      
      setUser(res.data);
      setLoading(false);
      return res.data;
    } catch (e: any) {
      logout();
      setLoading(false);
      throw new Error(e.response?.data?.detail || "Mock authentication failed");
    }
  };

  const loginWithFirebaseGoogle = async (role: "citizen" | "authority" | "admin" = "citizen") => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseToken = await result.user.getIdToken();
      const name = result.user.displayName || "Google User";
      
      localStorage.setItem("trinetra_auth_token", firebaseToken);
      setToken(firebaseToken);
      connectSocket(firebaseToken);

      const res = await api.post("/auth/sync", { role, name }, {
        headers: { Authorization: `Bearer ${firebaseToken}` }
      });

      setUser(res.data);
      setLoading(false);
      return res.data;
    } catch (e: any) {
      setLoading(false);
      throw new Error(e.message || "Google Authentication failed");
    }
  };

  const loginWithFirebaseEmail = async (emailInput: string, passwordInput: string, role: "citizen" | "authority" | "admin" = "citizen") => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      const firebaseToken = await userCredential.user.getIdToken();
      const name = userCredential.user.displayName || emailInput.split("@")[0];

      localStorage.setItem("trinetra_auth_token", firebaseToken);
      setToken(firebaseToken);
      connectSocket(firebaseToken);

      const res = await api.post("/auth/sync", { role, name }, {
        headers: { Authorization: `Bearer ${firebaseToken}` }
      });

      setUser(res.data);
      setLoading(false);
      return res.data;
    } catch (e: any) {
      setLoading(false);
      throw new Error(e.message || "Firebase Email login failed");
    }
  };

  const registerWithFirebaseEmail = async (emailInput: string, passwordInput: string, nameInput: string, role: "citizen" | "authority" = "citizen") => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
      const firebaseToken = await userCredential.user.getIdToken();

      localStorage.setItem("trinetra_auth_token", firebaseToken);
      setToken(firebaseToken);
      connectSocket(firebaseToken);

      const res = await api.post("/auth/sync", { role, name: nameInput }, {
        headers: { Authorization: `Bearer ${firebaseToken}` }
      });

      setUser(res.data);
      setLoading(false);
      return res.data;
    } catch (e: any) {
      setLoading(false);
      throw new Error(e.message || "Firebase Registration failed");
    }
  };

  const sendOtp = async (identifier: string, role: "citizen" | "authority" | "admin" = "citizen") => {
    const res = await api.post("/auth/send-otp", { identifier, role });
    return res.data;
  };

  const verifyOtp = async (identifier: string, otpCode: string, name?: string, role: "citizen" | "authority" | "admin" = "citizen") => {
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        identifier,
        otp_code: otpCode,
        name,
        role
      });
      const newToken = res.data.token;
      localStorage.setItem("trinetra_auth_token", newToken);
      setToken(newToken);
      connectSocket(newToken);
      setUser(res.data.user);
      setLoading(false);
      return res.data.user;
    } catch (e: any) {
      setLoading(false);
      throw new Error(e.response?.data?.detail || "OTP verification failed");
    }
  };

  const syncProfile = async (role: "citizen" | "authority", name: string) => {
    try {
      const res = await api.post("/auth/sync", { role, name });
      setUser(res.data);
      return res.data;
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || "Sync onboarding failed");
    }
  };

  const refreshProfile = async () => {
    if (!token) return null;
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      return res.data;
    } catch (e) {
      return null;
    }
  };

  const switchRole = async (newRole: "citizen" | "authority" | "admin") => {
    if (!user) throw new Error("No authenticated user session.");
    try {
      const res = await api.post("/auth/sync", {
        role: newRole,
        name: user.name || "System Admin (Ansh)"
      });
      setUser(res.data);
      return res.data;
    } catch (e: any) {
      const updated = { ...user, role: newRole, is_approved: true };
      setUser(updated);
      return updated;
    }
  };

  const logout = () => {
    try {
      signOut(auth);
    } catch (e) {}
    localStorage.removeItem("trinetra_auth_token");
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginWithMock,
        sendOtp,
        verifyOtp,
        loginWithFirebaseGoogle,
        loginWithFirebaseEmail,
        registerWithFirebaseEmail,
        logout,
        syncProfile,
        refreshProfile,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
