import { useState, useEffect } from "react";
import "./BrandGuidelines.css";
import { API_BASE_URL } from "../config";
import {
  IconBrand,
  IconRefresh,
  IconSparkles,
  IconCheck,
  IconX,
  IconShield,
  IconSettings,
  IconAlertTriangle
} from "./Icons";

const INITIAL_GUIDELINES = {
  brand_name: "",
  brand_description: "",
  tone_of_voice: "",
  target_audience: "",
  preferred_words: "",
  prohibited_words: "",
  writing_rules: "",
  visual_guidelines: "",
  additional_rules: ""
};

const SAMPLE_GUIDELINES = {
  brand_name: "Inkloom AI",
  brand_description: "Inkloom AI is the premier brand governance platform helping enterprise marketing teams maintain consistent, compliant, and trustworthy advertisement communication.",
  tone_of_voice: "Authoritative yet approachable, transparent, empathetic, precise, and rigorously factual. Avoid hyperbole or condescending language.",
  target_audience: "Enterprise CMOs, brand directors, marketing compliance officers, and copywriters looking to automate brand safety.",
  preferred_words: "Intelligent governance, brand integrity, verifiable, streamlined, automated compliance, trusted, transparent, proactive protection",
  prohibited_words: "100% guaranteed, zero risk, world's best, magic, miracle cure, cheapest, unhackable, foolproof",
  writing_rules: "1. Always use active voice.\n2. Back all comparative claims with verified test data.\n3. Keep sentences concise (under 25 words).\n4. Never claim absolute outcomes or universal guarantees.",
  visual_guidelines: "Primary Palette: Indigo (#6366F1), Slate Dark (#0B1020, #172033), Emerald Accent (#10B981). Typography: Inter, sans-serif. Logo must maintain 20px clear margin.",
  additional_rules: "All promotional pricing must state the expiration date and link to standard terms. Any AI capabilities must be clearly attributed without claiming human sentient review."
};

