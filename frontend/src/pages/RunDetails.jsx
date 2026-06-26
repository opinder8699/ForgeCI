import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import "../styles/theme.css";
import "../styles/RunDetails.css";

function StatusBadge({ status }) {
  const normalized = (status || "pending").toLowerCase();
  return (
    <span className={`status-badge ${normalized}`}>
      <span className="status-dot"></span>
      {normalized}
    </span>
  );
}

function RunDetails() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [runRes, logsRes] = await Promise.all([
          api.get(`/runs/${id}`),
          api.get(`/runs/${id}/logs`),
        ]);
        if (!cancelled) {
          setRun(runRes.data.run ?? runRes.data);
          setLogs(logsRes.data.logs ?? logsRes.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't load this run yet — backend isn't connected.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };

    // NOTE: once Socket.io is wired up, this is where we'll open a socket
    // (e.g. `io(API_URL).on(`run:${id}:log`, appendLog)`) instead of /
    // in addition to the one-time /logs fetch above, and push incoming
    // lines into `logs` with setLogs(prev => [...prev, newLine]).
  }, [id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="app-shell">
      <div className="background-grid"></div>
      <Navbar />

      <div className="page-content">
        {run && (
          <Link to={`/pipelines/${run.pipelineId}`} className="back-link">
            ← Back to pipeline
          </Link>
        )}

        {loading && (
          <div className="state-block">
            <div className="spinner"></div>
            <p>Loading run…</p>
          </div>
        )}

        {!loading && error && !run && (
          <div className="state-block error-block">
            <p>{error}</p>
          </div>
        )}

        {!loading && run && (
          <>
            <div className="page-header">
              <div>
                <h1>Run #{run.id}</h1>
                <p className="page-subtitle">
                  {run.createdAt ? new Date(run.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </div>

            <div className="log-console glass-card">
              <div className="log-console-header">
                <span className="log-dot red"></span>
                <span className="log-dot yellow"></span>
                <span className="log-dot green"></span>
                <span className="log-console-title">build output</span>
                {run.status === "running" && <span className="live-indicator">● live</span>}
              </div>
              <div className="log-console-body">
                {logs.length === 0 ? (
                  <p className="log-empty">No log output yet.</p>
                ) : (
                  logs.map((line, idx) => (
                    <div key={idx} className="log-line">
                      <span className="log-line-number">{idx + 1}</span>
                      <span className="log-line-text">{typeof line === "string" ? line : line.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RunDetails;