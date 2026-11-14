import { useState, useEffect } from "react";
import "./Dashboard.css";
import { API_BASE_URL } from "../config";
import {
  IconAnalyzer,
  IconShield,
  IconAlertTriangle,
  IconApprovals,
  IconTrendingUp,
  IconSparkles,
  IconChevronRight,
  IconRefresh
} from "./Icons";

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    total: 0,
    compliant: 0,
    issues: 0,
    pending: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    complianceRate: 100,
    brandName: "Inkloom AI",
    recentAnalyses: [],
    pendingList: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const [histRes, appRes, bgRes] = await Promise.all([
        fetch(`${API_BASE_URL}/history`),
        fetch(`${API_BASE_URL}/approvals`),
        fetch(`${API_BASE_URL}/brand-guidelines`)
      ]);

      const histData = histRes.ok ? await histRes.json() : { history: [] };
      const appData = appRes.ok ? await appRes.json() : { approvals: [] };
      const bgData = bgRes.ok ? await bgRes.json() : { guidelines: {} };

      const historyList = histData.history || [];
      const approvalsList = appData.approvals || [];
      const guidelines = bgData.guidelines || {};

      const total = historyList.length;
      let highCount = 0;
      let medCount = 0;
      let lowCount = 0;
      let totalIssues = 0;

      historyList.forEach((item) => {
        const rLevel = (item.risk_level || "").toLowerCase();
        if (rLevel === "high") highCount++;
        else if (rLevel === "medium") medCount++;
        else lowCount++;

        totalIssues += item.total_issues || 0;
      });

      const compliant = lowCount;
      const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;

      setStats({
        total,
        compliant,
        issues: totalIssues,
        pending: approvalsList.length,
        highRisk: highCount,
        mediumRisk: medCount,
        lowRisk: lowCount,
        complianceRate,
        brandName: guidelines.brand_name || "Inkloom AI",
        recentAnalyses: historyList.slice(0, 5),
        pendingList: approvalsList.slice(0, 3)
      });
    } catch (err) {
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [histRes, appRes, bgRes] = await Promise.all([
          fetch(`${API_BASE_URL}/history`),
          fetch(`${API_BASE_URL}/approvals`),
          fetch(`${API_BASE_URL}/brand-guidelines`)
        ]);

        const histData = histRes.ok ? await histRes.json() : { history: [] };
        const appData = appRes.ok ? await appRes.json() : { approvals: [] };
        const bgData = bgRes.ok ? await bgRes.json() : { guidelines: {} };

        if (!ignore) {
          const historyList = histData.history || [];
          const approvalsList = appData.approvals || [];
          const guidelines = bgData.guidelines || {};

          const total = historyList.length;
          let highCount = 0;
          let medCount = 0;
          let lowCount = 0;
          let totalIssues = 0;

          historyList.forEach((item) => {
            const rLevel = (item.risk_level || "").toLowerCase();
            if (rLevel === "high") highCount++;
            else if (rLevel === "medium") medCount++;
            else lowCount++;

            totalIssues += item.total_issues || 0;
          });

          const compliant = lowCount;
          const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;

          setStats({
            total,
            compliant,
            issues: totalIssues,
            pending: approvalsList.length,
            highRisk: highCount,
            mediumRisk: medCount,
            lowRisk: lowCount,
            complianceRate,
            brandName: guidelines.brand_name || "Inkloom AI",
            recentAnalyses: historyList.slice(0, 5),
            pendingList: approvalsList.slice(0, 3)
          });
        }
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to connect to backend server.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const totalCalculated = stats.highRisk + stats.mediumRisk + stats.lowRisk || 1;
  const highPct = Math.round((stats.highRisk / totalCalculated) * 100);
  const medPct = Math.round((stats.mediumRisk / totalCalculated) * 100);
  const lowPct = 100 - highPct - medPct;

  return (
    <div className="dashboard-page">
      {/* Top Welcome / Header */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-title-row">
            <h1>Executive Governance Dashboard</h1>
            <span className="brand-governed-badge">
              <IconSparkles size={14} />
              Active: {stats.brandName}
            </span>
          </div>
          <p className="dashboard-subtitle">
            Real-time advertisement compliance intelligence, truth-in-advertising auditing, and brand risk monitoring.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-refresh-dash"
            onClick={loadDashboardData}
            disabled={loading}
            title="Refresh metrics from backend"
          >
            <IconRefresh size={15} className={loading ? "spin-icon" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            type="button"
            className="btn-primary-new"
            onClick={() => onNavigate("Content Analyzer")}
          >
            <IconAnalyzer size={16} />
            <span>+ New Analysis</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-error-banner">
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Governance Banner */}
      <div className="dashboard-hero-banner">
        <div className="hero-content">
          <span className="hero-tag">Automated Brand Safety</span>
          <h2>Protect brand reputation across all promotional channels.</h2>
          <p>
            Inkloom AI evaluates ad headlines, promises, and body copy against your saved brand guidelines
            and truth-in-advertising standards—detecting deceptive claims before publication.
          </p>
          <div className="hero-buttons">
            <button
              type="button"
              className="btn-hero-primary"
              onClick={() => onNavigate("Content Analyzer")}
            >
              Analyze Advertisement Copy →
            </button>
            <button
              type="button"
              className="btn-hero-secondary"
              onClick={() => onNavigate("Brand Guidelines")}
            >
              Configure Guidelines
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-glow"></div>
          <div className="hero-stat-bubble">
            <IconTrendingUp size={20} className="bubble-icon" />
            <div>
              <span className="bubble-label">Compliance Health</span>
              <strong className="bubble-value">{stats.complianceRate}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">Total Analyses</span>
            <div className="kpi-icon-wrap icon-indigo">
              <IconAnalyzer size={18} />
            </div>
          </div>
          <div className="kpi-value">{loading ? "..." : stats.total}</div>
          <div className="kpi-footer">
            <span className="kpi-trend positive">↑ All-time</span>
            <span className="kpi-footer-text">copy evaluations</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">Compliance Rate</span>
            <div className="kpi-icon-wrap icon-emerald">
              <IconShield size={18} />
            </div>
          </div>
          <div className="kpi-value">{loading ? "..." : `${stats.complianceRate}%`}</div>
          <div className="kpi-footer">
            <span className="kpi-trend positive">{stats.compliant} ads</span>
            <span className="kpi-footer-text">low-risk or verified</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">Issues Detected</span>
            <div className="kpi-icon-wrap icon-amber">
              <IconAlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value">{loading ? "..." : stats.issues}</div>
          <div className="kpi-footer">
            <span className="kpi-trend warning">Flagged claims</span>
            <span className="kpi-footer-text">across all analyses</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">Pending Approvals</span>
            <div className="kpi-icon-wrap icon-purple">
              <IconApprovals size={18} />
            </div>
          </div>
          <div className="kpi-value">{loading ? "..." : stats.pending}</div>
          <div className="kpi-footer">
            <span className="kpi-trend neutral">Human review</span>
            <span className="kpi-footer-text">awaiting decision</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Risk Distribution Chart & Pending Pipeline */}
      <div className="dashboard-mid-grid">
        {/* Risk Distribution Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h3>Risk Severity Distribution</h3>
              <p>Proportion of evaluated copy by brand compliance risk level</p>
            </div>
            <span className="chart-badge">{stats.total} Total Evaluated</span>
          </div>

          <div className="risk-chart-box">
            {/* Multi-segment Progress Bar */}
            <div className="distribution-bar">
              {stats.highRisk > 0 && (
                <div
                  className="bar-segment seg-high"
                  style={{ width: `${Math.max(highPct, 8)}%` }}
                  title={`High Risk: ${stats.highRisk} (${highPct}%)`}
                ></div>
              )}
              {stats.mediumRisk > 0 && (
                <div
                  className="bar-segment seg-med"
                  style={{ width: `${Math.max(medPct, 8)}%` }}
                  title={`Medium Risk: ${stats.mediumRisk} (${medPct}%)`}
                ></div>
              )}
              {stats.lowRisk > 0 && (
                <div
                  className="bar-segment seg-low"
                  style={{ width: `${Math.max(lowPct, 8)}%` }}
                  title={`Low Risk: ${stats.lowRisk} (${lowPct}%)`}
                ></div>
              )}
            </div>

            {/* Metrics Breakdown */}
            <div className="distribution-metrics">
              <div className="dist-item item-high">
                <div className="dist-dot dot-high"></div>
                <div className="dist-details">
                  <span className="dist-label">High Risk</span>
                  <strong className="dist-count">{stats.highRisk} ads ({highPct}%)</strong>
                  <span className="dist-hint">Prohibited terms & false guarantees</span>
                </div>
              </div>

              <div className="dist-item item-med">
                <div className="dist-dot dot-med"></div>
                <div className="dist-details">
                  <span className="dist-label">Medium Risk</span>
                  <strong className="dist-count">{stats.mediumRisk} ads ({medPct}%)</strong>
                  <span className="dist-hint">Unsupported claims & artificial urgency</span>
                </div>
              </div>

              <div className="dist-item item-low">
                <div className="dist-dot dot-low"></div>
                <div className="dist-details">
                  <span className="dist-label">Low Risk / Compliant</span>
                  <strong className="dist-count">{stats.lowRisk} ads ({lowPct}%)</strong>
                  <span className="dist-hint">Aligned with active brand tone</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Queue Spotlight */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h3>Compliance Approval Queue</h3>
              <p>Recent flagged advertisements awaiting human approval</p>
            </div>
            {stats.pending > 0 && (
              <button
                type="button"
                className="view-link"
                onClick={() => onNavigate("Approvals")}
              >
                View All ({stats.pending}) →
              </button>
            )}
          </div>

          <div className="dash-approval-list">
            {stats.pendingList.length === 0 ? (
              <div className="empty-dash-state">
                <IconShield size={32} className="empty-icon-shield" />
                <h4>All Caught Up!</h4>
                <p>No advertisements are currently waiting for human compliance approval.</p>
              </div>
            ) : (
              stats.pendingList.map((item) => (
                <div key={item.id} className="dash-queue-item">
                  <div className="queue-meta">
                    <span className="queue-id">#{item.id}</span>
                    <span className={`risk-tag risk-${(item.risk_level || "medium").toLowerCase()}`}>
                      {item.risk_level} Risk ({item.risk_score}/100)
                    </span>
                    <span className="queue-issues">{item.total_issues} issues flagged</span>
                  </div>
                  <p className="queue-content">{item.original_content}</p>
                  <button
                    type="button"
                    className="btn-review-item"
                    onClick={() => onNavigate("Approvals")}
                  >
                    Review in Approval Center →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Analyses Stream */}
      <div className="dash-card full-width">
        <div className="dash-card-header">
          <div>
            <h3>Recent Governance Audits</h3>
            <p>Latest advertisement copy analyses evaluated by Groq AI and rule-based governance</p>
          </div>
          <button
            type="button"
            className="view-link"
            onClick={() => onNavigate("History")}
          >
            Open Full History →
          </button>
        </div>

        <div className="recent-analyses-table-wrap">
          {stats.recentAnalyses.length === 0 ? (
            <div className="empty-dash-state">
              <p>No advertisements analyzed yet. Start with your first advertisement copy.</p>
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Analysis ID</th>
                  <th>Advertisement Copy Excerpt</th>
                  <th>Risk Score</th>
                  <th>Issues</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAnalyses.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-mono">#{item.id}</td>
                    <td className="cell-excerpt">
                      <p>{item.original_content}</p>
                    </td>
                    <td>
                      <span className={`risk-tag risk-${(item.risk_level || "low").toLowerCase()}`}>
                        {item.risk_level} ({item.risk_score}/100)
                      </span>
                    </td>
                    <td className="cell-num">{item.total_issues}</td>
                    <td>
                      <span className={`status-badge status-${(item.approval_status || "pending").toLowerCase().replace(" ", "-")}`}>
                        {item.approval_status}
                      </span>
                    </td>
                    <td className="cell-date">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-table-action"
                        onClick={() => onNavigate("History")}
                      >
                        Inspect <IconChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
