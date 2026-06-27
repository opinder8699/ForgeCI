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
  const [deletingId, setDeletingId] = useState(null);

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
              : `Failed to load pipelines: ${err?.response?.data?.message ?? err.message}`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPipelines();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (e, pipelineId) => {
    e.preventDefault(); // don't follow the card link
    if (!confirm("Delete this pipeline and all its run history?")) return;
    setDeletingId(pipelineId);
    try {
      await api.delete(`/pipelines/${pipelineId}`);
      setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
    } catch (err) {
      alert(err?.response?.data?.message ?? "Failed to delete pipeline.");
    } finally {
      setDeletingId(null);
    }
  };

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
            <div className="empty-icon">⚡</div>
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
              <div key={p.id} className="pipeline-card-wrapper">
                <Link to={`/pipelines/${p.id}`} className="pipeline-card glass-card">
                  <div className="pipeline-card-top">
                    <h3>{p.name}</h3>
                    <StatusBadge status={p.lastRunStatus} />
                  </div>
                  <p className="pipeline-repo">{p.repoUrl}</p>
                  <div className="pipeline-card-footer">
                    <span className="branch-tag">⎇ {p.branch ?? "main"}</span>
                    <span>{p.lastRunAt ? new Date(p.lastRunAt).toLocaleString() : "Never run"}</span>
                  </div>
                </Link>
                <button
                  className="pipeline-delete-btn"
                  onClick={(e) => handleDelete(e, p.id)}
                  disabled={deletingId === p.id}
                  title="Delete pipeline"
                >
                  {deletingId === p.id ? "…" : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;