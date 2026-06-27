import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import "../styles/theme.css";
import "../styles/RunDetails.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const [live, setLive] = useState(false);
  const logsEndRef = useRef(null);
  const socketRef = useRef(null);

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
          const runData = runRes.data.run ?? runRes.data;
          setRun(runData);
          const rawLogs = logsRes.data.logs ?? logsRes.data ?? [];
          setLogs(rawLogs);

          // If the run is still active, open a socket for live streaming
          const isActive = ["running", "pending", "queued"].includes(
            runData?.status?.toLowerCase(),
          );
          if (isActive) {
            const socket = io(API_URL, { withCredentials: true });
            socketRef.current = socket;

            socket.on("connect", () => {
              setLive(true);
              socket.emit("watch-run", id);
            });

            socket.on("log", (data) => {
              if (cancelled) return;
              setLogs((prev) => [...prev, data]);
              // Update run status if the worker signals completion
              if (data.type === "RUN_COMPLETED") {
                setRun((prev) => ({ ...prev, status: data.status }));
                setLive(false);
                socket.disconnect();
              }
            });

            socket.on("disconnect", () => setLive(false));
            socket.on("error", () => setLive(false));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.status === 404
              ? "Run not found."
              : `Failed to load run: ${err?.response?.data?.message ?? err.message}`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("unwatch-run", id);
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const renderLog = (line, idx) => {
    const msg = typeof line === "string" ? line : (line?.message ?? "");
    const type = line?.type ?? "log";

    if (type === "step_start") {
      return (
        <div key={idx} className="log-step-header">
          <span>{msg}</span>
        </div>
      );
    }
    if (type === "step_end") {
      const success = msg.toLowerCase().includes("success");
      return (
        <div key={idx} className={`log-step-end ${success ? "ok" : "fail"}`}>
          {msg}
        </div>
      );
    }
    if (type === "RUN_COMPLETED") {
      return (
        <div
          key={idx}
          className={`log-run-end ${line.status === "SUCCESS" ? "ok" : "fail"}`}
        >
          Pipeline{" "}
          {line.status === "SUCCESS"
            ? "completed successfully ✓"
            : `failed: ${line.error ?? "unknown error"}`}
        </div>
      );
    }

    return (
      <div key={idx} className="log-line">
        <span className="log-line-number">{idx + 1}</span>
        <span className="log-line-text">{msg}</span>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="background-grid"></div>
      <Navbar />

      <div className="page-content">
        {run && (
          <Link to={`/pipelines/${run.pipelineId}`} className="back-link">
            ← Back to {run.pipelineName ?? "pipeline"}
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
                <h1>
                  Run <span className="run-id-mono">#{run.id.slice(0, 8)}</span>
                </h1>
                <p className="page-subtitle">
                  {run.pipelineName && <span>{run.pipelineName} · </span>}
                  {run.createdAt
                    ? new Date(run.createdAt).toLocaleString()
                    : ""}
                  {run.durationSeconds != null && ` · ${run.durationSeconds}s`}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </div>

            <div className="log-console glass-card">
              <div className="log-console-header">
                <span className="log-dot red"></span>
                <span className="log-dot yellow"></span>
                <span className="log-dot green"></span>
                <span className="log-console-title">Output</span>
                {live && (
                  <span className="live-indicator">
                    <span className="live-pulse"></span>
                    live
                  </span>
                )}
              </div>
              <div className="log-console-body">
                {logs.length === 0 ? (
                  <p className="log-empty">
                    {["running", "pending", "queued"].includes(
                      run.status?.toLowerCase(),
                    )
                      ? "Waiting for logs…"
                      : "No log output."}
                  </p>
                ) : (
                  logs.map(renderLog)
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
