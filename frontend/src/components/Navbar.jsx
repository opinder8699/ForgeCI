import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "../styles/Navbar.css";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <header className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <span className="navbar-mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M13 2L4.5 14H11L10 22L19 10H12.5L13 2Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </span>
        ForgeCI
      </Link>

      <nav className="navbar-links">
        <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
          Dashboard
        </Link>
        <Link to="/pipelines/new" className={isActive("/pipelines/new") ? "active" : ""}>
          New Pipeline
        </Link>
        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="navbar-queue-link"
        >
          Queue Monitor ↗
        </a>
      </nav>

      <div className="navbar-user">
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="navbar-avatar" />}
        <span className="navbar-username">{user?.username ?? user?.githubUsername ?? "Account"}</span>
        <button className="navbar-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

export default Navbar;