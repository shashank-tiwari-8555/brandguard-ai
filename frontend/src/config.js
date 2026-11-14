// Centralized API Base URL configuration for local development and production deployment
const envApiUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL = (envApiUrl && envApiUrl.trim())
  ? envApiUrl.trim().replace(/\/+$/, "")
  : (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "http://127.0.0.1:8000");

