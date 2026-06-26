import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import "../styles/theme.css";
import "../styles/Dashboard.css";

function StatusBadge({ status }) {
  const normalized = (status || "pending").toLowerCase();
  return (
    <span className={`status-badge ${normalized}`}>
      <span className="status-dot"></span>
      {normalized}
    </span>
  );
}

function Dashboard() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPipelines() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/pipelines");
        if (!cancelled) setPipelines(res.data.pipelines ?? res.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.status === 401
              ? "Your session expired. Please log in again."
              : "Couldn't reach the backend yet — this will populate once it's connected."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPipelines();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="background-grid"></div>
      <Navbar />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h1>Pipelines</h1>
            <p className="page-subtitle">All pipelines connected to your repositories</p>
          </div>
          <Link to="/pipelines/new" className="btn-primary">
            + New Pipeline
          </Link>
        </div>

        {loading && (
          <div className="state-block">
            <div className="spinner"></div>
            <p>Loading pipelines…</p>
          </div>
        )}

        {!loading && error && (
          <div className="state-block error-block">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && pipelines.length === 0 && (
          <div className="state-block empty-block glass-card">
            <h3>No pipelines yet</h3>
            <p>Connect a repository to trigger your first automated build.</p>
            <Link to="/pipelines/new" className="btn-primary">
              Create your first pipeline
            </Link>
          </div>
        )}

        {!loading && !error && pipelines.length > 0 && (
          <div className="pipeline-grid">
            {pipelines.map((p) => (
              <Link to={`/pipelines/${p.id}`} key={p.id} className="pipeline-card glass-card">
                <div className="pipeline-card-top">
                  <h3>{p.name}</h3>
                  <StatusBadge status={p.lastRunStatus} />
                </div>
                <p className="pipeline-repo">{p.repoFullName ?? p.repo}</p>
                <div className="pipeline-card-footer">
                  <span>{p.branch ?? "main"}</span>
                  <span>{p.lastRunAt ? new Date(p.lastRunAt).toLocaleString() : "Never run"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;