// import { useEffect, useState } from "react";
// import { useParams, Link } from "react-router-dom";
// import Navbar from "../components/Navbar";
// import api from "../api/axios";
// import "../styles/theme.css";
// import "../styles/PipelineDetails.css";

// function StatusBadge({ status }) {
//   const normalized = (status || "pending").toLowerCase();
//   return (
//     <span className={`status-badge ${normalized}`}>
//       <span className="status-dot"></span>
//       {normalized}
//     </span>
//   );
// }

// function PipelineDetails() {
//   const { id } = useParams();
//   const [pipeline, setPipeline] = useState(null);
//   const [runs, setRuns] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [triggering, setTriggering] = useState(false);

//   useEffect(() => {
//     let cancelled = false;

//     async function load() {
//       setLoading(true);
//       setError(null);
//       try {
//         const [pipelineRes, runsRes] = await Promise.all([
//           api.get(`/pipelines/${id}`),
//           api.get(`/pipelines/${id}/runs`),
//         ]);
//         if (!cancelled) {
//           setPipeline(pipelineRes.data.pipeline ?? pipelineRes.data);
//           setRuns(runsRes.data.runs ?? runsRes.data ?? []);
//         }
//       } catch {
//         if (!cancelled) {
//           setError("Couldn't load this pipeline yet — backend isn't connected.");
//         }
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, [id]);

//   const handleTriggerRun = async () => {
//     setTriggering(true);
//     try {
//       const res = await api.post(`/pipelines/${id}/runs`);
//       const newRun = res.data.run ?? res.data;
//       setRuns((prev) => [newRun, ...prev]);
//     } catch {
//       setError("Couldn't trigger a run — backend isn't connected.");
//     } finally {
//       setTriggering(false);
//     }
//   };

//   return (
//     <div className="app-shell">
//       <div className="background-grid"></div>
//       <Navbar />

//       <div className="page-content">
//         <Link to="/dashboard" className="back-link">
//           ← All pipelines
//         </Link>

//         {loading && (
//           <div className="state-block">
//             <div className="spinner"></div>
//             <p>Loading pipeline…</p>
//           </div>
//         )}

//         {!loading && error && !pipeline && (
//           <div className="state-block error-block">
//             <p>{error}</p>
//           </div>
//         )}

//         {!loading && pipeline && (
//           <>
//             <div className="page-header">
//               <div>
//                 <h1>{pipeline.name}</h1>
//                 <p className="page-subtitle">{pipeline.repoFullName ?? pipeline.repo}</p>
//               </div>
//               <button className="btn-primary" onClick={handleTriggerRun} disabled={triggering}>
//                 {triggering ? "Starting…" : "Trigger Run"}
//               </button>
//             </div>

//             <div className="glass-card pipeline-meta">
//               <div>
//                 <span className="meta-label">Branch</span>
//                 <span className="meta-value">{pipeline.branch ?? "main"}</span>
//               </div>
//               <div>
//                 <span className="meta-label">Build command</span>
//                 <span className="meta-value mono">{pipeline.buildCommand ?? "—"}</span>
//               </div>
//               <div>
//                 <span className="meta-label">Last status</span>
//                 <StatusBadge status={pipeline.lastRunStatus} />
//               </div>
//             </div>

//             <h2 className="section-title">Run history</h2>

//             {runs.length === 0 ? (
//               <div className="state-block empty-block glass-card">
//                 <p>No runs yet. Trigger your first run above.</p>
//               </div>
//             ) : (
//               <div className="run-list">
//                 {runs.map((run) => (
//                   <Link to={`/runs/${run.id}`} key={run.id} className="run-row glass-card">
//                     <StatusBadge status={run.status} />
//                     <span className="run-id">#{run.id}</span>
//                     <span className="run-time">
//                       {run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}
//                     </span>
//                     <span className="run-duration">{run.durationSeconds ? `${run.durationSeconds}s` : ""}</span>
//                   </Link>
//                 ))}
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

