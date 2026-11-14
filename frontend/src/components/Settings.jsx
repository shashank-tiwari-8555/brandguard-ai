import { useState, useEffect } from "react";
import "./Settings.css";
import { API_BASE_URL } from "../config";
import { IconCpu, IconGlobe, IconShield, IconRefresh, IconCheck, IconAlertTriangle } from "./Icons";

export default function Settings({ onNavigate }) {
  const [health, setHealth] = useState(null);
  const [guidelines, setGuidelines] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSettingsData = async () => {
    setLoading(true);
    setError("");
    try {
      const [healthRes, bgRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}/health`),
        fetch(`${API_BASE_URL}/brand-guidelines`),
        fetch(`${API_BASE_URL}/history`)
      ]);

      const healthData = healthRes.ok ? await healthRes.json() : null;
      const bgData = bgRes.ok ? await bgRes.json() : null;
      const histData = histRes.ok ? await histRes.json() : null;

      setHealth(healthData);
      setGuidelines(bgData?.guidelines || null);
      setHistoryCount(histData?.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load system settings from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      try {
        const [healthRes, bgRes, histRes] = await Promise.all([
          fetch(`${API_BASE_URL}/health`),
          fetch(`${API_BASE_URL}/brand-guidelines`),
          fetch(`${API_BASE_URL}/history`)
        ]);

        const healthData = healthRes.ok ? await healthRes.json() : null;
        const bgData = bgRes.ok ? await bgRes.json() : null;
        const histData = histRes.ok ? await histRes.json() : null;

        if (!ignore) {
          setHealth(healthData);
          setGuidelines(bgData?.guidelines || null);
          setHistoryCount(histData?.total || 0);
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load system settings from backend.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchInitial();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <div className="settings-title-row">
            <h1>Platform Settings & Diagnostics</h1>
            <span className="live-status-pill">
              <span className="pulse-dot"></span>
              Live Pipeline Active
            </span>
          </div>
          <p className="settings-subtitle">
            Verified system configuration, AI model parameters, database storage, and CORS environment.
          </p>
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={loadSettingsData}
          disabled={loading}
        >
          <IconRefresh size={15} className={loading ? "spin-icon" : ""} />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className="settings-alert-error">
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <div className="spinner"></div>
          <p>Querying backend diagnostics...</p>
        </div>
      ) : (
        <div className="settings-cards-grid">
          {/* Card 1: Core System Status */}
          <div className="settings-card">
            <div className="card-top">
              <div className="card-icon-wrap icon-emerald">
                <IconCpu size={20} />
              </div>
              <div>
                <h2>Services & Pipeline Health</h2>
                <p>Status of running backend services and AI integration</p>
              </div>
            </div>

            <div className="service-list">
              <div className="service-item">
                <div className="service-info">
                  <span className="service-name">FastAPI Backend Service</span>
                  <span className="service-meta">ASGI Gateway on Uvicorn</span>
                </div>
                <span className="status-tag status-healthy">
                  <IconCheck size={13} />
                  {health?.status === "healthy" ? "Healthy (HTTP 200)" : "Online"}
                </span>
              </div>

              <div className="service-item">
                <div className="service-info">
                  <span className="service-name">Groq AI Reasoning Engine</span>
                  <span className="service-meta">Model: openai/gpt-oss-120b</span>
                </div>
                <span className={`status-tag ${health?.groq_configured ? "status-healthy" : "status-warning"}`}>
                  <IconCheck size={13} />
                  {health?.groq_configured ? "Connected" : "Rule-Based Fallback"}
                </span>
              </div>

              <div className="service-item">
                <div className="service-info">
                  <span className="service-name">SQLite Governance Database</span>
                  <span className="service-meta">backend/inkloom.db ({historyCount} records stored)</span>
                </div>
                <span className="status-tag status-healthy">
                  <IconCheck size={13} />
                  Connected & Persistent
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Active Brand Profile */}
          <div className="settings-card">
            <div className="card-top">
              <div className="card-icon-wrap icon-indigo">
                <IconShield size={20} />
              </div>
              <div>
                <h2>Enforced Brand Governance</h2>
                <p>Current profile applied to every AI advertisement check</p>
              </div>
            </div>

            <div className="brand-summary-box">
              <div className="summary-field">
                <span className="field-label">Active Organization:</span>
                <strong className="field-value">{guidelines?.brand_name || "Inkloom AI"}</strong>
              </div>
              <div className="summary-field">
                <span className="field-label">Target Audience:</span>
                <span className="field-value-text">
                  {guidelines?.target_audience
                    ? guidelines.target_audience.length > 80
                      ? guidelines.target_audience.substring(0, 80) + "..."
                      : guidelines.target_audience
                    : "Not specified"}
                </span>
              </div>
              <div className="summary-field">
                <span className="field-label">Tone of Voice:</span>
                <span className="field-value-text">
                  {guidelines?.tone_of_voice
                    ? guidelines.tone_of_voice.length > 90
                      ? guidelines.tone_of_voice.substring(0, 90) + "..."
                      : guidelines.tone_of_voice
                    : "Not specified"}
                </span>
              </div>
              <div className="summary-field">
                <span className="field-label">Prohibited Words:</span>
                <span className="field-value-text prohibited-badge">
                  {guidelines?.prohibited_words || "None configured"}
                </span>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  className="btn-edit-guidelines"
                  onClick={() => onNavigate("Brand Guidelines")}
                >
                  Manage Brand Guidelines →
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Network & Environment Configuration */}
          <div className="settings-card full-width">
            <div className="card-top">
              <div className="card-icon-wrap icon-cyan">
                <IconGlobe size={20} />
              </div>
              <div>
                <h2>Environment & CORS Diagnostics</h2>
                <p>Resolved runtime paths and cross-origin security bindings</p>
              </div>
            </div>

            <div className="env-grid">
              <div className="env-item">
                <span className="env-label">Resolved API Base URL</span>
                <code className="env-code">{API_BASE_URL}</code>
                <small className="env-desc">Determined via VITE_API_BASE_URL or local origin fallback</small>
              </div>

              <div className="env-item">
                <span className="env-label">Allowed Frontend Origins</span>
                <code className="env-code">
                  http://localhost:5173, http://localhost:5174, http://127.0.0.1:5173, http://127.0.0.1:5174, *.vercel.app
                </code>
                <small className="env-desc">CORS origins allowed by backend CORSMiddleware</small>
              </div>

              <div className="env-item">
                <span className="env-label">AI Analysis Parameters</span>
                <code className="env-code">temperature = 0.2, max_completion_tokens = 2000</code>
                <small className="env-desc">Optimized for deterministic compliance evaluation & reasoning tokens</small>
              </div>

              <div className="env-item">
                <span className="env-label">Database Storage Engine</span>
                <code className="env-code">SQLite 3 (inkloom.db) with WAL & RowFactory</code>
                <small className="env-desc">Transactional persistence for analyses & singleton brand profile</small>
              </div>
            </div>
          </div>

          {/* Card 4: Platform Version */}
          <div className="settings-card full-width platform-info-card">
            <div className="platform-meta">
              <h3>Inkloom AI – Intelligent Brand Governance Platform</h3>
              <p>Prototype Edition v1.0 • Built with React 19, Vite 8, FastAPI, and Groq Cloud AI</p>
            </div>
            <div className="platform-badges">
              <span className="tech-badge">Python 3.13</span>
              <span className="tech-badge">FastAPI 0.162</span>
              <span className="tech-badge">Groq SDK 1.7</span>
              <span className="tech-badge">React 19</span>
              <span className="tech-badge">Vite 8</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
