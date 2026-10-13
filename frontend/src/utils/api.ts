import axios from "axios";

// Default local FastAPI backend port, configurable via VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject the Auth token stored in local storage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("trinetra_auth_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