// export default PipelineDetails;
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ branch: "", yamlConfig: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

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
          const p = pipelineRes.data.pipeline ?? pipelineRes.data;
          setPipeline(p);
          setEditForm({
            branch: p.branch ?? "main",
            yamlConfig: p.yamlConfig ?? "",
          });
          setRuns(runsRes.data.runs ?? runsRes.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.status === 404
              ? "Pipeline not found."
              : `Failed to load pipeline: ${err?.response?.data?.message ?? err.message}`,
          );
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
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to trigger run.");
    } finally {
      setTriggering(false);
    }
  };

  const handleDeletePipeline = async () => {
    if (
      !confirm(
        "Delete this pipeline and all its run history? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      await api.delete(`/pipelines/${id}`);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to delete pipeline.");
      setDeleting(false);
    }
  };

  const handleDeleteRun = async (e, runId) => {
    e.preventDefault();
    if (!confirm("Delete this run?")) return;
    setDeletingRunId(runId);
    try {
      await api.delete(`/runs/${runId}`);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to delete run.");
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const res = await api.patch(`/pipelines/${id}`, editForm);
      const updated = res.data.pipeline ?? res.data;
      setPipeline((prev) => ({ ...prev, ...updated }));
      setEditOpen(false);
    } catch (err) {
      setEditError(err?.response?.data?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
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
                <p className="page-subtitle pipeline-repo-url">
                  {pipeline.repoUrl}
                </p>
              </div>
              <div className="page-header-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </button>
                <button
                  className="btn-danger"
                  onClick={handleDeletePipeline}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleTriggerRun}
                  disabled={triggering}
                >
                  {triggering ? "Starting…" : "▶ Trigger Run"}
                </button>
              </div>
            </div>

            {error && (
              <div className="inline-error">
                <p>{error}</p>
              </div>
            )}

            <div className="glass-card pipeline-meta">
              <div className="meta-item">
                <span className="meta-label">Branch</span>
                <span className="meta-value branch-tag">
                  ⎇ {pipeline.branch ?? "main"}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Last status</span>
                <StatusBadge status={pipeline.lastRunStatus} />
              </div>
              <div className="meta-item">
                <span className="meta-label">Last run</span>
                <span className="meta-value">
                  {pipeline.lastRunAt
                    ? new Date(pipeline.lastRunAt).toLocaleString()
                    : "Never"}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">
                  {new Date(pipeline.createdAt).toLocaleDateString()}
                </span>
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
                  <div key={run.id} className="run-row-wrapper">
                    <Link to={`/runs/${run.id}`} className="run-row glass-card">
                      <StatusBadge status={run.status} />
                      <span className="run-id">#{run.id.slice(0, 8)}</span>
                      <span className="run-time">
                        {run.createdAt
                          ? new Date(run.createdAt).toLocaleString()
                          : "—"}
                      </span>
                      {run.durationSeconds != null && (
                        <span className="run-duration">
                          {run.durationSeconds}s
                        </span>
                      )}
                    </Link>
                    <button
                      className="run-delete-btn"
                      onClick={(e) => handleDeleteRun(e, run.id)}
                      disabled={deletingRunId === run.id}
                      title="Delete run"
                    >
                      {deletingRunId === run.id ? "…" : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit pipeline modal */}
      {editOpen && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div
            className="modal glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Edit Pipeline</h2>
              <button
                className="modal-close"
                onClick={() => setEditOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-body">
              <label className="form-field">
                <span>Branch</span>
                <input
                  type="text"
                  value={editForm.branch}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, branch: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Pipeline YAML</span>
                <div className="yaml-editor-wrap">
                  <div className="yaml-editor-header">
                    <span className="yaml-lang">YAML</span>
                  </div>
                  <textarea
                    className="yaml-textarea"
                    rows={14}
                    value={editForm.yamlConfig}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, yamlConfig: e.target.value }))
                    }
                    spellCheck={false}
                    required
                  />
                </div>
              </label>
              {editError && <p className="form-error">{editError}</p>}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PipelineDetails;
