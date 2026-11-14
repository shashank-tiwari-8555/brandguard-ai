import { useState, useEffect, useMemo } from "react";
import "./History.css";
import { API_BASE_URL } from "../config";
import { IconSearch, IconFilter, IconCopy, IconCheck, IconX, IconRefresh, IconAlertTriangle, IconShield, IconImage, IconMaximize } from "./Icons";

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [enlargedHistoryImage, setEnlargedHistoryImage] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setEnlargedHistoryImage(null);
      }
    };
    if (enlargedHistoryImage) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enlargedHistoryImage]);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) {
        throw new Error(`Failed to load history (HTTP ${response.status})`);
      }
      const data = await response.json();
      setHistory(data.history || []);
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
        const response = await fetch(`${API_BASE_URL}/history`);
        if (!response.ok) {
          throw new Error(`Failed to load history (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (!ignore) {
          setHistory(data.history || []);
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

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.original_content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.suggested_revision.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.id).includes(searchQuery);

      const matchesRisk =
        riskFilter === "ALL" ||
        item.risk_level?.toUpperCase() === riskFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        item.approval_status?.toUpperCase() === statusFilter;

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [history, searchQuery, riskFilter, statusFilter]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="history-page">
      {/* Page Header */}
      <div className="history-header">
        <div>
          <div className="history-title-row">
            <h1>Analysis History</h1>
            <span className="history-count-badge">
              {history.length} {history.length === 1 ? "Record" : "Records"} Total
            </span>
          </div>
          <p className="history-subtitle">
            Audit trail of all advertisements evaluated by the Inkloom brand governance pipeline.
          </p>
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={fetchHistory}
          disabled={loading}
          title="Reload history records"
        >
          <IconRefresh size={15} className={loading ? "spin-icon" : ""} />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="history-toolbar">
        <div className="search-box">
          <IconSearch size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by ad content, claim, or analysis ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearchQuery("")}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <div className="filter-label">
            <IconFilter size={14} />
            <span>Risk:</span>
          </div>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((level) => (
            <button
              key={level}
              type="button"
              className={`filter-pill ${riskFilter === level ? "active" : ""}`}
              onClick={() => setRiskFilter(level)}
            >
              {level === "ALL" ? "All Risk" : level}
            </button>
          ))}
        </div>

        <div className="filter-group">
          <div className="filter-label">
            <span>Status:</span>
          </div>
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-pill ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === "ALL" ? "All Status" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="history-error-banner">
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && history.length === 0 ? (
        <div className="history-loading-card">
          <div className="spinner"></div>
          <p>Loading governance audit records...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="history-empty-card">
          <IconShield size={36} className="empty-icon" />
          <h3>No matching analysis records found</h3>
          <p>
            {searchQuery || riskFilter !== "ALL" || statusFilter !== "ALL"
              ? "Try resetting your search filters to view more records."
              : "No advertisements have been analyzed yet. Run your first analysis in the Content Analyzer."}
          </p>
          {(searchQuery || riskFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={() => {
                setSearchQuery("");
                setRiskFilter("ALL");
                setStatusFilter("ALL");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Results Table / Card List */
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Advertisement Copy</th>
                <th>Risk Level</th>
                <th>Issues</th>
                <th>Approval</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => (
                <tr key={item.id} className="history-row">
                  <td className="cell-id">
                    <span>#{item.id}</span>
                  </td>
                  <td className="cell-content">
                    {item.analysis_mode === "image" && (
                      <span className="history-mode-tag">
                        <IconImage size={11} /> Poster ({item.image_filename || "Image"})
                      </span>
                    )}
                    <p className="content-excerpt">
                      {item.original_content}
                    </p>
                  </td>
                  <td className="cell-risk">
                    <span className={`risk-badge risk-${(item.risk_level || "low").toLowerCase()}`}>
                      {item.risk_level} ({item.risk_score}/100)
                    </span>
                  </td>
                  <td className="cell-issues">
                    <span className={`issues-pill ${item.total_issues > 0 ? "has-issues" : "no-issues"}`}>
                      {item.total_issues} {item.total_issues === 1 ? "Issue" : "Issues"}
                    </span>
                  </td>
                  <td className="cell-status">
                    <span className={`status-pill status-${(item.approval_status || "pending").toLowerCase().replace(" ", "-")}`}>
                      {item.approval_status}
                    </span>
                  </td>
                  <td className="cell-date">
                    <span>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "—"}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn-inspect"
                      onClick={() => setSelectedItem(item)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title-row">
                  <h2>Analysis #{selectedItem.id} Details</h2>
                  <span className={`risk-badge risk-${(selectedItem.risk_level || "low").toLowerCase()}`}>
                    {selectedItem.risk_level} Risk ({selectedItem.risk_score}/100)
                  </span>
                  <span className={`status-pill status-${(selectedItem.approval_status || "pending").toLowerCase()}`}>
                    {selectedItem.approval_status}
                  </span>
                </div>
                <small className="modal-date">
                  Analyzed on{" "}
                  {selectedItem.created_at
                    ? new Date(selectedItem.created_at).toLocaleString()
                    : "Not specified"}
                </small>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedItem(null)}
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Original Advertisement Creative (Image Mode) */}
              {selectedItem.analysis_mode === "image" && (
                <div className="modal-section modal-creative-section">
                  <div className="modal-creative-header">
                    <h3>
                      <IconImage size={15} /> Original Advertisement Creative
                    </h3>
                    <span className="creative-filename-tag">
                      {selectedItem.image_filename || "Poster Image"}
                    </span>
                  </div>
                  <div
                    className="modal-creative-canvas"
                    onClick={() => {
                      const imgUrl = selectedItem.image_url
                        ? `${API_BASE_URL}${selectedItem.image_url}`
                        : (selectedItem.image_path ? `${API_BASE_URL}/images/${selectedItem.image_path}` : `${API_BASE_URL}/analyses/${selectedItem.id}/image`);
                      setEnlargedHistoryImage({
                        url: imgUrl,
                        title: selectedItem.image_filename || `Analysis #${selectedItem.id} Creative`,
                        id: selectedItem.id,
                        risk: selectedItem.risk_level,
                        score: selectedItem.risk_score
                      });
                    }}
                  >
                    <img
                      src={
                        selectedItem.image_url
                          ? `${API_BASE_URL}${selectedItem.image_url}`
                          : (selectedItem.image_path ? `${API_BASE_URL}/images/${selectedItem.image_path}` : `${API_BASE_URL}/analyses/${selectedItem.id}/image`)
                      }
                      alt={selectedItem.image_filename || `Analysis #${selectedItem.id} Poster`}
                      className="modal-creative-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.modal-creative-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="modal-creative-fallback" style={{ display: 'none' }}>
                      <IconImage size={28} />
                      <span>Original creative not available on server</span>
                    </div>
                    <div className="creative-hover-cue">
                      <IconMaximize size={15} />
                      <span>Click to enlarge creative</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Original Content */}
              <div className="modal-section">
                <h3>
                  {selectedItem.analysis_mode === "image" ? "Extracted OCR Copy" : "Original Advertisement"}
                  {selectedItem.analysis_mode === "image" && (
                    <span className="history-mode-tag" style={{ marginLeft: "10px" }}>
                      <IconImage size={12} /> Poster ({selectedItem.image_filename || "Extracted"})
                    </span>
                  )}
                </h3>
                <div className="content-quote-box">
                  <p>{selectedItem.ocr_extracted_text || selectedItem.original_content}</p>
                </div>
              </div>

              {/* Detected Issues */}
              <div className="modal-section">
                <h3>
                  Detected Compliance Issues ({selectedItem.issues?.length || 0})
                </h3>
                {selectedItem.issues && selectedItem.issues.length > 0 ? (
                  <div className="modal-issues-list">
                    {selectedItem.issues.map((issue, idx) => (
                      <div key={idx} className="modal-issue-card">
                        <div className="issue-card-top">
                          <span className="issue-type">{issue.type}</span>
                          <span className={`severity-tag sev-${(issue.severity || "medium").toLowerCase()}`}>
                            {issue.severity} Severity
                          </span>
                        </div>
                        {issue.claim && (
                          <div className="issue-claim">
                            <strong>Flagged Excerpt:</strong> &ldquo;{issue.claim}&rdquo;
                          </div>
                        )}
                        <p className="issue-expl">{issue.explanation}</p>
                        {issue.recommendation && (
                          <div className="issue-rec">
                            <strong>Guideline Recommendation:</strong> {issue.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="modal-no-issues">
                    <IconCheck size={18} />
                    <span>No brand violations detected. Ad complies with guidelines.</span>
                  </div>
                )}
              </div>

              {/* Suggested Revision */}
              <div className="modal-section">
                <div className="revision-header-row">
                  <h3>AI Brand-Aligned Revision</h3>
                  <button
                    type="button"
                    className="btn-copy-sm"
                    onClick={() => handleCopy(selectedItem.id, selectedItem.suggested_revision)}
                  >
                    {copiedId === selectedItem.id ? (
                      <>
                        <IconCheck size={14} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <IconCopy size={14} />
                        <span>Copy Revision</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="modal-revision-box">
                  <p>{selectedItem.suggested_revision}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Creative Inspection Modal */}
      {enlargedHistoryImage && (
        <div className="modal-backdrop" onClick={() => setEnlargedHistoryImage(null)}>
          <div className="creative-enlarge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="enlarge-modal-header">
              <div className="enlarge-header-info">
                <h3>Analysis #{enlargedHistoryImage.id} — Original Creative</h3>
                <span className="enlarge-filename">{enlargedHistoryImage.title}</span>
                {enlargedHistoryImage.risk && (
                  <span className={`risk-badge risk-${enlargedHistoryImage.risk.toLowerCase()}`}>
                    {enlargedHistoryImage.risk} Risk ({enlargedHistoryImage.score}/100)
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setEnlargedHistoryImage(null)}
                title="Close enlarged creative view"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="enlarge-modal-body">
              <img
                src={enlargedHistoryImage.url}
                alt={enlargedHistoryImage.title}
                className="enlarged-full-img"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
