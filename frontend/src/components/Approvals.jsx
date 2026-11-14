
import { useEffect, useState, useCallback } from "react";
import "./Approvals.css";
import { API_BASE_URL as API_URL } from "../config";

function Approvals() {
    const [history, setHistory] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    // Fetch all analyses and pending approvals
    const loadData = useCallback(async () => {
        const [historyResponse, approvalsResponse] =
            await Promise.all([
                fetch(`${API_URL}/history`),
                fetch(`${API_URL}/approvals`)
            ]);

        if (!historyResponse.ok || !approvalsResponse.ok) {
            throw new Error("Unable to fetch approval data.");
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
            `Are you sure you want to ${status.toLowerCase()} this analysis?`
        );

        if (!confirmed) return;

        setUpdatingId(id);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/approvals/${id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail || "Unable to update approval."
                );
            }

            setMessage(data.message);
            await loadData();

        } catch (err) {
            setError(err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const total = history.length;

    const pendingCount = history.filter(
        item => item.approval_status === "Pending"
    ).length;

    const approvedCount = history.filter(
        item => item.approval_status === "Approved"
    ).length;

    const rejectedCount = history.filter(
        item => item.approval_status === "Rejected"
    ).length;

    if (loading) {
        return (
            <div className="approvals-page">
                <h2>Loading Approvals...</h2>
            </div>
        );
    }

    return (
        <div className="approvals-page">

            {/* HEADER */}
            <div className="approvals-header">
                <div>
                    <h1>Approval Center</h1>
                    <p>
                        Review advertisement content and
                        manage brand compliance decisions.
                    </p>
                </div>

                <button
                    className="refresh-btn"
                    onClick={async () => {
                        try {
                            setError("");
                            await loadData();
                        } catch (err) {
                            setError(err.message);
                        }
                    }}
                >
                    ↻ Refresh
                </button>
            </div>

            {/* SUMMARY CARDS */}
            <div className="approval-stats">

                <div className="approval-stat">
                    <span>Total Analyses</span>
                    <h2>{total}</h2>
                </div>

                <div className="approval-stat pending-stat">
                    <span>Pending</span>
                    <h2>{pendingCount}</h2>
                </div>

                <div className="approval-stat approved-stat">
                    <span>Approved</span>
                    <h2>{approvedCount}</h2>
                </div>

                <div className="approval-stat rejected-stat">
                    <span>Rejected</span>
                    <h2>{rejectedCount}</h2>
                </div>

            </div>

            {/* NOTIFICATIONS */}
            {message && (
                <div className="approval-message success-message">
                    ✓ {message}
                </div>
            )}

            {error && (
                <div className="approval-message error-message">
                    {error}
                </div>
            )}

            {/* PENDING APPROVALS */}
            <div className="approval-section">
                <h2>Pending Reviews</h2>

                <p className="section-description">
                    Advertisements requiring human review.
                </p>

                {approvals.length === 0 ? (
                    <div className="empty-approvals">
                        <h3>✓ All Caught Up!</h3>
                        <p>
                            There are no pending approvals right now.
                        </p>
                    </div>
                ) : (

                    approvals.map((item) => (
                        <div
                            className="approval-card"
                            key={item.id}
                        >

                            {/* CARD HEADER */}
                            <div className="approval-card-header">
                                <h3>Analysis #{item.id}</h3>

                                <span className="pending-badge">
                                    {item.approval_status}
                                </span>
                            </div>

                            {/* ORIGINAL CONTENT */}
                            <div className="approval-content">
                                <h4>Original Advertisement</h4>
                                <p>{item.original_content}</p>
                            </div>

                            {/* RISK SUMMARY */}
                            <div className="approval-risk">

                                <div>
                                    <span>Risk Score</span>
                                    <strong>
                                        {item.risk_score}/100
                                    </strong>
                                </div>

                                <div>
                                    <span>Risk Level</span>
                                    <strong>
                                        {item.risk_level}
                                    </strong>
                                </div>

                                <div>
                                    <span>Total Issues</span>
                                    <strong>
                                        {item.total_issues}
                                    </strong>
                                </div>

                            </div>

                            {/* DETECTED ISSUES */}
                            <div className="approval-issues">
                                <h4>Detected Issues</h4>

                                {item.issues?.map((issue, index) => (
                                    <div
                                        className="approval-issue"
                                        key={index}
                                    >
                                        <h5>{issue.type}</h5>

                                        <p>
                                            <strong>Claim:</strong>{" "}
                                            {issue.claim}
                                        </p>

                                        <p>
                                            <strong>Explanation:</strong>{" "}
                                            {issue.explanation}
                                        </p>

                                        <p>
                                            <strong>Severity:</strong>{" "}
                                            {issue.severity}
                                        </p>

                                        <p>
                                            <strong>Recommendation:</strong>{" "}
                                            {issue.recommendation}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* SUGGESTED REVISION */}
                            <div className="approval-revision">
                                <h4>Suggested Revision</h4>
                                <p>{item.suggested_revision}</p>
                            </div>

                            {/* DATE */}
                            <small className="approval-date">
                                Submitted:{" "}
                                {new Date(item.created_at).toLocaleString()}
                            </small>

                            {/* ACTION BUTTONS */}
                            <div className="approval-actions">

                                <button
                                    className="approve-btn"
                                    disabled={updatingId !== null}
                                    onClick={() =>
                                        handleDecision(
                                            item.id,
                                            "Approved"
                                        )
                                    }
                                >
                                    {updatingId === item.id
                                        ? "Processing..."
                                        : "✓ Approve"}
                                </button>

                                <button
                                    className="reject-btn"
                                    disabled={updatingId !== null}
                                    onClick={() =>
                                        handleDecision(
                                            item.id,
                                            "Rejected"
                                        )
                                    }
                                >
                                    {updatingId === item.id
                                        ? "Processing..."
                                        : "✕ Reject"}
                                </button>

                            </div>

                        </div>
                    ))
                )}
            </div>

        </div>
    );
}

export default Approvals;
