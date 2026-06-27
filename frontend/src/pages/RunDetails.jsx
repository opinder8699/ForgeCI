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
    let liveBuffer = [];
    let historyLoaded = false;

    const socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (cancelled) {
        socket.disconnect();
        return;
      }
      console.log("[Socket] Connected:", socket.id);
      setLive(true);
      socket.emit("watch-run", id);
    });

    socket.on("log", (data) => {
      if (cancelled) return;

      console.log("[Socket] log event:", JSON.stringify(data));

      if (data.type === "RUN_COMPLETED") {
        setRun((prev) => ({ ...prev, status: data.status }));
        setLive(false);
      }

      const appendLog = (prev) => {
        if (
          data.type === "log" &&
          data.stepId?.startsWith("clone-") &&
          !prev.some(
            (item) => item.type === "step_start" && item.stepId === data.stepId,
          )
        ) {
          return [
            ...prev,
            {
              type: "step_start",
              stepId: data.stepId,
              stepName: "Clone repository",
              order: 0,
            },
            data,
          ];
        }

        return [...prev, data];
      };

      if (!historyLoaded) {
        liveBuffer = appendLog(liveBuffer);
      } else {
        setLogs((prev) => appendLog(prev));
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] connect_error:", err.message);
      setLive(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] disconnected:", reason);
      setLive(false);
    });

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const runRes = await api.get(`/runs/${id}`);
        if (cancelled) return;

        const runData = runRes.data.run ?? runRes.data;
        setRun(runData);

        const isActive = ["running", "pending", "queued"].includes(
          runData?.status?.toLowerCase(),
        );

        if (isActive) {
          console.log(
            "[load] liveBuffer at flush:",
            JSON.stringify(liveBuffer),
          );
          // Active run: don't touch the DB logs (they're empty mid-run).
          // Flush whatever arrived in the socket buffer during the fetch,
          // then let the socket handler append everything else live.
          historyLoaded = true;
          setLogs([...liveBuffer]);
          liveBuffer = [];
        } else {
          // Completed run: DB has the full saved logs — fetch and render them.
          const logsRes = await api.get(`/runs/${id}/logs`);
          if (cancelled) return;
          const rawLogs = logsRes.data.logs ?? logsRes.data ?? [];
          historyLoaded = true;
          setLogs(rawLogs);
          liveBuffer = [];
          setLive(false);
          socket.disconnect();
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
      setTimeout(() => {
        if (socketRef.current === socket) {
          socket.emit("unwatch-run", id);
          socket.disconnect();
        }
      }, 100);
    };
  }, [id]);

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const renderLog = (line, idx) => {
    const type = line?.type;

    if (type === "step_start") {
      return (
        <div key={idx} className="log-step-header">
          <span className="log-step-icon">▶</span>
          <span>
            Step {line.order ?? ""}: {line.stepName}
          </span>
        </div>
      );
    }

    if (type === "step_end") {
      const success = line.status === "SUCCESS";
      return (
        <div key={idx} className={`log-step-end ${success ? "ok" : "fail"}`}>
          {success ? "✓" : "✗"} {line.stepName} [
          {success ? "success" : "failed"}]
        </div>
      );
    }

    if (type === "RUN_COMPLETED") {
      return (
        <div
          key={idx}
          className={`log-run-end ${line.status === "SUCCESS" ? "ok" : "fail"}`}
        >
          {line.status === "SUCCESS"
            ? "✓ Pipeline completed successfully"
            : `✗ Pipeline failed: ${line.error ?? "unknown error"}`}
        </div>
      );
    }

    // type === "log" — regular output line
    // For legacy blob format {logs: "..."} split into lines
    if (line?.logs && !line?.message) {
      return line.logs
        .split("\n")
        .filter((l) => l.trim())
        .map((l, i) => (
          <div key={`${idx}-${i}`} className="log-line">
            <span className="log-line-number">{idx + i + 1}</span>
            <span className="log-line-text">{l.trimEnd()}</span>
          </div>
        ));
    }

    const msg = typeof line === "string" ? line : (line?.message ?? "");
    if (!msg) return null;

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
