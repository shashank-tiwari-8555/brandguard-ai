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
  IconShield,
  IconMenu,
  IconX
} from "./components/Icons";

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [activeBrandName, setActiveBrandName] = useState("Inkloom AI");
  const [systemHealthy, setSystemHealthy] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { name: "Dashboard", label: "Dashboard", Icon: IconDashboard, hint: "Overview & Metrics" },
    { name: "Content Analyzer", label: "Content Analyzer", Icon: IconAnalyzer, hint: "Text & Poster OCR" },
    { name: "Brand Guidelines", label: "Brand Guidelines", Icon: IconBrand, hint: "Voice & Prohibited Terms" },
    { name: "Approvals", label: "Approval Center", Icon: IconApprovals, hint: "Compliance Review" },
    { name: "History", label: "Analysis History", Icon: IconHistory, hint: "Audit Trail" },
    { name: "Settings", label: "Settings", Icon: IconSettings, hint: "System Diagnostics" }
  ];

  const handleNavClick = (pageName) => {
    setActivePage(pageName);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`enterprise-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <IconSparkles size={18} className="brand-logo-icon" />
          </div>
          <div className="brand-text">
            <h2>Inkloom AI</h2>
            <span>Brand Governance</span>
          </div>
          <button
            type="button"
            className="btn-close-mobile-nav"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <IconX size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-title">Platform Modules</span>
          {menuItems.map((item) => {
            const Icon = item.Icon;
            const isActive = activePage === item.name;
            return (
              <button
                key={item.name}
                type="button"
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                onClick={() => handleNavClick(item.name)}
              >
                <div className="nav-item-icon-box">
                  <Icon size={17} className="nav-item-icon" />
                </div>
                <div className="nav-item-label-group">
                  <span className="nav-item-label">{item.label}</span>
                  <span className="nav-item-hint">{item.hint}</span>
                </div>
                {isActive && <span className="active-indicator"></span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="governance-status-card">
            <div className="status-header">
              <span className={`status-orb ${systemHealthy ? "orb-healthy" : "orb-offline"}`}></span>
              <strong>{systemHealthy ? "Groq AI Online" : "Service Degraded"}</strong>
            </div>
            <p className="governance-brand-note">
              Governing: <strong title={activeBrandName}>{activeBrandName || "Default Brand"}</strong>
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-viewport">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="navbar-left">
            <button
              type="button"
              className="btn-mobile-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <IconMenu size={20} />
            </button>

            <div className="navbar-breadcrumb">
              <span className="nav-org-tag">Organization</span>
              <span className="nav-divider">/</span>
              <strong className="nav-current-title">{activePage}</strong>
            </div>
          </div>

          <div className="navbar-actions">
            <button
              type="button"
              className="governance-pill"
              onClick={() => handleNavClick("Brand Guidelines")}
              title="Click to view or edit active brand guidelines"
            >
              <IconShield size={14} className="pill-shield" />
              <span>Governed by: <strong>{activeBrandName || "Default Brand"}</strong></span>
            </button>

            {activePage !== "Content Analyzer" && (
              <button
                type="button"
                className="btn-nav-analyze"
                onClick={() => handleNavClick("Content Analyzer")}
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
            <Dashboard onNavigate={handleNavClick} />
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
            <Settings onNavigate={handleNavClick} />
          )}
        </main>
      </div>
    </div>
  );
}
