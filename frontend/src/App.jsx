import { useState, useEffect } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import BrandGuidelines from "./components/BrandGuidelines";
import ContentAnalyzer from "./components/ContentAnalyzer";
import Approvals from "./components/Approvals";
import History from "./components/History";
import Settings from "./components/Settings";
import { API_BASE_URL } from "./config";
import {
  IconDashboard,
  IconBrand,
  IconAnalyzer,
  IconApprovals,
  IconHistory,
  IconSettings,
  IconSparkles,
  IconShield
} from "./components/Icons";

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [activeBrandName, setActiveBrandName] = useState("Inkloom AI");
  const [systemHealthy, setSystemHealthy] = useState(true);

  // Poll backend health and active brand guidelines once on mount
  useEffect(() => {
    let ignore = false;
    async function checkSystem() {
      try {
        const [hRes, bgRes] = await Promise.all([
          fetch(`${API_BASE_URL}/health`),
          fetch(`${API_BASE_URL}/brand-guidelines`)
        ]);
        if (!ignore) {
          setSystemHealthy(hRes.ok);
          if (bgRes.ok) {
            const bgData = await bgRes.json();
            if (bgData?.guidelines?.brand_name) {
              setActiveBrandName(bgData.guidelines.brand_name.trim());
            }
          }
        }
      } catch {
        if (!ignore) setSystemHealthy(false);
      }
    }
    checkSystem();
    return () => {
      ignore = true;
    };
  }, [activePage]);

  const menuItems = [
    { name: "Dashboard", label: "Dashboard", Icon: IconDashboard },
    { name: "Content Analyzer", label: "Content Analyzer", Icon: IconAnalyzer },
    { name: "Brand Guidelines", label: "Brand Guidelines", Icon: IconBrand },
    { name: "Approvals", label: "Approval Center", Icon: IconApprovals },
    { name: "History", label: "Analysis History", Icon: IconHistory },
    { name: "Settings", label: "Settings", Icon: IconSettings }
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="enterprise-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <IconSparkles size={18} className="brand-logo-icon" />
          </div>
          <div className="brand-text">
            <h2>Inkloom AI</h2>
            <span>Brand Governance</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-title">Platform</span>
          {menuItems.map((item) => {
            const Icon = item.Icon;
            const isActive = activePage === item.name;
            return (
              <button
                key={item.name}
                type="button"
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setActivePage(item.name)}
              >
                <Icon size={18} className="nav-item-icon" />
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="active-indicator"></span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status-indicator">
            <span className={`status-orb ${systemHealthy ? "orb-healthy" : "orb-offline"}`}></span>
            <div className="status-text-wrap">
              <strong>{systemHealthy ? "Groq AI Online" : "Service Offline"}</strong>
              <small>v1.0 Enterprise</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-viewport">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="navbar-breadcrumb">
            <span className="nav-org-tag">Organization</span>
            <span className="nav-divider">/</span>
            <strong className="nav-current-title">{activePage}</strong>
          </div>

          <div className="navbar-actions">
            <div className="governance-pill" title="Currently active brand guidelines">
              <IconShield size={14} className="pill-shield" />
              <span>Governed by: <strong>{activeBrandName || "Default Brand"}</strong></span>
            </div>

            {activePage !== "Content Analyzer" && (
              <button
                type="button"
                className="btn-nav-analyze"
                onClick={() => setActivePage("Content Analyzer")}
              >
                <IconAnalyzer size={15} />
                <span>+ Analyze Copy</span>
              </button>
            )}
          </div>
        </header>

        {/* View Router */}
        <main className="content-container">
          {activePage === "Dashboard" && (
            <Dashboard onNavigate={setActivePage} />
          )}

          {activePage === "Content Analyzer" && (
            <ContentAnalyzer />
          )}

          {activePage === "Brand Guidelines" && (
            <BrandGuidelines />
          )}

          {activePage === "Approvals" && (
            <Approvals />
          )}

          {activePage === "History" && (
            <History />
          )}

          {activePage === "Settings" && (
            <Settings onNavigate={setActivePage} />
          )}
        </main>
      </div>
    </div>
  );
}
