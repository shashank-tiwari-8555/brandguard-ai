import { useState } from "react";
import "./ContentAnalyzer.css";
import { API_BASE_URL } from "../config";

function ContentAnalyzer() {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!content.trim()) {
        alert("Please enter advertisement content first.");
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Analysis failed");
        }

        setResult(data);
        console.log("Analysis Result:", data);

    } catch (error) {
        console.error("Error:", error);
        alert("Unable to connect to backend.");
    } finally {
        setLoading(false);
    }
};

    return (
        <div className="analyzer">
            <div className="analyzer-header">
                <h1>Content Analyzer</h1>
                <p>Analyze advertisements and identify potential brand compliance issues.</p>
            </div>

            <div className="analyzer-card">
                <h2>Advertisement Content</h2>
                <p>Paste your advertisement text below for analysis.</p>

                <textarea
                    placeholder="Enter your advertisement content here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                <div className="analyzer-actions">
                    <span>{content.length} characters</span>

                    <button onClick={handleAnalyze} disabled={loading}>
                        {loading ? "Analyzing..." : "Analyze Content →"}
                    </button>
                </div>
            </div>

{result && (
  <div className="analysis-results">

    <h2>Analysis Results</h2>

    <div className="result-summary">
      <div className="result-box">
        <h3>Risk Score</h3>
        <p>{result.risk_score}/100</p>
      </div>

      <div className="result-box">
        <h3>Risk Level</h3>
        <p>{result.risk_level}</p>
      </div>

      <div className="result-box">
        <h3>Total Issues</h3>
        <p>{result.total_issues}</p>
      </div>
    </div>

    <h3>Detected Issues</h3>

    {result.issues && result.issues.length > 0 ? (
      result.issues.map((issue, index) => (
        <div className="issue-card" key={index}>
          <h4>{issue.type}</h4>
          <p><strong>Claim:</strong> {issue.claim}</p>
          <p><strong>Explanation:</strong> {issue.explanation}</p>
          <p><strong>Severity:</strong> {issue.severity}</p>
          <p><strong>Recommendation:</strong> {issue.recommendation}</p>
        </div>
      ))
    ) : (
      <div className="no-issues-card">
        <p>✓ No brand or compliance violations detected. Content complies with your brand guidelines.</p>
      </div>
    )}

    <div className="revision-box">
    <h3>Suggested Revision</h3>

    <p>{result.suggested_revision}</p>

    <button
        className="copy-revision-btn"
        onClick={() => {
            navigator.clipboard.writeText(
                result.suggested_revision
            );
            alert("Suggested revision copied!");
        }}
    >
        Copy Revision
    </button>
</div>

  </div>
)}

        </div>
    );
}

export default ContentAnalyzer;