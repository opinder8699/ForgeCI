import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "../styles/Login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Login() {
  const { isAuthenticated, loading } = useAuth();

  const handleGithubLogin = () => {
    window.location.href = `${API_URL}/api/auth/github`;
  };

  // Already logged in? Skip the login screen entirely.
  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      title: "Automated Builds",
      subtitle: "Triggered on every push",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M13 2L4.5 14H11L10 22L19 10H12.5L13 2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      title: "Docker Execution",
      subtitle: "Isolated, reproducible steps",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="10" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="10" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
          <rect x="13" y="10" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="5" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2 14C2 14 2.5 19 8 19H16C19 19 21 16.5 21 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      title: "Live Pipeline Logs",
      subtitle: "Real-time streaming output",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7 9L10 12L7 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 15H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="login-container">
      <div className="background-grid"></div>
      <div className="glow-orb glow-orb-1"></div>
      <div className="glow-orb glow-orb-2"></div>

      <div className="login-card">
        <div className="logo-section">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13 2L4.5 14H11L10 22L19 10H12.5L13 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>ForgeCI</h1>
          <p>Automated CI/CD Pipeline Platform</p>
        </div>

        <button className="github-btn" onClick={handleGithubLogin}>
          <svg
            className="github-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.071 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.337 4.695-4.566 4.943.359.31.679.92.679 1.855 0 1.338-.012 2.419-.012 2.748 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          Continue with GitHub
        </button>

        <div className="divider">
          <span>What you get</span>
        </div>

        <div className="features">
          {features.map((feature) => (
            <div className="feature" key={feature.title}>
              <div className="feature-icon">{feature.icon}</div>
              <div className="feature-text">
                <span className="feature-title">{feature.title}</span>
                <span className="feature-subtitle">{feature.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Login;
