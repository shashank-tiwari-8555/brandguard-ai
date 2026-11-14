import { useEffect, useState, useCallback, useMemo } from "react";
import "./Approvals.css";
import { API_BASE_URL as API_URL } from "../config";
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconRefresh,
  IconCopy,
  IconShield,
  IconImage
} from "./Icons";

export default function Approvals() {
  const [history, setHistory] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING");
  const [copiedId, setCopiedId] = useState(null);

  // Fetch all analyses and pending approvals
  const loadData = useCallback(async () => {
    const [historyResponse, approvalsResponse] = await Promise.all([
      fetch(`${API_URL}/history`),
      fetch(`${API_URL}/approvals`)
    ]);

    if (!historyResponse.ok || !approvalsResponse.ok) {
      throw new Error("Unable to fetch approval data from server.");
    }

    const historyData = await historyResponse.json();
    const approvalsData = await approvalsResponse.json();

    setHistory(historyData.history || []);
    setApprovals(approvalsData.approvals || []);
  }, []);

  // Initial loading
  useEffect(() => {
    const initialize = async () => {
      try {
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [loadData]);

  // Approve or reject analysis
  const handleDecision = async (id, status) => {
    const confirmed = window.confirm(
      `Confirm compliance decision: Are you sure you want to mark Analysis #${id} as ${status}?`
    );

    if (!confirmed) return;

    setUpdatingId(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/approvals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to update approval decision.");
      }

      setMessage(data.message || `Analysis #${id} successfully marked as ${status}.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const total = history.length;
  const pendingCount = history.filter((item) => item.approval_status === "Pending").length;
  const approvedCount = history.filter((item) => item.approval_status === "Approved").length;
  const rejectedCount = history.filter((item) => item.approval_status === "Rejected").length;

  const displayItems = useMemo(() => {
    if (activeTab === "PENDING") return approvals;
    if (activeTab === "APPROVED") return history.filter((i) => i.approval_status === "Approved");
    if (activeTab === "REJECTED") return history.filter((i) => i.approval_status === "Rejected");
    return history;
  }, [activeTab, approvals, history]);

  if (loading) {
    return (
      <div className="approvals-page">
        <div className="approvals-loading">
          <div className="spinner"></div>
          <p>Loading compliance approvals queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="approvals-page">
      {/* Header */}
      <div className="approvals-header">
        <div>
          <div className="approvals-title-row">
            <h1>Human Compliance Approval Center</h1>
            <span className="queue-badge">
              {pendingCount} Pending Review
            </span>
          </div>
          <p className="approvals-subtitle">
            Review AI-flagged advertisements, inspect violations, evaluate suggested brand revisions, and issue formal compliance sign-offs.
          </p>
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={async () => {
            try {
              setError("");
              await loadData();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <IconRefresh size={15} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="approval-kpi-grid">
        <div className="approval-kpi-card" onClick={() => setActiveTab("ALL")}>
          <div className="kpi-meta-label">Total Audits</div>
          <div className="kpi-num">{total}</div>
          <small className="kpi-hint">All analyses logged</small>
        </div>

        <div className={`approval-kpi-card card-pending ${activeTab === "PENDING" ? "selected" : ""}`} onClick={() => setActiveTab("PENDING")}>
          <div className="kpi-meta-label">Action Required</div>
          <div className="kpi-num num-amber">{pendingCount}</div>
          <small className="kpi-hint">Pending human sign-off</small>
        </div>

        <div className={`approval-kpi-card card-approved ${activeTab === "APPROVED" ? "selected" : ""}`} onClick={() => setActiveTab("APPROVED")}>
          <div className="kpi-meta-label">Approved</div>
          <div className="kpi-num num-emerald">{approvedCount}</div>
          <small className="kpi-hint">Cleared for publication</small>
        </div>

        <div className={`approval-kpi-card card-rejected ${activeTab === "REJECTED" ? "selected" : ""}`} onClick={() => setActiveTab("REJECTED")}>
          <div className="kpi-meta-label">Rejected</div>
          <div className="kpi-num num-rose">{rejectedCount}</div>
          <small className="kpi-hint">Blocked brand risk</small>
        </div>
      </div>

      {/* Feedback Alerts */}
      {message && (
        <div className="alert-toast toast-success">
          <IconCheck size={18} />
          <span>{message}</span>
          <button type="button" className="btn-close-toast" onClick={() => setMessage("")}>
            <IconX size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="alert-toast toast-error">
          <IconAlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn-close-toast" onClick={() => setError("")}>
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* View Filter Tabs */}
      <div className="approval-tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "PENDING" ? "active" : ""}`}
          onClick={() => setActiveTab("PENDING")}
        >
          <span>Pending Reviews</span>
          <span className="tab-pill">{pendingCount}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "ALL" ? "active" : ""}`}
          onClick={() => setActiveTab("ALL")}
        >
          <span>All Audits</span>
          <span className="tab-pill">{total}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "APPROVED" ? "active" : ""}`}
          onClick={() => setActiveTab("APPROVED")}
        >
          <span>Approved</span>
          <span className="tab-pill">{approvedCount}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "REJECTED" ? "active" : ""}`}
          onClick={() => setActiveTab("REJECTED")}
        >
          <span>Rejected</span>
          <span className="tab-pill">{rejectedCount}</span>
        </button>
      </div>

      {/* Approvals Review Cards List */}
      <div className="approvals-cards-stack">
        {displayItems.length === 0 ? (
          <div className="empty-approvals-card">
            <IconShield size={38} className="empty-shield" />
            <h3>No advertisements in this view</h3>
            <p>
              {activeTab === "PENDING"
                ? "All caught up! There are no advertisements currently awaiting human review."
                : "No matching records found for this filter tab."}
            </p>
          </div>
        ) : (
          displayItems.map((item) => {
            const isPending = item.approval_status === "Pending";
            const riskClass = (item.risk_level || "medium").toLowerCase();

            return (
              <div key={item.id} className={`approval-review-card ${isPending ? "card-is-pending" : ""}`}>
                {/* Card Top Meta */}
                <div className="review-card-header">
                  <div className="review-id-wrap">
                    <span className="review-id">Analysis #{item.id}</span>
                    <span className={`risk-badge risk-${riskClass}`}>
                      {item.risk_level} Risk ({item.risk_score}/100)
                    </span>
                    <span className={`status-pill status-${(item.approval_status || "pending").toLowerCase()}`}>
                      {item.approval_status}
                    </span>
                  </div>

                  <small className="review-timestamp">
                    Submitted:{" "}
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "Recently"}
                  </small>
                </div>

                {/* Compare View: Original Copy vs AI Revision */}
                <div className="compare-grid">
                  <div className="compare-pane pane-original">
                    <div className="pane-header">
                      <span className="pane-title">
                        Original Copy Submitted
                        {item.analysis_mode === "image" && (
                          <span className="approval-poster-tag" style={{ marginLeft: "8px" }}>
                            <IconImage size={11} /> Poster ({item.image_filename || "Image"})
                          </span>
                        )}
                      </span>
                      <span className="pane-tag">Flagged</span>
                    </div>
                    <div className="pane-body">
                      <p>{item.original_content}</p>
                    </div>
                  </div>

                  <div className="compare-pane pane-revision">
                    <div className="pane-header">
                      <span className="pane-title">AI Suggested Revision</span>
                      <button
                        type="button"
                        className="btn-pane-copy"
                        onClick={() => handleCopy(item.id, item.suggested_revision)}
                      >
                        {copiedId === item.id ? (
                          <>
                            <IconCheck size={13} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <IconCopy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="pane-body revision-body">
                      <p>{item.suggested_revision}</p>
                    </div>
                  </div>
                </div>

                {/* Detected Issues Breakdown */}
                {item.issues && item.issues.length > 0 && (
                  <div className="review-issues-section">
                    <div className="issues-toggle-header">
                      <h4>Flagged Compliance Issues ({item.issues.length})</h4>
                    </div>

                    <div className="review-issues-grid">
                      {item.issues.map((issue, idx) => (
                        <div key={idx} className="review-issue-chip">
                          <div className="chip-top">
                            <span className="chip-type">{issue.type}</span>
                            <span className={`severity-tag sev-${(issue.severity || "medium").toLowerCase()}`}>
                              {issue.severity}
                            </span>
                          </div>
                          {issue.claim && (
                            <div className="chip-claim">&ldquo;{issue.claim}&rdquo;</div>
                          )}
                          <p className="chip-expl">{issue.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Actions Bar */}
                <div className="review-actions-bar">
                  <div className="actions-left-meta">
                    {isPending ? (
                      <span className="text-awaiting">Requires compliance officer decision</span>
                    ) : (
                      <span className="text-decided">
                        Decision recorded as <strong>{item.approval_status}</strong>
                      </span>
                    )}
                  </div>

                  <div className="actions-buttons-group">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          className="btn-decision-reject"
                          disabled={updatingId !== null}
                          onClick={() => handleDecision(item.id, "Rejected")}
                        >
                          {updatingId === item.id ? "Processing..." : "✕ Reject Copy"}
                        </button>

                        <button
                          type="button"
                          className="btn-decision-approve"
                          disabled={updatingId !== null}
                          onClick={() => handleDecision(item.id, "Approved")}
                        >
                          {updatingId === item.id ? "Processing..." : "✓ Approve for Publication"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
