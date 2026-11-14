import Approvals from "./components/Approvals";
import { useState, useEffect } from "react";
import "./App.css";
import ContentAnalyzer from "./components/ContentAnalyzer";
import BrandGuidelines from "./components/BrandGuidelines";
import { API_BASE_URL } from "./config";

// HISTORY COMPONENT
function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/history`
        );

        if (!response.ok) {
          throw new Error("Unable to fetch history.");
        }

        const data = await response.json();
        setHistory(data.history || []);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return <h2>Loading history...</h2>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <section className="activity">
      <h1>Analysis History</h1>
      <p>View all your previously analyzed advertisements.</p>

      <h3>Total Analyses: {history.length}</h3>

      {history.length === 0 ? (
        <p>No analysis records found.</p>
      ) : (
        history.map((item) => (
          <div className="history-card" key={item.id}>

            <h3>Analysis #{item.id}</h3>

            <p>
              <strong>Original Content:</strong>
              {" "}{item.original_content}
            </p>

            <div className="stats">
              <div className="stat">
                <span>Risk Score</span>
                <h2>{item.risk_score}/100</h2>
              </div>

              <div className="stat">
                <span>Risk Level</span>
                <h2>{item.risk_level}</h2>
              </div>

              <div className="stat">
                <span>Total Issues</span>
                <h2>{item.total_issues}</h2>
              </div>
            </div>

            <p>
              <strong>Approval Status:</strong>
              {" "}{item.approval_status}
            </p>

            <p>
              <strong>Date:</strong>
              {" "}
              {item.created_at
                ? new Date(item.created_at).toLocaleString()
                : "Not available"}
            </p>

            <div className="revision-box">
              <h3>Suggested Revision</h3>
              <p>{item.suggested_revision}</p>
            </div>

          </div>
        ))
      )}
    </section>
  );
}

// MAIN APP
function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const menuItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Brand Guidelines", icon: "◇" },
    { name: "Content Analyzer", icon: "⌕" },
    { name: "Approvals", icon: "✓" },
    { name: "History", icon: "◷" },
    { name: "Settings", icon: "⚙" }
  ];

  const openAnalyzer = () => {
    setActivePage("Content Analyzer");
  };

  return (
    <div className="app">

      <aside className="sidebar">
        <h2>✦ Inkloom AI</h2>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={
                activePage === item.name ? "active" : ""
              }
              onClick={() => setActivePage(item.name)}
            >
              {item.icon} {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <p>AI Brand Governance</p>
          <small>Prototype v1.0</small>
        </div>
      </aside>

      <main className="main">

        {activePage === "Brand Guidelines" && (
          <BrandGuidelines />
        )}

        {activePage === "Content Analyzer" && (
          <ContentAnalyzer />
        )}
        {activePage === "Approvals" && (
          <Approvals />
        )}

        {activePage === "History" && (
          <HistoryPage />
        )}

        {activePage === "Dashboard" && (
          <>
            <header>
              <div>
                <h1>Dashboard</h1>
                <p>
                  Welcome to your intelligent brand governance workspace.
                </p>
              </div>

              <button onClick={openAnalyzer}>
                + New Analysis
              </button>
            </header>

            <section className="welcome">
              <h2>Protect your brand. Build customer trust.</h2>

              <p>
                Analyze advertisements, detect misleading claims,
                and maintain consistent brand communication.
              </p>

              <button onClick={openAnalyzer}>
                Start Analyzing →
              </button>
            </section>

            <section className="stats">
              <div className="stat">
                <span>Total Analyses</span>
                <h2>0</h2>
                <small>All time</small>
              </div>

              <div className="stat">
                <span>Compliant Content</span>
                <h2>0</h2>
                <small>Awaiting first analysis</small>
              </div>

              <div className="stat">
                <span>Issues Detected</span>
                <h2>0</h2>
                <small>Potential brand violations</small>
              </div>

              <div className="stat">
                <span>Pending Approvals</span>
                <h2>0</h2>
                <small>Human review required</small>
              </div>
            </section>

            <section className="activity">
              <h2>Recent Activity</h2>
              <p>
                No activity yet. Start your first content analysis.
              </p>
            </section>
          </>
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Brand Guidelines" &&
          activePage !== "Content Analyzer" &&
          activePage !== "Approvals" &&
          activePage !== "History" && (
            <section className="activity">
              <h1>{activePage}</h1>
              <p>
                The {activePage} module is not implemented yet.
              </p>
              <p>
                This section will be developed in the next phase
                of Inkloom AI.
              </p>
            </section>
          )}

      </main>
    </div>
  );
}

export default App;
