import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import "../styles/theme.css";
import "../styles/CreatePipeline.css";

// Starter YAML template matching the backend schema:
// name, steps[].name / image / command
const YAML_TEMPLATE = `name: my-pipeline
 
steps:
  - name: Install dependencies
    image: node:18-alpine
    command: npm install
 
  - name: Run tests
    image: node:18-alpine
    command: npm test
 
  - name: Build
    image: node:18-alpine
    command: npm run build
`;

function CreatePipeline() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    repoUrl: "",
    yamlConfig: YAML_TEMPLATE,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/pipelines", form);
      const newId = res.data.pipeline?.id ?? res.data.id;
      navigate(newId ? `/pipelines/${newId}` : "/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message ?? "Couldn't create the pipeline.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="background-grid"></div>
      <Navbar />

      <div className="page-content narrow">
        <div className="page-header">
          <div>
            <h1>New Pipeline</h1>
            <p className="page-subtitle">
              Connect a repository and define your build steps in YAML
            </p>
          </div>
        </div>

        <form className="glass-card pipeline-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Repository URL</span>
            <input
              type="text"
              name="repoUrl"
              placeholder="https://github.com/opinder8699/ForgeCI"
              value={form.repoUrl}
              onChange={handleChange}
              required
            />
            <span className="form-hint">
              Full GitHub repo URL — a webhook will be registered on it
            </span>
          </label>

          <label className="form-field">
            <span>Pipeline config (YAML)</span>
            <div className="yaml-editor-wrap">
              <div className="yaml-editor-header">
                <span className="yaml-lang">YAML</span>
                <button
                  type="button"
                  className="yaml-reset-btn"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, yamlConfig: YAML_TEMPLATE }))
                  }
                >
                  Reset to template
                </button>
              </div>
              <textarea
                name="yamlConfig"
                className="yaml-textarea"
                rows={16}
                value={form.yamlConfig}
                onChange={handleChange}
                spellCheck={false}
                required
              />
            </div>
            <span className="form-hint">
              Each step needs <code>name</code>, <code>image</code> (Docker
              image), and <code>command</code>
            </span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Pipeline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePipeline;
