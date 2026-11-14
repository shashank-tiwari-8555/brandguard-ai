import { useState, useEffect, useRef } from "react";
import "./ContentAnalyzer.css";
import { API_BASE_URL } from "../config";
import {
  IconSparkles,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconShield,
  IconX,
  IconImage,
  IconUpload,
  IconFileText
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

const SAMPLE_POSTERS = [
  {
    label: "High-Risk Promo Poster",
    filename: "sample_promo_poster.png",
    hint: "Includes 100% guarantee, zero risk & fake urgency"
  },
  {
    label: "Compliant Enterprise Poster",
    filename: "sample_compliant_poster.png",
    hint: "Transparent governance copy with brand disclaimers"
  }
];

export default function ContentAnalyzer() {
  const [mode, setMode] = useState("text"); // "text" | "image"
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeBrand, setActiveBrand] = useState("Inkloom AI");
  const [copied, setCopied] = useState(false);
  const [copiedExtracted, setCopiedExtracted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

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

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateAndSetFile = (file) => {
    setError("");
    const validExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const name = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => name.endsWith(ext));

    if (!validMimes.includes(file.type) && !hasValidExt) {
      setError("Unsupported file format. Please upload a PNG, JPG, JPEG, or WEBP image.");
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10 MB maximum limit. Please select a smaller image.");
      return false;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setResult(null);
    return true;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLoadSamplePoster = async (filename) => {
    try {
      setError("");
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) {
        throw new Error("Unable to retrieve sample poster asset.");
      }
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "image/png" });
      validateAndSetFile(file);
    } catch (err) {
      setError(err.message || "Failed to load sample poster image.");
    }
  };

  const handleAnalyzeText = async () => {
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

  const handleAnalyzeImage = async () => {
    if (!selectedFile) {
      setError("Please select or drop an advertisement poster image before running analysis.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Image analysis failed with HTTP ${response.status}`);
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

  const handleCopyExtracted = () => {
    if (!result?.extracted_text) return;
    navigator.clipboard.writeText(result.extracted_text);
    setCopiedExtracted(true);
    setTimeout(() => setCopiedExtracted(false), 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const riskClass = (result?.risk_level || "low").toLowerCase();

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
            Evaluate promotional copy and visual advertisement posters against active brand tone, prohibited terminology, and truth-in-advertising standards using Groq AI.
          </p>
        </div>
      </div>

      {/* Input Mode Selector Bar */}
      <div className="analyzer-mode-toggle-card">
        <div className="analyzer-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${mode === "text" ? "active" : ""}`}
            onClick={() => {
              setMode("text");
              setError("");
            }}
          >
            <IconFileText size={16} />
            <span>Text Copy Analysis</span>
          </button>

          <button
            type="button"
            className={`mode-btn ${mode === "image" ? "active" : ""}`}
            onClick={() => {
              setMode("image");
              setError("");
            }}
          >
            <IconImage size={16} />
            <span>Poster & Image Analysis</span>
            <span className="mode-new-pill">OCR AI</span>
          </button>
        </div>

        <div className="mode-description-hint">
          {mode === "text"
            ? "Inspect headlines, body copy, email text, or advertising scripts."
            : "Upload promotional posters, social media banners, or flyers in PNG, JPG, or WEBP."}
        </div>
      </div>

      {/* Mode 1: Text Copy Input */}
      {mode === "text" && (
        <div className="analyzer-input-card">
          <div className="input-card-header">
            <div className="input-title-wrap">
              <h2>Advertisement Copy</h2>
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
              onClick={handleAnalyzeText}
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
      )}

      {/* Mode 2: Poster & Image Upload Input */}
      {mode === "image" && (
        <div className="analyzer-input-card image-mode-card">
          <div className="input-card-header">
            <div className="input-title-wrap">
              <h2>Advertisement Poster / Banner Image</h2>
              <span className="input-hint">
                RapidOCR extracts visible text; Groq AI analyzes compliance against active brand guidelines
              </span>
            </div>

            <div className="sample-chips">
              <span className="sample-label">Sample Posters:</span>
              {SAMPLE_POSTERS.map((poster, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="sample-chip-btn"
                  onClick={() => handleLoadSamplePoster(poster.filename)}
                  title={poster.hint}
                >
                  ✦ {poster.label}
                </button>
              ))}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="file-input-hidden"
            onChange={handleFileInputChange}
          />

          {!selectedFile ? (
            <div
              className={`image-dropzone ${dragActive ? "dropzone-active" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon-box">
                <IconUpload size={28} />
              </div>

              <div className="dropzone-text-group">
                <h3>Drag and drop advertisement poster here</h3>
                <p>or click to browse image files from your computer</p>
              </div>

              <div className="supported-formats-row">
                <span className="format-tag">PNG</span>
                <span className="format-tag">JPG / JPEG</span>
                <span className="format-tag">WEBP</span>
                <span className="format-max-size">Max 10 MB</span>
              </div>
            </div>
          ) : (
            <div className="selected-file-preview-card">
              <div className="preview-left">
                {previewUrl && (
                  <div className="preview-thumbnail-wrap">
                    <img src={previewUrl} alt="Selected ad poster" className="preview-thumbnail-img" />
                  </div>
                )}
                <div className="preview-meta">
                  <span className="preview-filename">{selectedFile.name}</span>
                  <div className="preview-details">
                    <span className="file-size-tag">{formatFileSize(selectedFile.size)}</span>
                    <span className="file-type-tag">{selectedFile.type || "image"}</span>
                  </div>
                </div>
              </div>

              <div className="preview-actions">
                <button
                  type="button"
                  className="btn-replace-image"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace Image
                </button>
                <button
                  type="button"
                  className="btn-remove-image"
                  onClick={handleRemoveImage}
                  title="Remove image"
                >
                  <IconX size={16} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          <div className="analyzer-actions-bar">
            <span className="char-count">
              {selectedFile ? `Ready to audit: ${selectedFile.name}` : "No poster selected"}
            </span>

            <button
              type="button"
              className="btn-run-analysis"
              onClick={handleAnalyzeImage}
              disabled={loading || !selectedFile}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  <span>Scanning Text & Evaluating Compliance...</span>
                </>
              ) : (
                <>
                  <IconSparkles size={16} />
                  <span>Analyse Advertisement Image →</span>
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
      )}

      {/* Analysis Results View */}
      {result && (
        <div className="analysis-results-section">
          <div className="results-overview-header">
            <div>
              <h2>Audit Results</h2>
              <span className="source-pill">
                Engine: {result.processing_engine || result.revision_source || "Groq AI"}
              </span>
            </div>
            <span className="analysis-id-badge">
              Analysis #{result.analysis_id || "Active"}
            </span>
          </div>

          {/* Special Visual / OCR Overview Card for Image Mode */}
          {result.analysis_mode === "image" && (
            <div className="image-audit-overview-card">
              <div className="image-audit-header">
                <div className="image-audit-title-wrap">
                  <span className="analysis-mode-pill image-mode-pill">
                    <IconImage size={14} /> Poster / Image Analysis
                  </span>
                  <h3>{result.image_filename || "Uploaded Advertisement Poster"}</h3>
                </div>

                <span
                  className={`ocr-status-pill ${
                    result.ocr_status === "success"
                      ? "ocr-status-success"
                      : "ocr-status-warning"
                  }`}
                >
                  {result.ocr_status === "success" ? (
                    <>
                      <IconCheck size={13} />
                      <span>OCR Extraction Completed</span>
                    </>
                  ) : (
                    <>
                      <IconAlertTriangle size={13} />
                      <span>OCR: {result.ocr_status}</span>
                    </>
                  )}
                </span>
              </div>

              <div className="image-audit-grid">
                {(previewUrl || result.image_url || result.image_path) && (
                  <div className="image-preview-panel">
                    <div className="preview-label">Uploaded Advertisement Poster</div>
                    <div className="preview-img-container">
                      <img
                        src={
                          previewUrl ||
                          (result.image_url
                            ? `${API_BASE_URL}${result.image_url}`
                            : `${API_BASE_URL}/images/${result.image_path}`)
                        }
                        alt="Analyzed Advertisement"
                        className="audited-poster-img"
                      />
                    </div>
                  </div>
                )}

                <div className="ocr-extracted-panel">
                  <div className="extracted-header">
                    <div className="extracted-title">
                      <IconFileText size={15} />
                      <span>Extracted Visible Advertisement Copy</span>
                    </div>

                    {result.extracted_text && (
                      <button
                        type="button"
                        className="btn-copy-ocr"
                        onClick={handleCopyExtracted}
                        title="Copy extracted OCR text"
                      >
                        {copiedExtracted ? (
                          <>
                            <IconCheck size={13} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <IconCopy size={13} />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="extracted-content-box">
                    {result.extracted_text ? (
                      <pre className="extracted-text-pre">{result.extracted_text}</pre>
                    ) : (
                      <div className="no-text-notice">
                        <IconAlertTriangle size={16} />
                        <span>No visible text was detected in this poster image.</span>
                      </div>
                    )}
                  </div>

                  <div className="ai-transparency-note">
                    <IconSparkles size={16} className="sparkle-indigo" />
                    <div className="transparency-text">
                      <strong>AI Processing Pipeline:</strong>
                      <p>{result.ai_multimodal_status}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
