import { useState, useEffect } from "react";
import "./ContentAnalyzer.css";
import { API_BASE_URL } from "../config";
import {
  IconSparkles,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconShield,
  IconX
} from "./Icons";

const SAMPLE_ADS = [
  {
    label: "High Risk Guarantee",
    content: "Try Inkloom AI today! It is 100% guaranteed to deliver 10x faster compliance for everyone with zero risk! Our platform is the #1 world's best solution!"
  },
  {
    label: "Artificial Urgency & Claims",
    content: "Act now! Limited time offer expires in 2 hours. Millions of happy customers love our magical software. Get 50% off right now before it never fails you!"
  },
  {
    label: "Balanced Compliant Ad",
    content: "Enterprise CMOs and compliance teams rely on Inkloom AI for intelligent brand governance. Our platform streamlines advertising compliance reviews, helping organizations maintain verifiable brand integrity."
  }
];

export default function ContentAnalyzer() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeBrand, setActiveBrand] = useState("Inkloom AI");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Fetch active brand name on mount
  useEffect(() => {
    let ignore = false;
    async function loadBrand() {
      try {
        const res = await fetch(`${API_BASE_URL}/brand-guidelines`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data?.guidelines?.brand_name) {
            setActiveBrand(data.guidelines.brand_name.trim());
          }
        }
      } catch {
        // Safe fallback
      }
    }
    loadBrand();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError("Please paste or type advertisement content before running analysis.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: content.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Analysis failed with HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to connect to the backend analysis server.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRevision = () => {
    if (!result?.suggested_revision) return;
    navigator.clipboard.writeText(result.suggested_revision);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const riskClass =
    (result?.risk_level || "low").toLowerCase();

  return (
    <div className="analyzer-page">
      {/* Header */}
      <div className="analyzer-header">
        <div>
          <div className="analyzer-title-row">
            <h1>Content Analyzer</h1>
            <span className="brand-governance-tag">
              <IconShield size={14} />
              Governed by: <strong>{activeBrand}</strong>
            </span>
          </div>
          <p className="analyzer-subtitle">
            Paste promotional copy, email headlines, or ad campaigns. Groq AI evaluates text against active brand tone, prohibited words, and advertising truth rules.
          </p>
        </div>
      </div>

      {/* Main Input Card */}
      <div className="analyzer-input-card">
        <div className="input-card-header">
          <div className="input-title-wrap">
            <h2>Advertisement Content</h2>
            <span className="input-hint">Headlines, body copy, or promotional promises</span>
          </div>

          <div className="sample-chips">
            <span className="sample-label">Sample Prompts:</span>
            {SAMPLE_ADS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="sample-chip-btn"
                onClick={() => setContent(sample.content)}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="textarea-wrapper">
          <textarea
            placeholder="Paste your advertisement headline or body copy here for compliance evaluation..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
          />
          {content && (
            <button
              type="button"
              className="btn-clear-content"
              onClick={() => setContent("")}
              title="Clear input"
            >
              <IconX size={15} />
            </button>
          )}
        </div>

        <div className="analyzer-actions-bar">
          <span className="char-count">
            {content.length} {content.length === 1 ? "character" : "characters"}
          </span>

          <button
            type="button"
            className="btn-run-analysis"
            onClick={handleAnalyze}
            disabled={loading || !content.trim()}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                <span>Evaluating with Groq AI...</span>
              </>
            ) : (
              <>
                <IconSparkles size={16} />
                <span>Analyze Content →</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="analyzer-error-alert">
            <IconAlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {result && (
        <div className="analysis-results-section">
          <div className="results-overview-header">
            <div>
              <h2>Audit Results</h2>
              <span className="source-pill">
                Engine: {result.revision_source || "Groq AI"}
              </span>
            </div>
            <span className="analysis-id-badge">
              Analysis #{result.analysis_id || "Active"}
            </span>
          </div>

          {/* Metric KPI Summary */}
          <div className="results-metrics-grid">
            <div className={`metric-box risk-metric-box risk-bg-${riskClass}`}>
              <div className="metric-label">Risk Severity Score</div>
              <div className="metric-score-wrap">
                <span className="score-num">{result.risk_score}</span>
                <span className="score-denom">/100</span>
              </div>
              <span className={`risk-badge risk-${riskClass}`}>
                {result.risk_level} Risk
              </span>
            </div>

            <div className="metric-box">
              <div className="metric-label">Compliance Decision</div>
              <div className="metric-value-text">
                {result.approval_status === "Pending" ? "Human Review Required" : "Auto-Compliant"}
              </div>
              <small className="metric-hint">
                {result.approval_status === "Pending"
                  ? "Queued in Approval Center"
                  : "No critical violations"}
              </small>
            </div>

            <div className="metric-box">
              <div className="metric-label">Violations Detected</div>
              <div className="metric-score-wrap">
                <span className="score-num">{result.total_issues}</span>
                <span className="score-denom">issues</span>
              </div>
              <small className="metric-hint">
                {result.total_issues === 0 ? "Completely compliant" : "Flagged for correction"}
              </small>
            </div>
          </div>

          {/* Detected Issues List */}
          <div className="detected-issues-card">
            <div className="issues-header">
              <h3>
                Audited Violations & Claims ({result.issues?.length || 0})
              </h3>
              <p>Specific brand guidelines and truth-in-advertising rules identified by AI</p>
            </div>

            {result.issues && result.issues.length > 0 ? (
              <div className="issues-stack">
                {result.issues.map((issue, index) => (
                  <div key={index} className={`issue-card issue-border-${(issue.severity || "medium").toLowerCase()}`}>
                    <div className="issue-top-row">
                      <span className="issue-type-name">{issue.type}</span>
                      <span className={`severity-tag sev-${(issue.severity || "medium").toLowerCase()}`}>
                        {issue.severity} Severity
                      </span>
                    </div>

                    {issue.claim && (
                      <div className="issue-claim-quote">
                        <strong>Flagged Claim:</strong> &ldquo;{issue.claim}&rdquo;
                      </div>
                    )}

                    <p className="issue-explanation-text">{issue.explanation}</p>

                    {issue.recommendation && (
                      <div className="issue-rec-block">
                        <strong>Brand Recommendation:</strong> {issue.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="zero-issues-banner">
                <IconCheck size={20} className="check-emerald" />
                <div>
                  <strong>Content Approved – Zero Violations</strong>
                  <p>The analyzed copy complies with all saved brand guidelines and truth standards.</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Suggested Revision Panel */}
          <div className="suggested-revision-card">
            <div className="revision-card-header">
              <div className="revision-title-wrap">
                <div className="revision-icon-emerald">
                  <IconSparkles size={18} />
                </div>
                <div>
                  <h3>AI Suggested Revision</h3>
                  <p>Corrected copy reflecting active brand tone, vocabulary, and honest claims</p>
                </div>
              </div>

              <button
                type="button"
                className="btn-copy-revision"
                onClick={handleCopyRevision}
              >
                {copied ? (
                  <>
                    <IconCheck size={16} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={16} />
                    <span>Copy Revision</span>
                  </>
                )}
              </button>
            </div>

            <div className="revision-text-box">
              <p>{result.suggested_revision}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