function BrandGuidelines() {
  const [guidelines, setGuidelines] = useState(INITIAL_GUIDELINES);
  const [savedGuidelines, setSavedGuidelines] = useState(INITIAL_GUIDELINES);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch saved guidelines on mount
  const fetchGuidelines = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/brand-guidelines`);
      if (!response.ok) {
        throw new Error(`Failed to load brand guidelines (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (data.status === "success" && data.guidelines) {
        const fetchedData = {
          brand_name: data.guidelines.brand_name || "",
          brand_description: data.guidelines.brand_description || "",
          tone_of_voice: data.guidelines.tone_of_voice || "",
          target_audience: data.guidelines.target_audience || "",
          preferred_words: data.guidelines.preferred_words || "",
          prohibited_words: data.guidelines.prohibited_words || "",
          writing_rules: data.guidelines.writing_rules || "",
          visual_guidelines: data.guidelines.visual_guidelines || "",
          additional_rules: data.guidelines.additional_rules || ""
        };
        setGuidelines(fetchedData);
        setSavedGuidelines(fetchedData);
        setUpdatedAt(data.updated_at || null);
      }
    } catch (err) {
      console.error("Error fetching brand guidelines:", err);
      setErrorMessage(err.message || "Unable to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      try {
        const response = await fetch(`${API_BASE_URL}/brand-guidelines`);
        if (!response.ok) {
          throw new Error(`Failed to load brand guidelines (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (!ignore && data.status === "success" && data.guidelines) {
          const fetchedData = {
            brand_name: data.guidelines.brand_name || "",
            brand_description: data.guidelines.brand_description || "",
            tone_of_voice: data.guidelines.tone_of_voice || "",
            target_audience: data.guidelines.target_audience || "",
            preferred_words: data.guidelines.preferred_words || "",
            prohibited_words: data.guidelines.prohibited_words || "",
            writing_rules: data.guidelines.writing_rules || "",
            visual_guidelines: data.guidelines.visual_guidelines || "",
            additional_rules: data.guidelines.additional_rules || ""
          };
          setGuidelines(fetchedData);
          setSavedGuidelines(fetchedData);
          setUpdatedAt(data.updated_at || null);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching brand guidelines:", err);
          setErrorMessage(err.message || "Unable to connect to backend server.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (field, value) => {
    setGuidelines((prev) => ({
      ...prev,
      [field]: value
    }));
    if (successMessage) setSuccessMessage("");
  };

  // Determine if there are unsaved changes
  const isDirty = Object.keys(INITIAL_GUIDELINES).some(
    (key) => (guidelines[key] || "") !== (savedGuidelines[key] || "")
  );

  // Count how many fields are filled
  const configuredFieldsCount = Object.keys(INITIAL_GUIDELINES).filter(
    (key) => (guidelines[key] || "").trim().length > 0
  ).length;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/brand-guidelines`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(guidelines)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update brand guidelines.");
      }

      if (data.status === "success") {
        setSavedGuidelines({ ...guidelines });
        setUpdatedAt(data.updated_at || new Date().toISOString());
        setSuccessMessage("Brand guidelines successfully saved and synced with AI model.");
      } else {
        throw new Error("Unexpected server response");
      }
    } catch (err) {
      console.error("Error saving brand guidelines:", err);
      setErrorMessage(err.message || "Failed to save brand guidelines.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm("Discard all unsaved changes and revert to the last saved guidelines?")) {
      setGuidelines({ ...savedGuidelines });
      setErrorMessage("");
      setSuccessMessage("");
    }
  };

  const handleLoadSample = () => {
    if (isDirty && !window.confirm("Loading sample data will overwrite your current unsaved edits. Continue?")) {
      return;
    }
    setGuidelines({ ...SAMPLE_GUIDELINES });
    setSuccessMessage("Loaded sample guidelines. Click 'Save Guidelines' to persist them to the database.");
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all fields? You must click 'Save Guidelines' to apply.")) {
      setGuidelines({ ...INITIAL_GUIDELINES });
      setSuccessMessage("");
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Not saved yet";
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="guidelines-container">
        <div className="guidelines-header">
          <div>
            <h1>Brand Guidelines</h1>
            <p>Loading brand configuration from database...</p>
          </div>
        </div>
        <div className="guidelines-loading-box">
          <div className="guidelines-spinner"></div>
          <p>Retrieving your brand rules and governance profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="guidelines-container">
      {/* Top Header */}
      <div className="guidelines-header">
        <div className="header-titles">
          <div className="header-title-badge">
            <h1>Brand Guidelines</h1>
            <span className={`status-pill ${configuredFieldsCount > 0 ? "active-pill" : "empty-pill"}`}>
              {configuredFieldsCount === 9
                ? "Fully Configured (9/9)"
                : configuredFieldsCount > 0
                ? `Partially Configured (${configuredFieldsCount}/9)`
                : "Not Configured (0/9)"}
            </span>
            {isDirty && <span className="status-pill dirty-pill">Unsaved Changes</span>}
          </div>
          <p>
            Define your core brand identity, audience personas, approved vocabulary, and governance rules.
            The Groq AI rewriting engine uses these rules to tailor advertisement corrections.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchGuidelines}
            disabled={loading}
            title="Reload from backend"
          >
            <IconRefresh size={14} className={loading ? "spin-icon" : ""} /> {loading ? "Reloading..." : "Refresh"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLoadSample}
            title="Populate with recommended example template"
          >
            <IconSparkles size={14} /> Load Sample
          </button>
          {isDirty && (
            <button
              type="button"
              className="btn-secondary btn-discard"
              onClick={handleDiscard}
            >
              <IconX size={14} /> Discard
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : <><IconCheck size={15} /> Save Guidelines</>}
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="alert-banner alert-success">
          <div className="alert-content">
            <span className="alert-icon"><IconCheck size={18} /></span>
            <div>
              <strong>Success</strong>
              <p>{successMessage}</p>
            </div>
          </div>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage("")}
            title="Dismiss notification"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner alert-error">
          <div className="alert-content">
            <span className="alert-icon"><IconAlertTriangle size={18} /></span>
            <div>
              <strong>Error</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            className="alert-close"
            onClick={() => setErrorMessage("")}
            title="Dismiss notification"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* Meta Bar */}
      <div className="guidelines-meta-bar">
        <div className="meta-info">
          <span className="meta-label">Active Profile:</span>
          <strong className="meta-value">{guidelines.brand_name.trim() || "Default Brand"}</strong>
        </div>
        <div className="meta-info">
          <span className="meta-label">Last Saved:</span>
          <span className="meta-value">{formatDate(updatedAt)}</span>
        </div>
        <div className="meta-info">
          <span className="meta-label">Rules Applied to AI:</span>
          <span className="meta-value">{configuredFieldsCount} active sections</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="guidelines-form">
        {/* Section 1: Brand Identity */}
        <div className="guidelines-card">
          <div className="card-header">
            <div className="card-header-icon">
              <IconBrand size={18} />
            </div>
            <div>
              <h2>1. Brand Identity & Purpose</h2>
              <p>Establish your organization&apos;s name and mission foundation.</p>
            </div>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label htmlFor="brand_name">
                Brand Name <span className="field-required">*</span>
              </label>
              <input
                id="brand_name"
                type="text"
                className="form-input"
                placeholder="e.g. Inkloom AI or Acme Enterprise"
                value={guidelines.brand_name}
                onChange={(e) => handleChange("brand_name", e.target.value)}
              />
              <span className="field-hint">
                The official name of the brand or product to display across communications.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="brand_description">Brand Description</label>
              <textarea
                id="brand_description"
                className="form-textarea"
                rows={4}
                placeholder="Summarize your company's mission, flagship products, key value proposition, and customer promise..."
                value={guidelines.brand_description}
                onChange={(e) => handleChange("brand_description", e.target.value)}
              />
              <span className="field-hint">
                Informs the AI about your core business context and what your solution delivers.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Tone & Audience */}
        <div className="guidelines-card">
          <div className="card-header">
            <div className="card-header-icon">
              <IconSparkles size={18} />
            </div>
            <div>
              <h2>2. Voice, Tone & Target Audience</h2>
              <p>Define how your brand speaks and who it communicates with.</p>
            </div>
          </div>

          <div className="card-body grid-two-cols">
            <div className="form-group">
              <label htmlFor="tone_of_voice">Tone of Voice</label>
              <textarea
                id="tone_of_voice"
                className="form-textarea"
                rows={5}
                placeholder="e.g. Confident, transparent, empathetic, analytical, professional, and jargon-free..."
                value={guidelines.tone_of_voice}
                onChange={(e) => handleChange("tone_of_voice", e.target.value)}
              />
              <span className="field-hint">
                Characteristics and personality traits governing ad copy revisions.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="target_audience">Target Audience</label>
              <textarea
                id="target_audience"
                className="form-textarea"
                rows={5}
                placeholder="e.g. Enterprise marketing leaders, compliance teams, digital agencies, and startup founders..."
                value={guidelines.target_audience}
                onChange={(e) => handleChange("target_audience", e.target.value)}
              />
              <span className="field-hint">
                Demographics, customer segments, and personas receiving your campaigns.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Vocabulary Governance */}
        <div className="guidelines-card">
          <div className="card-header">
            <div className="card-header-icon">
              <IconShield size={18} />
            </div>
            <div>
              <h2>3. Vocabulary & Language Governance</h2>
              <p>Curate approved phrasing and block risky, deceptive, or off-brand terminology.</p>
            </div>
          </div>

          <div className="card-body grid-two-cols">
            <div className="form-group">
              <label htmlFor="preferred_words" className="label-preferred">
                ✓ Preferred Words & Phrases
              </label>
              <textarea
                id="preferred_words"
                className="form-textarea textarea-preferred"
                rows={5}
                placeholder="e.g. Trusted, streamlined, verifiable, intelligent governance, data-driven, authentic..."
                value={guidelines.preferred_words}
                onChange={(e) => handleChange("preferred_words", e.target.value)}
              />
              <span className="field-hint">
                Terms and positive phrases the AI should prioritize when rewriting advertisements.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="prohibited_words" className="label-prohibited">
                ✕ Prohibited Words & Forbidden Claims
              </label>
              <textarea
                id="prohibited_words"
                className="form-textarea textarea-prohibited"
                rows={5}
                placeholder="e.g. 100% guaranteed, risk-free, magic, world's best, miracle, zero effort, unhackable..."
                value={guidelines.prohibited_words}
                onChange={(e) => handleChange("prohibited_words", e.target.value)}
              />
              <span className="field-hint">
                Forbidden words, superlatives, and high-risk claims that must never appear in copy.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Rules & Guidelines */}
        <div className="guidelines-card">
          <div className="card-header">
            <div className="card-header-icon">
              <IconSettings size={18} />
            </div>
            <div>
              <h2>4. Writing, Visual & Governance Standards</h2>
              <p>Define detailed editorial rules, visual styling standards, and legal requirements.</p>
            </div>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label htmlFor="writing_rules">Writing Rules & Editorial Standards</label>
              <textarea
                id="writing_rules"
                className="form-textarea"
                rows={4}
                placeholder="e.g. Always write in active voice. Limit sentences to under 25 words. All performance statistics require cited benchmarks..."
                value={guidelines.writing_rules}
                onChange={(e) => handleChange("writing_rules", e.target.value)}
              />
              <span className="field-hint">
                Grammar, punctuation, stylistic boundaries, and structural copy requirements.
              </span>
            </div>

            <div className="grid-two-cols">
              <div className="form-group">
                <label htmlFor="visual_guidelines">Visual Guidelines</label>
                <textarea
                  id="visual_guidelines"
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. Primary Color: #6366F1, Dark Background: #0B1020. Typography: Inter. Logo clear margin: 24px..."
                  value={guidelines.visual_guidelines}
                  onChange={(e) => handleChange("visual_guidelines", e.target.value)}
                />
                <span className="field-hint">
                  Brand colors, typography specs, layout rules, and visual identity notes.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="additional_rules">Additional Rules & Disclaimers</label>
                <textarea
                  id="additional_rules"
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. All pricing promotions must link to terms. State that results may vary based on usage..."
                  value={guidelines.additional_rules}
                  onChange={(e) => handleChange("additional_rules", e.target.value)}
                />
                <span className="field-hint">
                  Mandatory regulatory disclaimers, trademark guidelines, or special compliance checks.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="guidelines-footer-actions">
          <div className="footer-left">
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleClearAll}
            >
              Clear All Fields
            </button>
            {isDirty && (
              <span className="dirty-indicator">
                • You have unsaved changes
              </span>
            )}
          </div>

          <div className="footer-right">
            {isDirty && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDiscard}
              >
                Discard Changes
              </button>
            )}
            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={saving}
            >
              {saving ? "Saving Guidelines..." : "Save Brand Guidelines"}
            </button>
          </div>
        </div>
      </form>

      {/* AI Enforcement Explainer */}
      <div className="ai-explainer-card">
        <div className="ai-explainer-icon">
          <IconSparkles size={22} />
        </div>
        <div className="ai-explainer-content">
          <h3>How Brand Guidelines Govern AI Content Analysis</h3>
          <p>
            Whenever the <strong>Content Analyzer</strong> detects compliance issues (such as unrealistic guarantees,
            unverified claims, or artificial urgency), Groq AI injects these 9 guideline fields into its system prompt.
            The AI generates suggested revisions that strictly preserve your approved brand voice, weave in preferred vocabulary,
            and purge prohibited claims.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BrandGuidelines;
