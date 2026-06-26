import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import "../styles/theme.css";
import "../styles/PipelineDetails.css";

function StatusBadge({ status }) {
  const normalized = (status || "pending").toLowerCase();
  return (
    <span className={`status-badge ${normalized}`}>
      <span className="status-dot"></span>
      {normalized}
    </span>
  );
}

function PipelineDetails() {
  const { id } = useParams();
  const [pipeline, setPipeline] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [pipelineRes, runsRes] = await Promise.all([
          api.get(`/pipelines/${id}`),
          api.get(`/pipelines/${id}/runs`),
        ]);
        if (!cancelled) {
          setPipeline(pipelineRes.data.pipeline ?? pipelineRes.data);
          setRuns(runsRes.data.runs ?? runsRes.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load this pipeline yet — backend isn't connected.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleTriggerRun = async () => {
    setTriggering(true);
    try {
      const res = await api.post(`/pipelines/${id}/runs`);
      const newRun = res.data.run ?? res.data;
      setRuns((prev) => [newRun, ...prev]);
    } catch {
      setError("Couldn't trigger a run — backend isn't connected.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="background-grid"></div>
      <Navbar />

      <div className="page-content">
        <Link to="/dashboard" className="back-link">
          ← All pipelines
        </Link>

        {loading && (
          <div className="state-block">
            <div className="spinner"></div>
            <p>Loading pipeline…</p>
          </div>
        )}

        {!loading && error && !pipeline && (
          <div className="state-block error-block">
            <p>{error}</p>
          </div>
        )}

        {!loading && pipeline && (
          <>
            <div className="page-header">
              <div>
                <h1>{pipeline.name}</h1>
                <p className="page-subtitle">{pipeline.repoFullName ?? pipeline.repo}</p>
              </div>
              <button className="btn-primary" onClick={handleTriggerRun} disabled={triggering}>
                {triggering ? "Starting…" : "Trigger Run"}
              </button>
            </div>

            <div className="glass-card pipeline-meta">
              <div>
                <span className="meta-label">Branch</span>
                <span className="meta-value">{pipeline.branch ?? "main"}</span>
              </div>
              <div>
                <span className="meta-label">Build command</span>
                <span className="meta-value mono">{pipeline.buildCommand ?? "—"}</span>
              </div>
              <div>
                <span className="meta-label">Last status</span>
                <StatusBadge status={pipeline.lastRunStatus} />
              </div>
            </div>

            <h2 className="section-title">Run history</h2>

            {runs.length === 0 ? (
              <div className="state-block empty-block glass-card">
                <p>No runs yet. Trigger your first run above.</p>
              </div>
            ) : (
              <div className="run-list">
                {runs.map((run) => (
                  <Link to={`/runs/${run.id}`} key={run.id} className="run-row glass-card">
                    <StatusBadge status={run.status} />
                    <span className="run-id">#{run.id}</span>
                    <span className="run-time">
                      {run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}
                    </span>
                    <span className="run-duration">{run.durationSeconds ? `${run.durationSeconds}s` : ""}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PipelineDetails;